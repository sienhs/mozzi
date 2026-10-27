"""추론 + 측정.

method:
  klein_base  klein 4B distilled, 프롬프트만 (하한선)        -> 입력: test.csv 의 prompt (긴 생성 프롬프트)
  klein_ref   klein 4B distilled + anchor 레퍼런스 편집      -> 입력: prompt + anchors/{mood}.png
  klein_lora  klein 4B distilled + 모찌 LoRA                 -> 입력: caption (트리거 단어 포함 짧은 캡션)
                                                                  + inference_style 화풍 문구 (끄기: --no-inference-style)
  api_ref     외부 이미지 API + anchor 레퍼런스              -> 입력: prompt + anchors/{mood}.png (호출 시간 측정)

측정 규약 (README "측정 규약"):
  - 같은 프롬프트 목록, 같은 seed 목록(seeds.txt), distilled 4-step, guidance 1.0, 같은 해상도
  - 첫 1장은 warmup 으로 측정 제외
  - latency_sec 은 트랜스포머 디노이즈 + VAE 디코드 (텍스트 인코딩은 te_encode_sec 으로 따로)
  - model_load_sec 은 트랜스포머(+LoRA)+VAE 를 GPU에 올리기까지 (텍스트 인코더 제외)

예:
  python scripts/infer.py --method klein_lora --precision fp8 --res 768 --lora outputs/runs/<train_run>/lora.safetensors
  python scripts/infer.py --method klein_base --precision gguf_q4 --res 1024 --sets test_combo --limit 4
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (ANCHORS_DIR, INFERENCE_COLUMNS, INFERENCE_SUMMARY, PROMPTS, ResourceMonitor, Tee,  # noqa: E402
                    append_csv, append_experiment_line, collect_env, dump_yaml, now_iso, percentile,
                    print_fairness_notice, read_seeds, today, unique_run_dir, write_json)

METHODS = ["klein_base", "klein_ref", "klein_lora", "api_ref"]
DEFAULT_FIELD = {"klein_base": "prompt", "klein_ref": "prompt", "klein_lora": "caption", "api_ref": "prompt"}
TEST_SETS = ["test_combo", "test_diary", "test_multi", "test_two_companions"]


def load_prompt_rows(which: str, sets: list[str] | None) -> list[dict]:
    path = {"test": PROMPTS / "test.csv", "val": PROMPTS / "val.csv"}.get(which, Path(which))
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if sets:
        rows = [r for r in rows if r["set"] in sets]
    return rows


def anchor_for(mood: str) -> Path:
    return ANCHORS_DIR / f"{mood}.png"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--method", required=True, choices=METHODS)
    ap.add_argument("--precision", default="bf16", help="bf16 | fp8 | gguf_q8 | gguf_q4 (klein 계열만)")
    ap.add_argument("--res", type=int, default=768, choices=[512, 768, 1024])
    ap.add_argument("--lora", default=None, help="LoRA safetensors 경로 (klein_lora)")
    ap.add_argument("--lora-step", type=int, default=None, help="체크포인트 step (리포트용 기록)")
    ap.add_argument("--lora-scale", type=float, default=1.0)
    ap.add_argument("--prompts", default="test", help="test | val | csv 경로")
    ap.add_argument("--sets", default=None, help="쉼표 구분 세트 필터 (예: test_combo,test_diary)")
    ap.add_argument("--prompt-field", default=None, choices=["prompt", "caption"], help="기본: method별 자동")
    ap.add_argument("--no-inference-style", action="store_true",
                    help="caption 입력(klein_lora)에 inference_style(화풍 문구)을 붙이지 않음 (기본은 붙임)")
    ap.add_argument("--seeds-per-prompt", type=int, default=1)
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--guidance", type=float, default=1.0)
    ap.add_argument("--limit", type=int, default=None, help="디버그용: 앞에서 N개 프롬프트만")
    ap.add_argument("--te-device", default="cuda", choices=["cuda", "cpu"])
    ap.add_argument("--cpu-offload", action="store_true", help="enable_model_cpu_offload (별도 변형으로 기록됨)")
    ap.add_argument("--max-image-sec", type=float, default=None,
                    help="한 장(warmup 포함)이 이 시간을 넘으면 중단하고 too_slow 로 기록 (예: 120)")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--notes", default="")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    is_klein = args.method.startswith("klein")
    precision = args.precision if is_klein else "na"
    if args.method == "klein_lora" and not args.lora:
        ap.error("--method klein_lora 는 --lora 가 필요합니다")
    base_id = args.run_id or f"{today()}_{args.method}_{precision}_{args.res}" + (
        f"_s{args.lora_step}" if args.lora_step else "") + ("_nostyle" if args.no_inference_style else "") + (
        "_offload" if args.cpu_offload else "")
    run_id, run_dir = unique_run_dir(base_id)
    (run_dir / "images").mkdir()

    with Tee(run_dir / "log.txt"):
        return _run(args, run_id, run_dir, precision, is_klein)


def _run(args, run_id: str, run_dir: Path, precision: str, is_klein: bool) -> int:
    print_fairness_notice()
    print(f"[run] {run_id}  started {now_iso()}")
    sets = args.sets.split(",") if args.sets else None
    rows = load_prompt_rows(args.prompts, sets)
    if args.limit:
        rows = rows[: args.limit]
    seeds = read_seeds()[: args.seeds_per_prompt]
    field = args.prompt_field or DEFAULT_FIELD[args.method]
    # 서비스와 같은 입력: caption + inference_style (prompt_builder.build_lora_prompt 와 같은 규칙)
    styled = field == "caption" and not args.no_inference_style
    if styled:
        from prompt_builder import load_rules, with_inference_style
        rules = load_rules()
        for r in rows:
            r[field + "+style"] = with_inference_style(rules, r[field])
        field += "+style"
    jobs = [(r, s) for r in rows for s in seeds]
    prompt_set = args.sets or args.prompts

    snapshot = {"args": vars(args), "run_id": run_id, "prompt_field": field, "seeds": seeds, "n_jobs": len(jobs)}
    if is_klein:
        import klein_runtime as kr
        snapshot["model"] = {"repo": kr.DISTILLED_REPO, "gguf": kr.GGUF_FILES.get(precision)}
    dump_yaml(snapshot, run_dir / "config.snapshot.yaml")
    env = collect_env({"method": args.method})
    write_json(run_dir / "env.json", env)

    metrics: dict = {"run_id": run_id, "status": "error", "error": None, "method": args.method,
                     "precision": precision, "resolution": args.res, "lora": args.lora, "lora_step": args.lora_step,
                     "prompt_set": prompt_set, "steps": args.steps, "guidance": args.guidance,
                     "seeds_per_prompt": len(seeds), "prompt_field": field, "date": today(),
                     "power_plugged": env.get("power_plugged"), "git_commit": env.get("git_commit"),
                     "notes": " ".join(x for x in (args.notes, "inference_style" if styled else "",
                                                   "cpu_offload" if args.cpu_offload else "") if x)}
    per_prompt: list[dict] = []
    monitor = None
    try:
        needs_ref = args.method in ("klein_ref", "api_ref")
        if needs_ref:
            missing = sorted({r["mood"] for r in rows if not anchor_for(r["mood"]).exists()})
            if missing:
                raise FileNotFoundError(f"anchors 없음: {[str(anchor_for(m)) for m in missing]} "
                                        "(curate_app.py 에서 anchor 슬롯을 선택하면 자동 복사됨)")
        if is_klein:
            _run_klein(args, precision, jobs, field, run_dir, metrics, per_prompt)
        else:
            _run_api(args, jobs, field, run_dir, metrics, per_prompt)
        metrics["status"] = "success"
    except Exception as e:  # noqa: BLE001
        import torch
        msg = f"{type(e).__name__}: {e}"
        oom = isinstance(e, torch.OutOfMemoryError) or "out of memory" in str(e).lower()
        slow = type(e).__name__ == "TooSlowError"
        metrics["status"] = "OOM" if oom else ("too_slow" if slow else "error")
        metrics["error"] = msg[:500]
        print(f"[실패] {metrics['status']}: {msg}")
        traceback.print_exc()

    lat = [p["latency_sec"] for p in per_prompt if p.get("latency_sec") is not None]
    e2e = [p["latency_sec"] + (p.get("te_sec") or 0) for p in per_prompt if p.get("latency_sec") is not None]
    metrics.update({
        "n_images": len(lat),
        "latency_median_sec": percentile(lat, 0.5),
        "latency_p90_sec": percentile(lat, 0.9),
        "latency_mean_sec": (sum(lat) / len(lat)) if lat else None,
        "latency_e2e_median_sec": percentile(e2e, 0.5),
    })
    write_json(run_dir / "metrics.json", metrics)
    with open(run_dir / "per_prompt.csv", "w", newline="", encoding="utf-8") as f:
        cols = ["id", "set", "seed", "mood", "main_activity", "place", "companion", "weather", "shot",
                "image", "latency_sec", "te_sec", "text", "caption", "dino_sim", "clip_i", "clip_t",
                "dino_sim_crop", "human_score"]
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(per_prompt)
    append_csv(INFERENCE_SUMMARY, INFERENCE_COLUMNS, metrics)
    med = metrics["latency_median_sec"]
    append_experiment_line(
        f"- {today()} `{run_id}` infer {args.method}/{precision}/{args.res} → {metrics['status']}"
        f", n={metrics['n_images']}, median={med:.2f}s" if med else
        f"- {today()} `{run_id}` infer {args.method}/{precision}/{args.res} → {metrics['status']}"
        f" ({(metrics.get('error') or '')[:120]})")
    print(f"[done] {run_id} status={metrics['status']} → {run_dir}")
    return 0 if metrics["status"] == "success" else 2


def _run_klein(args, precision, jobs, field, run_dir, metrics, per_prompt) -> None:
    import torch
    from PIL import Image

    import klein_runtime as kr

    texts = [r[field] for r, _ in jobs]
    embeds, te_stats = kr.encode_prompts(texts, te_device=args.te_device)
    metrics.update({"te_load_sec": te_stats["te_load_sec"], "te_encode_sec_mean": te_stats["te_encode_sec_mean"],
                    "te_device": args.te_device, "te_vram_peak_gb": te_stats["te_vram_peak_gb"]})
    te_mean = te_stats["te_encode_sec_mean"]

    # 생성 단계 측정 시작 (텍스트 인코더는 이미 내려간 상태)
    torch.cuda.reset_peak_memory_stats()
    monitor = ResourceMonitor().start()
    try:
        t0 = time.perf_counter()
        pipe = kr.load_generator(precision, lora=args.lora, lora_scale=args.lora_scale, cpu_offload=args.cpu_offload)
        torch.cuda.synchronize()
        metrics["model_load_sec"] = time.perf_counter() - t0
        print(f"[load] {precision} model_load_sec={metrics['model_load_sec']:.1f}")

        def refs_for(r):
            if args.method != "klein_ref":
                return None
            return [Image.open(ANCHORS_DIR / f"{r['mood']}.png").convert("RGB")]

        # warmup (측정 제외)
        r0, s0 = jobs[0]
        tw = time.perf_counter()
        kr.generate(pipe, embeds[r0[field]], args.res, s0, args.steps, args.guidance, refs_for(r0),
                    max_sec=args.max_image_sec)
        torch.cuda.synchronize()
        metrics["warmup_sec"] = time.perf_counter() - tw
        print(f"[warmup] {metrics['warmup_sec']:.1f}s (측정 제외)")

        for i, (r, seed) in enumerate(jobs):
            torch.cuda.synchronize()
            t1 = time.perf_counter()
            img = kr.generate(pipe, embeds[r[field]], args.res, seed, args.steps, args.guidance, refs_for(r),
                              max_sec=args.max_image_sec)
            torch.cuda.synchronize()
            dt = time.perf_counter() - t1
            name = f"{r['id']}_s{seed}.png"
            img.save(run_dir / "images" / name)
            per_prompt.append({**{k: r.get(k) for k in ("id", "set", "mood", "main_activity", "place", "companion",
                                                       "weather", "shot", "caption")},
                               "seed": seed, "image": name, "latency_sec": round(dt, 4),
                               "te_sec": te_mean, "text": r[field]})
            print(f"[{i + 1}/{len(jobs)}] {name} {dt:.2f}s")
        del pipe
    finally:
        res = monitor.stop()
        metrics.update(res)
        metrics["vram_peak_gb_torch"] = torch.cuda.max_memory_allocated() / 2**30
        metrics["vram_reserved_peak_gb_torch"] = torch.cuda.max_memory_reserved() / 2**30
        metrics.update({k: v for k, v in monitor.result(metrics["vram_reserved_peak_gb_torch"]).items()
                        if k in ("sysmem_fallback", "sysmem_fallback_reason")})
        kr.free_cuda()


def _run_api(args, jobs, field, run_dir, metrics, per_prompt) -> None:
    from providers import Job, get_provider

    prov = get_provider()
    metrics["notes"] = (metrics.get("notes") or "") + f" provider={prov.name}"
    monitor = ResourceMonitor().start()
    try:
        jl = [Job(key=f"{r['id']}_s{s}", prompt=r[field], refs=[anchor_for(r["mood"])], size=args.res, seed=s)
              for r, s in jobs]
        rows = {f"{r['id']}_s{s}": r for r, s in jobs}
        jl = [Job(key="__warmup__", prompt=jl[0].prompt, refs=jl[0].refs, size=jl[0].size, seed=jl[0].seed)] + jl
        first = True
        for job, img, sec, err in prov.generate_batch(jl):
            if err:
                raise RuntimeError(err)
            if first:  # warmup 제외 (연결 수립 비용)
                first = False
                metrics["warmup_sec"] = sec
                continue
            name = f"{job.key}.png"
            img.save(run_dir / "images" / name)
            r = rows[job.key]
            per_prompt.append({**{k: r.get(k) for k in ("id", "set", "mood", "main_activity", "place", "companion",
                                                       "weather", "shot", "caption")},
                               "seed": job.seed, "image": name, "latency_sec": round(sec, 4), "text": job.prompt})
        metrics["cost_usd"] = prov.cost_per_image_usd * (len(per_prompt) + 1)
    finally:
        metrics.update(monitor.stop())


if __name__ == "__main__":
    raise SystemExit(main())
