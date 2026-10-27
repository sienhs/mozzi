"""manifest 슬롯을 로컬 klein 4B distilled 로 생성 (외부 API 결과와 나란히 비교하는 용도, 비용 0).

- 프롬프트: dataset/prompts/generation_prompts.csv (export_prompts.py) 의 prompt.
  레퍼런스를 쓰면 ref_note 문장을 앞에 붙이고 outputs/anchors/{mood}.png 를 첨부 (동행 단독 시트는 neutral)
- 크기: 시트는 정사각 --sheet-size, 장면은 3:2 --scene-width x (2/3)
- 저장: {out}/{slot_id}/1.png + {out}/klein_log.jsonl (장당 시간, torch 최대 메모리)
- 비교용 임시 생성이라 results/ CSV 에는 기록하지 않는다. 정식 측정은 infer.py

예 (ai/ 에서):
  .venv\\Scripts\\python.exe scripts\\klein_slots.py --slots sc_07,sc_08,sc_30,sc_11,sc_12
  .venv\\Scripts\\python.exe scripts\\klein_slots.py --slots sc_07,sc_08 --no-ref --out outputs\\candidates_klein_noref
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ANCHORS_DIR, DATASET, OUTPUTS, now_iso  # noqa: E402

MOODS = ("happy", "calm", "neutral", "sad", "angry")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slots", required=True, help="쉼표 구분 slot_id")
    ap.add_argument("--no-ref", action="store_true", help="anchor 레퍼런스 없이 프롬프트만")
    ap.add_argument("--precision", default="fp8", help="bf16 | fp8 | gguf_q8 | gguf_q4")
    ap.add_argument("--scene-width", type=int, default=1152, help="장면 가로 (세로는 2/3). 6GB 기준 1152x768")
    ap.add_argument("--sheet-size", type=int, default=768)
    ap.add_argument("--ref-side", type=int, default=768, help="레퍼런스를 이 크기로 줄여서 첨부 (VRAM 절약)")
    ap.add_argument("--seed", type=int, default=1000, help="슬롯 i 는 seed+i")
    ap.add_argument("--out", default=None, help="기본: outputs/candidates_klein (--no-ref 면 _noref)")
    ap.add_argument("--csv", default=str(DATASET / "prompts" / "generation_prompts.csv"))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    import torch
    from PIL import Image

    import klein_runtime as kr

    out = Path(args.out or OUTPUTS / ("candidates_klein_noref" if args.no_ref else "candidates_klein"))
    with open(args.csv, newline="", encoding="utf-8-sig") as f:
        rows = {r["slot_id"]: r for r in csv.DictReader(f)}
    slots = args.slots.split(",")
    missing = [s for s in slots if s not in rows]
    if missing:
        sys.exit(f"[중단] 없는 slot_id: {missing}")

    jobs = []
    for s in slots:
        r = rows[s]
        ref = None
        if not args.no_ref and r["split"] != "anchor":
            ref = ANCHORS_DIR / f"{r['mood'] if r['mood'] in MOODS else 'neutral'}.png"
            if not ref.exists():
                sys.exit(f"[중단] anchor 없음: {ref} (--no-ref 로 돌리거나 anchor 를 먼저 고른다)")
        prompt = (r["ref_note"] + " " + r["prompt"]) if ref else r["prompt"]
        w = args.scene_width if r["split"] == "scene" else args.sheet_size
        h = (w * 2 // 3) // 16 * 16 if r["split"] == "scene" else w
        jobs.append((s, prompt, ref, w, h))

    t0 = time.perf_counter()
    embeds, _ = kr.encode_prompts([p for _, p, _, _, _ in jobs])
    te_sec = time.perf_counter() - t0
    t0 = time.perf_counter()
    pipe = kr.load_generator(args.precision)
    load_sec = time.perf_counter() - t0
    print(f"[ready] 텍스트 인코딩 {te_sec:.1f}s, 모델 로딩 {load_sec:.1f}s", flush=True)

    for i, (slot, prompt, ref, w, h) in enumerate(jobs):
        kw = {}
        if ref:
            kw["image"] = [Image.open(ref).convert("RGB").resize((args.ref_side, args.ref_side), Image.LANCZOS)]
        torch.cuda.reset_peak_memory_stats()
        t0 = time.perf_counter()
        img = pipe(prompt_embeds=embeds[prompt].to(pipe._execution_device), height=h, width=w,
                   num_inference_steps=4, guidance_scale=1.0,
                   generator=torch.Generator("cpu").manual_seed(args.seed + i), **kw).images[0]
        sec = time.perf_counter() - t0
        p = out / slot / "1.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p)
        rec = {"time": now_iso(), "slot": slot, "sec": round(sec, 2),
               "torch_peak_reserved_gb": round(torch.cuda.max_memory_reserved() / 1e9, 2),
               "size": f"{w}x{h}", "precision": args.precision, "ref": ref.name if ref else None}
        with open(out / "klein_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[{i + 1}/{len(jobs)}] {slot} {sec:.1f}s {w}x{h} ref={rec['ref']} → {p}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
