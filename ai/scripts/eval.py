"""실행 폴더의 이미지 품질 지표 계산.

지표
  dino_sim   anchors 대비 DINOv2(facebook/dinov2-base) CLS 임베딩 코사인 유사도 (캐릭터 일관성)
  clip_i     anchors 대비 CLIP(openai/clip-vit-large-patch14) 이미지 임베딩 코사인 유사도
  clip_t     이미지-텍스트 CLIP 점수 (100 × cos). 텍스트 = 캡션에서 트리거 단어를 'a white mochi character'로
             바꾼 장면 문장 (CLIP 77토큰 제한으로 잘림)
  dino_sim_crop (--crop) 주인공 크롭 기준 DINOv2 유사도. OWLv2 로 'white round mochi' 를 검출해서
             가장 큰 박스(= 장면 규칙상 주인공)를 잘라 anchor 와 비교. 동행이 있는 장면에서 배경/동행 영향을 줄인다.
기준 anchor: 같은 mood 의 outputs/anchors/{mood}.png (mood 를 모르면 5장 평균)

결과
  per_prompt.csv 에 컬럼 채움, metrics.json["quality"] 에 전체 + 세트별 평균,
  results/inference_summary.csv 의 해당 run_id 행 갱신

예:
  python scripts/eval.py outputs/runs/20261019_klein_lora_fp8_768
  python scripts/eval.py outputs/runs/<run_id> --crop
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ANCHORS_DIR, INFERENCE_COLUMNS, INFERENCE_SUMMARY, upsert_csv  # noqa: E402

DINO = "facebook/dinov2-base"
CLIP = "openai/clip-vit-large-patch14"
OWL = "google/owlv2-base-patch16-ensemble"
MOODS = ["happy", "calm", "neutral", "sad", "angry"]


class Embedder:
    def __init__(self, device: str):
        from transformers import AutoImageProcessor, AutoModel, CLIPModel, CLIPProcessor
        self.device = device
        self.dino_proc = AutoImageProcessor.from_pretrained(DINO)
        self.dino = AutoModel.from_pretrained(DINO).to(device).eval()
        self.clip_proc = CLIPProcessor.from_pretrained(CLIP)
        self.clip = CLIPModel.from_pretrained(CLIP).to(device).eval()

    @torch.inference_mode()
    def dino_emb(self, img: Image.Image) -> torch.Tensor:
        x = self.dino_proc(images=img, return_tensors="pt").to(self.device)
        v = self.dino(**x).last_hidden_state[:, 0]
        return torch.nn.functional.normalize(v, dim=-1)[0]

    @torch.inference_mode()
    def clip_img(self, img: Image.Image) -> torch.Tensor:
        x = self.clip_proc(images=img, return_tensors="pt").to(self.device)
        v = self.clip.get_image_features(**x)
        v = v if isinstance(v, torch.Tensor) else v.pooler_output
        return torch.nn.functional.normalize(v, dim=-1)[0]

    @torch.inference_mode()
    def clip_txt(self, text: str) -> torch.Tensor:
        x = self.clip_proc(text=[text], return_tensors="pt", padding=True, truncation=True, max_length=77).to(self.device)
        v = self.clip.get_text_features(**x)
        v = v if isinstance(v, torch.Tensor) else v.pooler_output
        return torch.nn.functional.normalize(v, dim=-1)[0]


class MochiCropper:
    """OWLv2 오픈 보캐블러리 검출로 흰 모찌(주인공) 크롭."""

    def __init__(self, device: str):
        from transformers import Owlv2ForObjectDetection, Owlv2Processor
        self.device = device
        self.proc = Owlv2Processor.from_pretrained(OWL)
        self.model = Owlv2ForObjectDetection.from_pretrained(OWL).to(device).eval()
        self.queries = [["a white round mochi character", "a white rice cake character"]]

    @torch.inference_mode()
    def crop(self, img: Image.Image, thr: float = 0.15) -> Image.Image | None:
        x = self.proc(text=self.queries, images=img, return_tensors="pt").to(self.device)
        out = self.model(**x)
        size = max(img.size)  # OWLv2 는 정사각 패딩 기준 좌표
        # transformers 5.x: Owlv2Processor.post_process_grounded_object_detection (구 post_process_object_detection)
        res = self.proc.post_process_grounded_object_detection(out, threshold=thr,
                                                      target_sizes=torch.tensor([[size, size]], device=self.device))[0]
        if len(res["boxes"]) == 0:
            return None
        boxes = res["boxes"].tolist()
        x0, y0, x1, y1 = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        w, h = img.size
        pad = 0.08 * max(x1 - x0, y1 - y0)
        box = (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
        return img.crop(tuple(int(v) for v in box))


def scene_text(caption: str, text: str) -> str:
    base = caption or text
    return base.replace("mochi_char", "a white mochi character")


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run_dir")
    ap.add_argument("--crop", action="store_true", help="OWLv2 주인공 크롭 유사도도 계산")
    ap.add_argument("--anchors-dir", default=str(ANCHORS_DIR))
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--no-summary", action="store_true", help="results/inference_summary.csv 를 갱신하지 않음 (진단용)")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    run_dir = Path(args.run_dir)
    pp_path = run_dir / "per_prompt.csv"
    with open(pp_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = list(reader.fieldnames or [])
        rows = list(reader)
    if not rows:
        print("[eval] per_prompt.csv 가 비어 있음 (추론 실패 run)")
        return 2

    anchors_dir = Path(args.anchors_dir)
    anchors = {m: anchors_dir / f"{m}.png" for m in MOODS if (anchors_dir / f"{m}.png").exists()}
    if not anchors:
        print(f"[eval] anchors 없음 ({anchors_dir}) → dino_sim/clip_i 는 비우고 clip_t 만 계산")

    emb = Embedder(args.device)
    a_dino = {m: emb.dino_emb(Image.open(p).convert("RGB")) for m, p in anchors.items()}
    a_clip = {m: emb.clip_img(Image.open(p).convert("RGB")) for m, p in anchors.items()}
    cropper = MochiCropper(args.device) if (args.crop and anchors) else None

    def ref(table, mood):
        if mood in table:
            return [table[mood]]
        return list(table.values())

    for i, r in enumerate(rows):
        img = Image.open(run_dir / "images" / r["image"]).convert("RGB")
        d = emb.dino_emb(img)
        c = emb.clip_img(img)
        if anchors:
            r["dino_sim"] = f"{mean([float(d @ a) for a in ref(a_dino, r.get('mood'))]):.4f}"
            r["clip_i"] = f"{mean([float(c @ a) for a in ref(a_clip, r.get('mood'))]):.4f}"
        t = emb.clip_txt(scene_text(r.get("caption", ""), r.get("text", "")))
        r["clip_t"] = f"{100 * max(float(c @ t), 0):.3f}"
        if cropper:
            cr = cropper.crop(img)
            if cr is not None:
                dc = emb.dino_emb(cr)
                r["dino_sim_crop"] = f"{mean([float(dc @ a) for a in ref(a_dino, r.get('mood'))]):.4f}"
        if (i + 1) % 10 == 0:
            print(f"[eval] {i + 1}/{len(rows)}")

    for k in ("dino_sim", "clip_i", "clip_t", "dino_sim_crop", "human_score"):
        if k not in cols:
            cols.append(k)
    with open(pp_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    def agg(rs):
        def m(k):
            return mean([float(x[k]) for x in rs if x.get(k) not in (None, "")])
        out = {k: m(k) for k in ("dino_sim", "clip_i", "clip_t", "dino_sim_crop")}
        out["n"] = len(rs)
        comp = [x for x in rs if x.get("companion") not in ("", "alone", None)]
        out["dino_sim_with_companion"] = mean([float(x["dino_sim"]) for x in comp if x.get("dino_sim")])
        return out

    by_set = defaultdict(list)
    for r in rows:
        by_set[r.get("set") or "all"].append(r)
    quality = {"all": agg(rows), **{s: agg(rs) for s, rs in sorted(by_set.items())},
               "anchors": {m: str(p) for m, p in anchors.items()}, "crop_method": "owlv2-largest-box" if cropper else None}

    mpath = run_dir / "metrics.json"
    metrics = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else {"run_id": run_dir.name}
    metrics["quality"] = quality
    mpath.write_text(json.dumps(metrics, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    if not args.no_summary:
        upsert_csv(INFERENCE_SUMMARY, INFERENCE_COLUMNS, {
            "run_id": metrics.get("run_id", run_dir.name),
            **{k: quality["all"][k] for k in ("dino_sim", "clip_i", "clip_t", "dino_sim_crop")},
        })
    print(json.dumps(quality, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
