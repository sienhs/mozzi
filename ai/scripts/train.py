"""ai-toolkit 학습 래퍼 + 학습 측정.

- configs/train_*.yaml 의 {{...}} 자리표시자를 채우고 mochi: 블록을 떼어 ai-toolkit run.py 로 실행
- 진행 표시줄에서 step 을 읽어 직접 시간을 잰다 (s/it, 첫 50 step 기준 예상 시간)
- 예상 시간이 max_train_hours 를 넘으면 학습 프로세스를 일시정지하고 계속할지 묻는다
  (--yes: 묻지 않고 계속, --non-interactive: 묻지 않고 too_slow 로 중단)
- 결과: outputs/runs/{run_id}/ (metrics.json, env.json, config.snapshot.yaml, log.txt, 체크포인트)
        results/training_summary.csv 1행, experiments.md 1줄

예:
  python scripts/train.py --config configs/train_local_smoke.yaml --dataset outputs/datasets/v1
  python scripts/train.py --config configs/train_local.yaml --dataset outputs/datasets/v1 --rank 8
  python scripts/train.py --config configs/train_local.yaml --precision bf16 --non-interactive
  python scripts/train.py --config configs/train_local.yaml --resume 20261019_train_qfloat8_r16
"""
from __future__ import annotations

import argparse
import copy
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (AI_DIR, AITK_DIR, OUTPUTS, PROMPTS, RUNS, TRAINING_COLUMNS, TRAINING_SUMMARY,  # noqa: E402
                    ResourceMonitor, append_csv, append_experiment_line, collect_env, dump_yaml, load_yaml,
                    now_iso, print_fairness_notice, read_lines, today, unique_run_dir, write_json)

OOM_PAT = re.compile(r"out of memory|OutOfMemoryError|CUBLAS_STATUS_ALLOC_FAILED", re.I)


def fill_placeholders(obj, mapping: dict):
    if isinstance(obj, dict):
        return {k: fill_placeholders(v, mapping) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fill_placeholders(v, mapping) for v in obj]
    if isinstance(obj, str):
        for k, v in mapping.items():
            obj = obj.replace("{{" + k + "}}", str(v))
    return obj


def build_aitk_config(cfg: dict, args, run_name: str, run_dir: Path, dataset: Path) -> tuple[dict, dict]:
    meta = copy.deepcopy(cfg.get("mochi", {}))
    aitk = {k: v for k, v in cfg.items() if k != "mochi"}
    aitk = fill_placeholders(aitk, {"RUN_NAME": run_name, "TRAINING_FOLDER": (run_dir / "aitk").as_posix(),
                                    "DATASET_DIR": dataset.as_posix()})
    proc = aitk["config"]["process"][0]
    precision = args.precision or meta.get("train_precision", "qfloat8")
    if precision == "bf16":
        proc["model"]["quantize"] = False
        proc["model"]["quantize_te"] = False
    else:
        proc["model"]["quantize"] = True
        proc["model"]["qtype"] = precision
    if args.layer_offloading:
        proc["model"]["layer_offloading"] = True
    rank = args.rank or meta.get("rank", 16)
    proc["network"]["linear"] = rank
    proc["network"]["linear_alpha"] = rank
    if args.steps:
        proc["train"]["steps"] = args.steps
    if args.resolution:
        proc["datasets"][0]["resolution"] = [args.resolution]
        proc["sample"]["width"] = proc["sample"]["height"] = args.resolution
    if meta.get("sample_prompts") == "val" and (PROMPTS / "val.txt").exists():
        prompts = read_lines(PROMPTS / "val.txt")[: meta.get("sample_prompts_limit") or None]
        proc["sample"]["prompts"] = prompts
    if args.no_sample:
        # 중간 샘플링 끄기 (6GB 에서 샘플링 직후 VRAM 이 공유 메모리로 넘쳐 느려진 적 있음)
        proc["train"]["disable_sampling"] = True
    meta.update({"train_precision": precision, "rank": rank})
    return aitk, meta


class StepTracker:
    """ai-toolkit 진행 표시줄 'name:  12%|...| 240/2000 [...]' 에서 step 을 읽고 시각을 기록."""

    def __init__(self, run_name: str):
        self.pat = re.compile(re.escape(run_name) + r":\s*\d+%\|[^|]*\|\s*(\d+)/(\d+)")
        self.step_times: dict[int, float] = {}
        self.total: int | None = None
        self.last_step = 0
        self.first_step_seen: float | None = None

    def feed(self, text: str) -> None:
        for m in self.pat.finditer(text):
            s, t = int(m.group(1)), int(m.group(2))
            self.total = t
            if s not in self.step_times:
                self.step_times[s] = time.time()
                if self.first_step_seen is None:
                    self.first_step_seen = time.time()
            self.last_step = max(self.last_step, s)

    def sec_per_it(self, lo: int, hi: int) -> float | None:
        ks = sorted(k for k in self.step_times if lo <= k <= hi)
        if len(ks) < 2 or ks[-1] == ks[0]:
            return None
        return (self.step_times[ks[-1]] - self.step_times[ks[0]]) / (ks[-1] - ks[0])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True)
    ap.add_argument("--dataset", default=None, help="이미지+캡션 폴더 (기본: outputs/datasets 의 최신 v*)")
    ap.add_argument("--precision", default=None, help="bf16 | qfloat8 | float8 | int8 | uint4 ...")
    ap.add_argument("--rank", type=int, default=None)
    ap.add_argument("--steps", type=int, default=None)
    ap.add_argument("--resolution", type=int, default=None)
    ap.add_argument("--layer-offloading", action="store_true", help="ai-toolkit layer_offloading (CPU 오프로딩)")
    ap.add_argument("--max-hours", type=float, default=None)
    ap.add_argument("--resume", default=None, help="이어서 학습할 run_id")
    ap.add_argument("--no-sample", action="store_true", help="학습 중 샘플 생성 끄기 (train.disable_sampling)")
    ap.add_argument("--yes", action="store_true", help="예상 시간 초과여도 묻지 않고 계속")
    ap.add_argument("--non-interactive", action="store_true", help="예상 시간 초과 시 too_slow 로 중단")
    ap.add_argument("--notes", default="")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    cfg_path = Path(args.config)
    cfg = load_yaml(cfg_path)
    meta0 = cfg.get("mochi", {})
    precision = args.precision or meta0.get("train_precision", "qfloat8")
    rank = args.rank or meta0.get("rank", 16)
    dataset = Path(args.dataset) if args.dataset else latest_dataset()
    if dataset is None or not dataset.exists():
        print("[오류] 데이터셋 폴더가 없습니다. build_dataset.py 를 먼저 실행하거나 --dataset 을 지정하세요.")
        return 2
    dataset = dataset.resolve()

    if args.resume:
        run_id, run_dir = args.resume, RUNS / args.resume
        if not run_dir.exists():
            print(f"[오류] {run_dir} 없음")
            return 2
    else:
        kind = "_smoke" if meta0.get("kind") == "smoke" else ""
        run_id, run_dir = unique_run_dir(f"{today()}_train_{precision}_r{rank}{kind}")
    run_name = re.sub(r"[^A-Za-z0-9_\-]", "_", run_id)

    aitk_cfg, meta = build_aitk_config(cfg, args, run_name, run_dir, dataset)
    max_hours = args.max_hours or meta.get("max_train_hours", 12)
    est_after = meta.get("estimate_after_steps", 50)
    dump_yaml({"source_config": str(cfg_path), "mochi": meta, "args": vars(args), **aitk_cfg},
              run_dir / "config.snapshot.yaml")
    aitk_path = run_dir / "aitk_config.yaml"
    dump_yaml(aitk_cfg, aitk_path)
    env = collect_env({"dataset": str(dataset)})
    write_json(run_dir / "env.json", env)
    n_images = len([p for p in dataset.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")])
    proc = aitk_cfg["config"]["process"][0]
    steps_target = proc["train"]["steps"]

    print_fairness_notice()
    print(f"[train] {run_id}  precision={precision} rank={rank} steps={steps_target} images={n_images}")
    print(f"        dataset={dataset}")

    log = open(run_dir / "log.txt", "a", encoding="utf-8", buffering=1)  # 줄 단위 flush
    log.write(f"\n===== {now_iso()} start (resume={bool(args.resume)}) =====\n")
    py = sys.executable
    t_start = time.time()
    child_env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}
    p = subprocess.Popen([py, "run.py", str(aitk_path)], cwd=AITK_DIR, stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT, env=child_env)
    mon = ResourceMonitor(pids=[p.pid]).start()
    tracker = StepTracker(run_name)
    tail: list[str] = []
    status, err = None, None
    decided = threading.Event()

    def reader():
        buf = b""
        while True:
            ch = p.stdout.read1(4096) if hasattr(p.stdout, "read1") else p.stdout.read(4096)
            if not ch:
                break
            buf += ch
            parts = re.split(rb"[\r\n]", buf)
            buf = parts.pop()
            for part in parts:
                line = part.decode("utf-8", "ignore")
                if not line.strip():
                    continue
                tracker.feed(line)
                log.write(line + "\n")
                tail.append(line)
                del tail[:-200]
                if not tracker.pat.search(line) or tracker.last_step % 10 == 0:
                    print(line[:300], flush=True)
        if buf:
            log.write(buf.decode("utf-8", "ignore") + "\n")

    th = threading.Thread(target=reader, daemon=True)
    th.start()

    first50 = None
    est_hours = None
    start_step = None
    try:
        while p.poll() is None:
            time.sleep(2)
            if start_step is None and tracker.step_times:
                start_step = min(tracker.step_times)
            if decided.is_set() or start_step is None:
                continue
            done = tracker.last_step - start_step
            if done >= min(est_after, steps_target - start_step) and done > 1:
                # 처음 몇 step 은 워밍업이라 2번째 관측 step 부터 잰다
                first50 = tracker.sec_per_it(start_step + 1, start_step + est_after)
                if first50:
                    remaining = steps_target - tracker.last_step
                    est_hours = first50 * steps_target / 3600
                    print(f"\n[예상] 첫 {done} step 평균 {first50:.2f} s/it → 전체 {steps_target} step "
                          f"약 {est_hours:.2f}시간 (남은 약 {first50 * remaining / 3600:.2f}시간, 샘플링/캐싱 제외)\n")
                    if est_hours > max_hours:
                        if args.yes:
                            print(f"[예상 초과] {max_hours}시간 초과지만 --yes 로 계속합니다.")
                        elif args.non_interactive:
                            status = "too_slow"
                            err = f"estimated {est_hours:.1f}h > max {max_hours}h"
                            print(f"[중단] {err}")
                            p.kill()
                        else:
                            import psutil
                            pp = psutil.Process(p.pid)
                            procs = [pp] + pp.children(recursive=True)
                            for q in procs:
                                q.suspend()
                            ans = input(f"예상 {est_hours:.1f}시간 > 최대 {max_hours}시간. 계속할까요? [y/N] ").strip().lower()
                            if ans == "y":
                                for q in procs:
                                    q.resume()
                            else:
                                status = "too_slow"
                                err = f"estimated {est_hours:.1f}h > max {max_hours}h (user stopped)"
                                for q in procs:
                                    q.resume()
                                p.kill()
                decided.set()
    except KeyboardInterrupt:
        # Ctrl+C: 콘솔 그룹 전체에 전달되어 자식도 같이 멈춘다. 기록은 남기고 끝낸다.
        status = "interrupted"
        err = f"user stopped (Ctrl+C) at step {tracker.last_step}/{steps_target}"
        print(f"\n[중단] {err}")
        try:
            p.wait(timeout=30)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
    th.join(timeout=10)
    rc = p.returncode
    total_min = (time.time() - t_start) / 60
    res = mon.stop()
    log.close()

    joined = "\n".join(tail)
    if status is None:
        if rc == 0:
            status = "success"
        elif OOM_PAT.search(joined):
            status = "OOM"
            err = next((l for l in reversed(tail) if OOM_PAT.search(l)), "OOM")[:300]
        else:
            status = "error"
            err = next((l for l in reversed(tail) if "Error" in l or "error" in l), f"returncode={rc}")[:300]

    steady = None
    if tracker.step_times:
        ks = sorted(tracker.step_times)
        steady = tracker.sec_per_it(ks[0] + 1, ks[-1])
    ckpts = sorted((run_dir / "aitk" / run_name).glob(f"{run_name}*.safetensors")) if (run_dir / "aitk").exists() else []
    metrics = {
        "run_id": run_id, "date": today(), "status": status, "error": err, "config": str(cfg_path),
        "train_precision": precision, "qtype": proc["model"].get("qtype") if proc["model"].get("quantize") else None,
        "rank": rank, "resolution": proc["datasets"][0]["resolution"], "steps_target": steps_target,
        "steps_done": tracker.last_step, "batch_size": proc["train"]["batch_size"], "lr": proc["train"]["lr"],
        "dataset": str(dataset), "n_images": n_images, "sec_per_it": steady, "sec_per_it_first50": first50,
        "est_total_hours": est_hours if est_hours else (first50 * steps_target / 3600 if first50 else None),
        "total_train_min": total_min, "returncode": rc, "checkpoints": [c.name for c in ckpts],
        "power_plugged": env.get("power_plugged"), "git_commit": env.get("git_commit"), "notes": args.notes,
        "layer_offloading": args.layer_offloading, **res,
    }
    if metrics["est_total_hours"] is None and steady:
        metrics["est_total_hours"] = steady * steps_target / 3600
    write_json(run_dir / "metrics.json", metrics)
    row = dict(metrics)
    row["resolution"] = "|".join(map(str, metrics["resolution"]))
    append_csv(TRAINING_SUMMARY, TRAINING_COLUMNS, row)
    spi = f"{steady:.2f}s/it" if steady else "s/it 없음"
    append_experiment_line(f"- {today()} `{run_id}` train {precision}/r{rank} → {status}, {spi}, "
                           f"{tracker.last_step}/{steps_target} steps, {total_min:.1f}min"
                           + (f" ({err[:100]})" if err else ""))
    print(f"\n[done] {run_id} status={status} steps={tracker.last_step}/{steps_target} {spi} "
          f"vram_smi={res['vram_peak_gb_smi']}GB shared={res['shared_peak_gb']}GB fallback={res['sysmem_fallback']}")
    return 0 if status == "success" else 2


def latest_dataset() -> Path | None:
    d = OUTPUTS / "datasets"
    if not d.exists():
        return None
    vs = sorted([p for p in d.iterdir() if p.is_dir()], key=lambda p: p.stat().st_mtime)
    return vs[-1] if vs else None


if __name__ == "__main__":
    raise SystemExit(main())
