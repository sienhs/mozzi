"""manifest 를 외부 이미지 모델(웹 UI 수동 생성)용 프롬프트 목록으로 내보내기.

- 출력: dataset/prompts/generation_prompts.md (복사용, 순서: anchor → 시험 생성 → 나머지)
        dataset/prompts/generation_prompts.csv (같은 내용, 표 형식)
        dataset/prompts/captions_ko.md (캡션 한국어 요약, 보기용. 라벨: configs/labels_ko.yaml)
        dataset/prompts/eval_prompts_ko.md (val/test 프롬프트 한국어 요약, 보기용)
- 레퍼런스 (ref 열): design = 캐릭터 원본 디자인 mochi_{mood}.png (anchor 슬롯),
  anchor = 고른 anchor outputs/anchors/{mood}.png, style = 화풍 참고용 neutral anchor (동행 단독 시트)
- prompt 열은 레퍼런스 문장 없는 본문, ref_note 열이 레퍼런스를 첨부할 때 앞에 붙일 문장
  (md 에는 둘을 합쳐서 보여준다)
- 크기: 시트 1024x1024, 장면 SCENE_SIZE
- 저장 위치: outputs/candidates/{slot_id}/{1,2,3}.png  (curate_app 이 그대로 읽음)

예:
  python scripts/export_prompts.py
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CONFIGS, DATASET  # noqa: E402
from prompt_builder import load_rules  # noqa: E402

SHEET_SIZE = "1024x1024"
SCENE_SIZE = "1536x1024"  # 앱 표시 비율이 정해지면 맞춘다
MOODS = ("happy", "calm", "neutral", "sad", "angry")
LABELS_KO = CONFIGS / "labels_ko.yaml"


def ref_for(row: dict) -> tuple[str, str, str]:
    """(ref 종류, 사람이 읽는 첨부 파일, 앞에 붙일 reference_notes 키)."""
    if row["mood"] not in MOODS:  # 동행 단독 시트
        return "style", "outputs/anchors/neutral.png", "style_only"
    if row["split"] == "anchor":
        return "design", f"mochi_{row['mood']}.png (캐릭터 원본 디자인)", "character"
    return "anchor", f"outputs/anchors/{row['mood']}.png", "character"


def caption_ko(row: dict, ko: dict) -> str:
    """사람이 보기 위한 한국어 요약 (configs/labels_ko.yaml). 학습에는 쓰지 않는다."""
    comps = [ko["companions"][c] for c in re.split(r"[|+]", row["companion"]) if c and c != "alone"]
    shot = ko["shots"][row["shot"]]
    if row["split"] != "scene":
        if row["mood"] not in MOODS:
            return f"{comps[0]} 단독 (흰 모찌 없음), 서 있음, 단색 배경, {shot}"
        with_ = [f"{' + '.join(comps)}와 함께"] if comps else []
        return ", ".join(["모찌", ko["moods"][row["mood"]], "서 있음", "단색 배경", *with_, shot])
    parts = ["모찌", ko["moods"][row["mood"]], ko["activities"][row["main_activity"]], ko["places"][row["place"]]]
    if comps:
        parts.append(f"동행: {' + '.join(comps)}")
    parts.append(ko["weather"][row["weather"]])
    subs = [s for s in row["sub_activities"].split("|") if s]
    if subs:
        parts.append("소품: " + "·".join(ko["props"][s] for s in subs))
    if row["diary_detail"]:
        parts.append(f"디테일: {row['diary_detail']}")
    parts.append(shot)
    return ", ".join(p for p in parts if p)


def pick_trial(rows: list[dict]) -> list[str]:
    """시험 생성용 대표 슬롯: 메인 시트·동행 시트 1장씩 + 샷 종류별 장면."""
    want = [
        lambda r: r["split"] == "main_sheet" and "sheet-34" in r["main_activity"],
        lambda r: r["split"] == "companion_sheet" and r["mood"] not in MOODS,
        lambda r: r["split"] == "scene" and r["shot"] == "close_up",
        lambda r: r["split"] == "scene" and r["shot"] == "medium" and r["companion"] != "alone",
        lambda r: r["split"] == "scene" and r["shot"] == "small_in_scene",
    ]
    picked: list[str] = []
    for cond in want:
        hit = next((r for r in rows if cond(r) and r["slot_id"] not in picked), None)
        if hit:
            picked.append(hit["slot_id"])
    return picked


def write_eval_prompts_ko(rules: dict, ko: dict, prompts_dir: Path) -> Path:
    """val.csv / test.csv 의 한국어 요약 (보기용). LoRA 추론 입력 = 영어 캡션 (+ inference_style)."""
    lines = [
        "# 검증·평가 프롬프트 한국어 요약 (보기용)",
        "",
        "`scripts/export_prompts.py` 로 자동 생성 (원본: `val.csv`, `test.csv`). 라벨은 `configs/labels_ko.yaml`.",
        "",
        "- LoRA(`klein_lora`) 입력 = 영어 캡션 + 화풍 문구 (기본. 끄기: `infer.py --no-inference-style`):",
        f"  `, {rules['inference_style']}`",
        "- LoRA 없는 방법(`klein_base`, `klein_ref`, `api_ref`)은 긴 생성 프롬프트(`prompt` 열)를 쓴다.",
        "",
    ]
    for name in ("val", "test"):
        with open(prompts_dir / f"{name}.csv", newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        for s in dict.fromkeys(r["set"] for r in rows):
            rs = [r for r in rows if r["set"] == s]
            lines += [f"## {ko['sets'][s]} ({len(rs)}개)", "", "| id | 한국어 | 영어 캡션 |", "|---|---|---|"]
            for r in rs:
                text = caption_ko({**r, "split": "scene"}, ko)
                if r.get("diary_text"):
                    text += f" (일기: {r['diary_text']})"
                lines.append(f"| {r['id']} | {text} | `{r['caption']}` |")
            lines.append("")
    path = prompts_dir / "eval_prompts_ko.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", default=str(DATASET / "manifest.csv"))
    ap.add_argument("--out", default=str(DATASET / "prompts" / "generation_prompts"))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    rules = load_rules()
    notes = {k: " ".join(v.split()) for k, v in rules["reference_notes"].items()}
    ko = load_rules(LABELS_KO)
    with open(args.manifest, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    out_rows = []
    for r in rows:
        kind, ref, note = ref_for(r)
        out_rows.append({
            "slot_id": r["slot_id"],
            "split": r["split"],
            "mood": r["mood"],
            "size": SHEET_SIZE if r["split"] != "scene" else SCENE_SIZE,
            "ref": kind,
            "reference": ref,
            "save_as": f"outputs/candidates/{r['slot_id']}/{{1,2,3}}.png",
            "file_name": r["file_name"],
            "caption": r["caption"],
            "caption_ko": caption_ko(r, ko),
            "ref_note": notes[note],
            "prompt": r["prompt"],
        })

    trial = pick_trial(rows)
    by_id = {r["slot_id"]: r for r in out_rows}
    groups = [
        ("1단계: anchor 5장 (캐릭터 원본 디자인을 레퍼런스로, 가장 먼저)", [r for r in out_rows if r["split"] == "anchor"]),
        ("2단계: 시험 생성 (anchor 를 고른 뒤 레퍼런스로 첨부)", [by_id[s] for s in trial]),
        ("3단계: 나머지 전체", [r for r in out_rows if r["split"] != "anchor" and r["slot_id"] not in trial]),
    ]

    out = Path(args.out)
    with open(out.with_suffix(".csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0]))
        w.writeheader()
        for _, rs in groups:
            w.writerows(rs)

    lines = [
        "# 학습 이미지 생성 프롬프트",
        "",
        "`scripts/export_prompts.py` 로 자동 생성 (원본: `dataset/manifest.csv`). 직접 고치지 말고 규칙을 고친 뒤 다시 생성한다.",
        "",
        "- 슬롯마다 3장 생성 → `outputs/candidates/{slot_id}/1.png, 2.png, 3.png` 로 저장 → `curate_app.py` 에서 1장 선택",
        "- 레퍼런스: anchor 슬롯은 캐릭터 원본 디자인 `mochi_{mood}.png`, 나머지는 고른 anchor "
        "(`curate_app` 에서 고르면 `outputs/anchors/{mood}.png` 로 복사됨)",
        f"- 크기: 시트 {SHEET_SIZE}, 장면 {SCENE_SIZE}",
        "- 확인할 것: 캡션에 적힌 요소가 그림에 다 있는지, 흰 모찌가 정확히 한 마리인지(동행 단독 시트는 0마리), 글자·로고·사람 없는지",
        "",
    ]
    for title, rs in groups:
        lines += [f"## {title} ({len(rs)}개)", ""]
        for r in rs:
            lines += [
                f"### {r['slot_id']} · {r['file_name']}",
                f"- 크기 `{r['size']}` · 레퍼런스 `{r['reference']}` · 저장 `{r['save_as']}`",
                f"- 한국어: {r['caption_ko']}",
                f"- 캡션: `{r['caption']}`",
                "",
                "```text",
                r["ref_note"] + " " + r["prompt"],
                "```",
                "",
            ]
    out.with_suffix(".md").write_text("\n".join(lines), encoding="utf-8")

    # 한국어 캡션 목록 (보기용, slot_id 순)
    ko_lines = [
        "# 캡션 한국어 요약 (보기용)",
        "",
        "`scripts/export_prompts.py` 로 자동 생성. 라벨은 `configs/labels_ko.yaml`. **학습에는 영어 캡션만 쓴다.**",
        "",
    ]
    for split in ("anchor", "main_sheet", "companion_sheet", "scene"):
        rs = [r for r in out_rows if r["split"] == split]
        ko_lines += [f"## {ko['splits'][split]} ({len(rs)}개)", "",
                     "| slot_id | 한국어 | 영어 캡션 (학습용) | 파일명 |", "|---|---|---|---|"]
        ko_lines += [f"| {r['slot_id']} | {r['caption_ko']} | `{r['caption']}` | {r['file_name']} |" for r in rs]
        ko_lines.append("")
    ko_path = out.parent / "captions_ko.md"
    ko_path.write_text("\n".join(ko_lines), encoding="utf-8")
    write_eval_prompts_ko(rules, ko, out.parent)
    print(f"[export] {len(out_rows)}개 → {out.with_suffix('.md')} / .csv  (시험 생성: {', '.join(trial)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
