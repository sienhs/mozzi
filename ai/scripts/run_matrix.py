"""experiment_matrix.yaml 의 조합을 골라 순서대로 실행.

inference: infer.py → eval.py (요약 CSV 에 append/갱신)
training:  train.py --non-interactive (예상 시간 초과 시 too_slow 로 기록하고 다음으로)
sweeps:    학습 run 의 체크포인트마다 infer.py(val) → eval.py
실패한 조합은 상태를 남기고 다음 조합으로 넘어간다.

예:
  python scripts/run_matrix.py --list
  python scripts/run_matrix.py --priority 1 --kind inference
  python scripts/run_matrix.py --only lora_fp8_768 --limit 4     # 디버그: 프롬프트 4개만
  python scripts/run_matrix.py --priority 1 --dry-run
"""
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (AI_DIR, CONFIGS, INFERENCE_COLUMNS, INFERENCE_SUMMARY, RUNS, TRAINING_SUMMARY,  # noqa: E402
                    append_csv, append_experiment_line, load_yaml, today)

PY = sys.executable
SCRIPTS = AI_DIR / "scripts"


def latest_train_run() -> str | None:
    if not TRAINING_SUMMARY.exists():
        return None
    with open(TRAINING_SUMMARY, newline="", encoding="utf-8") as f:
        # 본 학습만: 스모크/짧은 확인용(60 step 등) 실행은 제외
        rows = [r for r in csv.DictReader(f) if r["status"] == "success" and "smoke" not in r["run_id"]
                and "train_local.yaml" in r["config"] and int(r["steps_done"] or 0) >= 1000]
    return rows[-1]["run_id"] if rows else None


def final_lora(run_id: str) -> Path | None:
    d = RUNS / run_id / "aitk"
    if not d.exists():
        return None
    name = re.sub(r"[^A-Za-z0-9_\-]", "_", run_id)
    p = d / name / f"{name}.safetensors"
    return p if p.exists() else None


def checkpoints(run_id: str) -> list[tuple[int, Path]]:
    name = re.sub(r"[^A-Za-z0-9_\-]", "_", run_id)
    d = RUNS / run_id / "aitk" / name
    out = []
    for p in sorted(d.glob(f"{name}_*.safetensors")):
        m = re.search(r"_(\d{9})\.safetensors$", p.name)
        if m:
            out.append((int(m.group(1)), p))
    if (f := final_lora(run_id)) is not None:
        snap = load_yaml(RUNS / run_id / "config.snapshot.yaml")
        out.append((int(snap["config"]["process"][0]["train"]["steps"]), f))
    return sorted(set(out))


def run(cmd: list[str], dry: bool) -> int:
    print("  $ " + " ".join(cmd), flush=True)
    if dry:
        return 0
    return subprocess.call(cmd, cwd=AI_DIR)


def newest_run_dir(prefix: str) -> Path | None:
    ds = sorted(RUNS.glob(prefix + "*"), key=lambda p: p.stat().st_mtime)
    return ds[-1] if ds else None


def do_inference(e: dict, d: dict, args, lora_override: str | None, lora_step: int | None = None,
                 prompts: str | None = None) -> str:
    method = e["method"]
    cmd = [PY, str(SCRIPTS / "infer.py"), "--method", method, "--res", str(e["res"]),
           "--prompts", prompts or e.get("prompts", d["prompts"]),
           "--seeds-per-prompt", str(e.get("seeds_per_prompt", d["seeds_per_prompt"])),
           "--steps", str(d["steps"]), "--guidance", str(d["guidance"]), "--te-device", d["te_device"],
           "--notes", f"matrix:{e['name']}"]
    if d.get("max_image_sec"):
        cmd += ["--max-image-sec", str(d["max_image_sec"])]
    if method != "api_ref":
        cmd += ["--precision", e["precision"]]
    if method == "klein_lora":
        lora = lora_override
        if not lora:
            spec = e.get("lora", d["lora"])
            if spec == "latest":
                rid = latest_train_run()
                lp = final_lora(rid) if rid else None
                if lp is None:
                    msg = "LoRA 없음 (성공한 본 학습 run 이 없음)"
                    print(f"  [skip] {msg}")
                    if args.dry_run:
                        return "skipped"
                    append_csv(INFERENCE_SUMMARY, INFERENCE_COLUMNS, {
                        "run_id": f"{today()}_{method}_{e['precision']}_{e['res']}_skipped", "date": today(),
                        "status": "skipped", "error": msg, "method": method, "precision": e["precision"],
                        "resolution": e["res"], "notes": f"matrix:{e['name']}"})
                    return "skipped"
                lora = str(lp)
            else:
                lora = spec
        cmd += ["--lora", lora]
        if lora_step:
            cmd += ["--lora-step", str(lora_step)]
    if args.limit:
        cmd += ["--limit", str(args.limit)]
    rc = run(cmd, args.dry_run)
    if args.dry_run:
        return "dry"
    prec = e.get("precision", "na") if method != "api_ref" else "na"
    rd = newest_run_dir(f"{today()}_{method}_{prec}_{e['res']}")
    if rc != 0 or rd is None:
        return f"infer_failed(rc={rc})"
    ecmd = [PY, str(SCRIPTS / "eval.py"), str(rd)] + (["--crop"] if d.get("eval_crop") else [])
    erc = run(ecmd, False)
    return "success" if erc == 0 else f"eval_failed(rc={erc})"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matrix", default=str(CONFIGS / "experiment_matrix.yaml"))
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--priority", type=int, default=None, help="이 값 이하 priority 만")
    ap.add_argument("--only", default=None, help="쉼표 구분 name")
    ap.add_argument("--kind", default=None, choices=["training", "inference", "sweeps"])
    ap.add_argument("--lora", default=None, help="klein_lora 에 쓸 LoRA 경로 (latest 대신)")
    ap.add_argument("--dataset", default=None, help="학습 데이터셋 폴더 (train.py --dataset)")
    ap.add_argument("--limit", type=int, default=None, help="추론 프롬프트 수 제한 (디버그)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    m = load_yaml(args.matrix)
    d = m["defaults"]
    only = set(args.only.split(",")) if args.only else None
    plan = []
    for kind in ("training", "inference", "sweeps"):
        if args.kind and kind != args.kind:
            continue
        for e in m.get(kind) or []:
            if only and e["name"] not in only:
                continue
            if args.priority and e.get("priority", 9) > args.priority:
                continue
            plan.append((kind, e))

    if args.list or not plan:
        print(f"{'kind':10s} {'name':22s} {'pri':3s}  detail")
        for kind in ("training", "inference", "sweeps"):
            for e in m.get(kind) or []:
                mark = "*" if (kind, e) in plan else " "
                detail = {k: v for k, v in e.items() if k not in ("name", "priority")}
                print(f"{mark}{kind:9s} {e['name']:22s} {e.get('priority', ''):<3}  {detail}")
        return 0

    results = []
    for kind, e in plan:
        print(f"\n=== [{kind}] {e['name']} ===", flush=True)
        try:
            if kind == "training":
                cmd = [PY, str(SCRIPTS / "train.py"), "--config", e["config"], "--precision", e["precision"],
                       "--rank", str(e["rank"]), "--non-interactive", "--notes", f"matrix:{e['name']}"]
                if e.get("steps"):
                    cmd += ["--steps", str(e["steps"])]
                if args.dataset:
                    cmd += ["--dataset", args.dataset]
                rc = run(cmd, args.dry_run)
                status = "dry" if args.dry_run else ("success" if rc == 0 else f"failed(rc={rc})")
            elif kind == "inference":
                status = do_inference(e, d, args, args.lora)
            else:
                rid = latest_train_run() if e.get("train_run", "latest") == "latest" else e["train_run"]
                cks = checkpoints(rid) if rid else []
                if not cks:
                    status = "skipped (체크포인트 없음)"
                else:
                    sts = []
                    for step, path in cks:
                        print(f"  -- step {step}: {path.name}")
                        sts.append(do_inference(e, d, args, str(path), lora_step=step, prompts=e.get("prompts", "val")))
                    status = ",".join(sorted(set(sts)))
        except Exception as ex:  # noqa: BLE001
            status = f"error: {ex}"
        print(f"=== [{kind}] {e['name']} → {status}")
        results.append((kind, e["name"], status))

    print("\n## 매트릭스 실행 결과")
    for k, n, s in results:
        print(f"- [{k}] {n}: {s}")
    if not args.dry_run:
        append_experiment_line(f"- {today()} run_matrix: " + ", ".join(f"{n}={s}" for _, n, s in results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
