"""GPU 서버 생성 시험: 텍스트 인코더 + 트랜스포머(bf16) + LoRA 를 한 번에 올려 val 5장을 그린다.

노트북(ai/)의 10/23 시험(`20261023_klein_lora_fp8_768_s2000_style`)과 같은 프롬프트·seed·크기라서
노트북 결과를 --compare-dir 로 주면 나란히 비교하는 그림(compare.png)도 만든다.
노트북은 fp8 이고 서버는 bf16 이라 픽셀까지 같지는 않다. 구도·캐릭터·화풍이 같은지 본다.
val_002 는 동료 표현이 노트북 때(`pale blue coworker mochi with an ID badge`)와 달라서, compare.png 에서는 참고만 한다.

  python smoke_generate.py --gpu 4 --lora weights/20261023_train_qfloat8_r16.safetensors
  python smoke_generate.py --gpu 4 --lora ... --compare-dir ~/laptop_val     # val_001_s42.png ... 를 올려 둔 폴더

--gpu 는 배정받은 GPU 번호다 (공용 서버 규정: 반드시 지정).
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path

REPO = "black-forest-labs/FLUX.2-klein-4B"  # 추론: distilled 4B, 4-step, guidance 1.0
STYLE = "warm children's picture-book illustration, crayon and watercolor textures"
PROMPTS = {  # ai/ 10/23 시험과 같은 문장. val_002 만 동료 표현을 지금 prompt_rules.yaml 것으로 바꿨다
    "val_001": "mochi_char, calm, gaming, home bedroom, with a pale pink partner mochi with a tiny heart, "
               "rain on the window with soft gray light, medium shot",
    "val_002": "mochi_char, sad, eating, cozy cafe, with a small pale blue mochi with a tiny ID badge, "
               "soft overcast light through the window, full shot",
    "val_003": "mochi_char, angry, cooking, restaurant, sunny window light, small in a wide scene",
    "val_004": "mochi_char, neutral, resting, park, with a pale peach friend mochi, "
               "gentle snowfall and snowy ground, medium shot",
    "val_005": "mochi_char, happy, walking, scenic travel spot, with a round mochi-style kitten, "
               "bright sunny daylight, full shot",
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lora", required=True, help="LoRA .safetensors 경로")
    ap.add_argument("--out", default="outputs/smoke", help="결과 폴더")
    ap.add_argument("--gpu", type=int, required=True, help="배정받은 GPU 번호 (nvidia-smi 번호)")
    ap.add_argument("--res", type=int, default=768)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--compare-dir", default=None, help="노트북 결과 폴더 ({id}_s{seed}.png)")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    # 파일이 없으면 diffusers 가 경로를 HF repo id 로 보고 엉뚱한 에러를 내므로, 모델을 올리기 전에 막는다
    lora = Path(args.lora).expanduser()
    if not lora.is_file():
        ap.error(f"LoRA 파일이 없음: {lora.resolve()}")

    # torch 를 import 하기 전에 정해야 한다. 번호는 nvidia-smi 와 같은 순서(PCI 버스)로 센다
    os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
    os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu)

    import torch
    from diffusers import Flux2KleinPipeline

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    dev = torch.device("cuda:0")  # 보이는 GPU 는 배정받은 1장뿐
    torch.cuda.set_device(dev)

    t = time.perf_counter()
    pipe = Flux2KleinPipeline.from_pretrained(REPO, torch_dtype=torch.bfloat16)
    pipe.load_lora_weights(str(lora.parent), weight_name=lora.name, adapter_name="mochi")  # HF_HUB_OFFLINE=1 에서도 되게
    pipe.set_adapters(["mochi"], adapter_weights=[1.0])
    pipe.to(dev)
    torch.cuda.synchronize()
    load_sec = time.perf_counter() - t
    print(f"[load] 텍스트 인코더 + 트랜스포머 + VAE + LoRA (bf16) {load_sec:.1f}s, "
          f"VRAM {torch.cuda.memory_allocated() / 2**30:.1f}GB")

    def run(text: str):
        torch.cuda.synchronize()
        t0 = time.perf_counter()
        with torch.inference_mode():
            emb, _ = pipe.encode_prompt(prompt=text, device=dev, max_sequence_length=512)
        torch.cuda.synchronize()
        t1 = time.perf_counter()
        img = pipe(prompt_embeds=emb, height=args.res, width=args.res, num_inference_steps=4, guidance_scale=1.0,
                   generator=torch.Generator("cpu").manual_seed(args.seed)).images[0]  # 노트북과 같은 CPU 노이즈
        torch.cuda.synchronize()
        t2 = time.perf_counter()
        return img, t1 - t0, t2 - t1

    run(f"{PROMPTS['val_001']}, {STYLE}")  # warmup (측정 제외)
    torch.cuda.reset_peak_memory_stats()
    rows = []
    for pid, cap in PROMPTS.items():
        img, enc, gen = run(f"{cap}, {STYLE}")
        img.save(out / f"{pid}_s{args.seed}.png")
        rows.append({"id": pid, "encode_sec": round(enc, 3), "gen_sec": round(gen, 3), "total_sec": round(enc + gen, 3)})
        print(f"  {pid}: 인코딩 {enc:.2f}s + 생성 {gen:.2f}s = {enc + gen:.2f}s")

    summary = {
        "gpu": torch.cuda.get_device_name(dev), "torch": torch.__version__, "precision": "bf16",
        "res": args.res, "seed": args.seed, "lora": args.lora, "load_sec": round(load_sec, 2),
        "encode_sec_median": statistics.median(r["encode_sec"] for r in rows),
        "gen_sec_median": statistics.median(r["gen_sec"] for r in rows),
        "total_sec_median": statistics.median(r["total_sec"] for r in rows),
        "vram_peak_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2), "rows": rows,
    }
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[결과] 장당 중앙값 {summary['total_sec_median']:.2f}s "
          f"(인코딩 {summary['encode_sec_median']:.2f}s + 생성 {summary['gen_sec_median']:.2f}s), "
          f"VRAM 최고 {summary['vram_peak_gb']}GB → {out / 'summary.json'}")

    if args.compare_dir:
        from PIL import Image, ImageDraw
        tw = 384
        sheet = Image.new("RGB", (tw * 2, 20 + tw * len(PROMPTS)), "white")
        d = ImageDraw.Draw(sheet)
        d.text((4, 4), "laptop (fp8)", fill="red")
        d.text((tw + 4, 4), "server (bf16)", fill="red")
        for i, pid in enumerate(PROMPTS):
            for j, p in enumerate((Path(args.compare_dir) / f"{pid}_s{args.seed}.png", out / f"{pid}_s{args.seed}.png")):
                if p.exists():
                    im = Image.open(p).convert("RGB")
                    im.thumbnail((tw - 4, tw - 4))
                    sheet.paste(im, (j * tw, 20 + i * tw))
        sheet.save(out / "compare.png")
        print(f"[비교] {out / 'compare.png'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
