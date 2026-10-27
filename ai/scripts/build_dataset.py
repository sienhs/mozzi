"""선택된 이미지로 학습 데이터셋 폴더를 만든다.

- manifest 에서 selected 가 1~3 인 main_sheet / companion_sheet / scene 슬롯 (anchor 는 학습 제외)
- outputs/candidates/{slot_id}/{selected}.png → outputs/datasets/v{N}/{file_name}
- 긴 변 1024px 기준 리사이즈 (LANCZOS), 같은 이름의 .txt 캡션 생성
- 선택 기준 축별 개수 재집계 + 부족 경고
- 데이터셋 정보: outputs/datasets/v{N}/dataset_info.json

예:
  python scripts/build_dataset.py                 # 다음 버전 번호 자동
  python scripts/build_dataset.py --version 2
  python scripts/build_dataset.py --candidates-dir outputs/smoke_candidates --auto-select 1 --name smoke
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATASET, OUTPUTS, now_iso  # noqa: E402

TRAIN_SPLITS = ("main_sheet", "companion_sheet", "scene")
WARN = {"mood": 6, "companion": 3, "weather": 6, "main_activity": 2}  # 기준 미만이면 경고
MOODS = ["happy", "calm", "neutral", "sad", "angry"]


def next_version(root: Path) -> int:
    nums = [int(p.name[1:]) for p in root.glob("v*") if p.name[1:].isdigit()]
    return max(nums, default=0) + 1


def resize_long(img: Image.Image, long_side: int) -> Image.Image:
    w, h = img.size
    s = long_side / max(w, h)
    if abs(s - 1) < 1e-6:
        return img
    return img.resize((round(w * s), round(h * s)), Image.LANCZOS)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", type=int, default=None)
    ap.add_argument("--name", default=None, help="버전 대신 폴더 이름 지정 (예: smoke)")
    ap.add_argument("--long-side", type=int, default=1024)
    ap.add_argument("--candidates-dir", default=str(OUTPUTS / "candidates"))
    ap.add_argument("--auto-select", type=int, default=None,
                    help="selected 가 비어 있으면 이 후보 번호를 사용 (스모크 테스트 전용)")
    ap.add_argument("--manifest", default=str(DATASET / "manifest.csv"))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    cand = Path(args.candidates_dir)
    root = OUTPUTS / "datasets"
    root.mkdir(parents=True, exist_ok=True)
    name = args.name or f"v{args.version or next_version(root)}"
    out = root / name
    if out.exists() and any(out.iterdir()):
        print(f"[오류] {out} 가 이미 있습니다. 다른 --version/--name 을 쓰세요.")
        return 2
    out.mkdir(parents=True, exist_ok=True)

    with open(args.manifest, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["split"] in TRAIN_SPLITS]

    used, missing = [], []
    for r in rows:
        sel = r["selected"] or (str(args.auto_select) if args.auto_select else "")
        if sel not in ("1", "2", "3"):
            continue
        src = cand / r["slot_id"] / f"{sel}.png"
        if not src.exists():
            missing.append(r["slot_id"])
            continue
        img = resize_long(Image.open(src).convert("RGB"), args.long_side)
        dst = out / r["file_name"]
        img.save(dst)
        dst.with_suffix(".txt").write_text(r["caption"] + "\n", encoding="utf-8")
        used.append(r)

    print(f"[dataset] {out}  images={len(used)}  (missing files: {len(missing)})")
    if missing:
        print("  missing:", ", ".join(missing))
    by_split = Counter(r["split"] for r in used)
    print("  split:", dict(by_split))

    scene = [r for r in used if r["split"] == "scene"]
    counts: dict[str, Counter] = {}
    for axis in ("mood", "main_activity", "place", "companion", "weather", "shot"):
        c = Counter(r[axis].split(":")[0] for r in scene)
        if axis == "mood":
            # 시트 이미지의 기분도 같이 센다 (표정 학습에 기여)
            c.update(r["mood"] for r in used if r["split"] != "scene" and r["mood"] in MOODS)
        if axis == "companion":
            c.update(r["companion"].split(":")[0] for r in used if r["split"] == "companion_sheet")
        counts[axis] = c
        print(f"  {axis:13s} " + "  ".join(f"{k}={v}" for k, v in sorted(c.items())))

    import yaml
    rules = yaml.safe_load(open(DATASET.parent / "configs" / "prompt_rules.yaml", encoding="utf-8"))
    expected = {"mood": MOODS, "main_activity": list(rules["activities"]),
                "weather": list(rules["weather"]), "companion": list(rules["companions"])}
    warnings = []
    for axis, thr in WARN.items():
        for v in expected[axis]:
            n = counts[axis].get(v, 0)
            if n < thr:
                warnings.append(f"{axis}={v}: {n}장 (< {thr})")
    for w in warnings:
        print(f"[경고] {w}")
    info = {"created": now_iso(), "name": name, "n_images": len(used), "split": dict(by_split),
            "counts": {k: dict(v) for k, v in counts.items()}, "warnings": warnings,
            "auto_select": args.auto_select, "candidates_dir": str(cand), "long_side": args.long_side}
    (out / "dataset_info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
