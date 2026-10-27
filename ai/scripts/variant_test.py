"""특색(뽑기) 캐릭터가 로컬 모델에서 재현되는지 시험 (예: 레몬 모찌).

조건 (같은 프롬프트·seed·해상도로 비교):
  A  LoRA + 글 설명        캡션에 variants.<v>.caption 을 넣고 + inference_style. 참조 이미지 없음
  B  LoRA + 글 + 참조      A 와 같은 입력 + 같은 기분의 특색 캐릭터 이미지 첨부
  C  참조만 (LoRA 없음)     reference_notes.variant + 긴 생성 프롬프트 + variants.<v>.prompt + 참조 이미지
  D  LoRA + 참조 (글 없음)  기본 캡션 + inference_style + 참조 이미지. 캐릭터 문구 없이 참조만으로 되는지

- 프롬프트: val.csv 에서 기분별 첫 행 (happy, calm, neutral, sad, angry 순)
- 참조 이미지: --ref-dir 의 png 를 이름순으로 정렬해 --ref-order 의 기분에 대응 (투명 배경은 흰색으로 채움)
  --ref-dir 에 png 파일 하나를 주면 모든 기분에 그 한 장을 쓴다 (감정별 이미지가 없는 캐릭터)
- 저장: {out}/{A_lora_text,B_lora_ref,C_ref_only}/{id}.png, log.jsonl(장당 시간), summary.json, grid.png
- 탐색용 시험이라 results/ CSV 에는 기록하지 않는다. 조건마다 첫 장은 warmup 으로 측정에서 뺀다.
- 같은 폴더에 조건을 나눠 돌리면 summary.json·config.json 은 합치고, grid.png 는 있는 조건 폴더를 모두 넣는다.

예 (ai/ 에서):
  .venv\\Scripts\\python.exe scripts\\variant_test.py --variant lemon --ref-dir "C:\\ssafy\\workspace\\mochi data\\모찌\\레몬"
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUTPUTS, PROMPTS, ResourceMonitor, now_iso, today, write_json  # noqa: E402
from prompt_builder import (load_rules, with_inference_style, with_variant_caption,  # noqa: E402
                            with_variant_prompt)

MOODS = ("happy", "calm", "neutral", "sad", "angry")
CONDITIONS = {"A": "A_lora_text", "B": "B_lora_ref", "C": "C_ref_only", "D": "D_lora_ref_notext"}
LORA_CONDS = ("A", "B", "D")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_refs(ref_dir: Path, order: list[str], side: int) -> dict:
    from PIL import Image

    files = [ref_dir] * len(order) if ref_dir.is_file() else sorted(ref_dir.glob("*.png"))
    if len(files) < len(order):
        raise SystemExit(f"[오류] {ref_dir} 에 png 가 {len(files)}장뿐 (필요 {len(order)})")
    refs, cache = {}, {}
    for mood, p in zip(order, files):
        if p in cache:
            refs[mood] = cache[p]
            continue
        im = Image.open(p).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        refs[mood] = cache[p] = (p.name, bg.convert("RGB").resize((side, side), Image.LANCZOS))
    return refs


def pick_rows(n_per_mood: int) -> list[dict]:
    with open(PROMPTS / "val.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r for m in MOODS for r in [x for x in rows if x["mood"] == m][:n_per_mood]]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variant", required=True, help="prompt_rules.yaml 의 variants 키 (예: lemon)")
    ap.add_argument("--ref-dir", required=True, help="특색 캐릭터 이미지 폴더 (또는 모든 기분에 쓸 png 한 장)")
    ap.add_argument("--ref-order", default=",".join(MOODS), help="이름순 png 에 대응하는 기분 순서")
    ap.add_argument("--conditions", default="A,B,C")
    ap.add_argument("--precision", default="gguf_q4")
    ap.add_argument("--res", type=int, default=768)
    ap.add_argument("--ref-side", type=int, default=768, help="참조 이미지를 이 크기로 줄여서 첨부 (VRAM 절약)")
    ap.add_argument("--per-mood", type=int, default=1, help="기분마다 val 프롬프트 몇 개")
    ap.add_argument("--lora", default=None, help="기본: 최근 본 학습의 최종 LoRA")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--max-image-sec", type=float, default=300)
    ap.add_argument("--out", default=None, help="기본: outputs/variant_test/{날짜}_{variant}")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    import torch

    import klein_runtime as kr
    from run_matrix import final_lora, latest_train_run

    rules = load_rules()
    if args.variant not in (rules.get("variants") or {}):
        raise SystemExit(f"[오류] prompt_rules.yaml variants 에 '{args.variant}' 없음")
    conds = [c.strip() for c in args.conditions.split(",") if c.strip()]
    lora = args.lora or (str(final_lora(latest_train_run())) if latest_train_run() else None)
    if any(c in LORA_CONDS for c in conds) and not lora:
        raise SystemExit("[오류] LoRA 를 찾지 못함 (--lora 지정)")
    order = [m.strip() for m in args.ref_order.split(",")]
    refs = load_refs(Path(args.ref_dir), order, args.ref_side)
    rows = pick_rows(args.per_mood)
    out = Path(args.out) if args.out else OUTPUTS / "variant_test" / f"{today()}_{args.variant}"
    for c in conds:
        (out / CONDITIONS[c]).mkdir(parents=True, exist_ok=True)

    note = " ".join(rules["reference_notes"]["variant"].split())
    texts = {}
    for r in rows:
        texts[(r["id"], "lora")] = with_inference_style(rules, with_variant_caption(rules, r["caption"], args.variant))
        texts[(r["id"], "ref")] = f"{note} {with_variant_prompt(rules, r['prompt'], args.variant)}"
        texts[(r["id"], "plain")] = with_inference_style(rules, r["caption"])
    config = {"started": now_iso(), "variant": args.variant, "conditions": conds, "precision": args.precision,
              "res": args.res, "ref_side": args.ref_side, "seed": args.seed, "lora": lora,
              "refs": {m: refs[m][0] for m in refs}, "rows": [r["id"] for r in rows],
              "texts": {f"{k[0]}|{k[1]}": v for k, v in texts.items()}}
    prev = read_json(out / "config.json")
    if prev:  # 같은 폴더에 조건을 나눠 돌린 경우 합친다
        config = {**prev, **config, "conditions": sorted(set(prev.get("conditions", [])) | set(conds)),
                  "texts": {**prev.get("texts", {}), **config["texts"]}}
    write_json(out / "config.json", config)
    print(f"[variant_test] {args.variant} conditions={conds} precision={args.precision} → {out}")

    need = [texts[(r["id"], "lora")] for r in rows if {"A", "B"} & set(conds)]
    need += [texts[(r["id"], "ref")] for r in rows if "C" in conds]
    need += [texts[(r["id"], "plain")] for r in rows if "D" in conds]
    embeds, te_stats = kr.encode_prompts(need)

    log = open(out / "log.jsonl", "a", encoding="utf-8")
    summary = read_json(out / "summary.json")
    def key(name: str) -> str:  # 앞선 실행 측정값은 덮어쓰지 않고 남긴다
        return name if name not in summary else f"{name}_{''.join(conds)}"

    summary[key("te")] = te_stats

    def run_condition(pipe, c: str) -> None:
        use_ref = c in ("B", "C", "D")
        key = {"A": "lora", "B": "lora", "C": "ref", "D": "plain"}[c]
        jobs = [(r, texts[(r["id"], key)], [refs[r["mood"]][1]] if use_ref else None) for r in rows]
        torch.cuda.reset_peak_memory_stats()
        mon = ResourceMonitor().start()
        try:
            t = time.perf_counter()  # warmup: 같은 입력 모양으로 한 장 (측정 제외)
            kr.generate(pipe, embeds[jobs[0][1]], args.res, args.seed, ref_images=jobs[0][2],
                        max_sec=args.max_image_sec)
            warm = time.perf_counter() - t
            secs = []
            for i, (r, text, ref) in enumerate(jobs):
                torch.cuda.synchronize()
                t = time.perf_counter()
                img = kr.generate(pipe, embeds[text], args.res, args.seed, ref_images=ref, max_sec=args.max_image_sec)
                torch.cuda.synchronize()
                dt = time.perf_counter() - t
                secs.append(dt)
                img.save(out / CONDITIONS[c] / f"{r['id']}.png")
                log.write(json.dumps({"time": now_iso(), "condition": c, "id": r["id"], "mood": r["mood"],
                                      "sec": round(dt, 3), "ref": refs[r["mood"]][0] if ref else None,
                                      "text": text}, ensure_ascii=False) + "\n")
                log.flush()
                print(f"  [{c} {i + 1}/{len(jobs)}] {r['id']} ({r['mood']}) {dt:.1f}s")
        finally:
            res = mon.stop()
        summary[c] = {"warmup_sec": round(warm, 2), "sec_median": round(statistics.median(secs), 2),
                      "sec_list": [round(s, 2) for s in secs],
                      "vram_peak_gb_torch": round(torch.cuda.max_memory_allocated() / 2**30, 2),
                      "shared_peak_gb": res.get("shared_peak_gb"), "sysmem_fallback": res.get("sysmem_fallback")}
        print(f"[{c}] median {summary[c]['sec_median']}s, VRAM {summary[c]['vram_peak_gb_torch']}GB, "
              f"shared {summary[c]['shared_peak_gb']}, fallback {summary[c]['sysmem_fallback']}")

    try:
        if set(LORA_CONDS) & set(conds):
            t = time.perf_counter()
            pipe = kr.load_generator(args.precision, lora=lora)
            summary[key("load_sec_lora")] = round(time.perf_counter() - t, 2)
            for c in LORA_CONDS:
                if c in conds:
                    run_condition(pipe, c)
            del pipe
            kr.free_cuda()
        if "C" in conds:
            t = time.perf_counter()
            pipe = kr.load_generator(args.precision)
            summary[key("load_sec_base")] = round(time.perf_counter() - t, 2)
            run_condition(pipe, "C")
            del pipe
            kr.free_cuda()
    finally:
        log.close()
        summary["finished"] = now_iso()
        write_json(out / "summary.json", summary)

    make_grid(out, rows, refs, [c for c in CONDITIONS if (out / CONDITIONS[c]).is_dir()])
    print(f"[done] {out / 'grid.png'}")
    return 0


def make_grid(out: Path, rows: list[dict], refs: dict, conds: list[str]) -> None:
    from PIL import Image, ImageDraw

    tw = 300
    cols = ["ref"] + conds
    sheet = Image.new("RGB", (90 + tw * len(cols), 24 + tw * len(rows)), "white")
    d = ImageDraw.Draw(sheet)
    labels = {"ref": "reference", "A": "A: LoRA + text", "B": "B: LoRA + text + ref", "C": "C: ref only",
              "D": "D: LoRA + ref (no text)"}
    for j, c in enumerate(cols):
        d.text((90 + j * tw + 4, 6), labels[c], fill="red")
    for i, r in enumerate(rows):
        d.text((4, 24 + i * tw + tw // 2), f"{r['id']}\n{r['mood']}", fill="black")
        for j, c in enumerate(cols):
            im = refs[r["mood"]][1] if c == "ref" else Image.open(out / CONDITIONS[c] / f"{r['id']}.png")
            im = im.convert("RGB")
            im.thumbnail((tw - 4, tw - 4))
            sheet.paste(im, (90 + j * tw, 24 + i * tw))
    sheet.save(out / "grid.png")


if __name__ == "__main__":
    raise SystemExit(main())
