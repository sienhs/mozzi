"""후보 큐레이션 로컬 웹 UI (Gradio).

- 슬롯별 후보 3장을 나란히 보여주고, 이미지(또는 아래 버튼)를 클릭하면 선택
- 선택 시 manifest.csv 의 selected(후보 번호 1~3)와 file_name 을 갱신
- 전부 탈락이면 selected=reject (generate_candidates.py 로 해당 슬롯 폴더를 지우고 재생성)
- anchor 슬롯을 선택하면 outputs/anchors/{mood}.png 로 복사 (이후 생성·평가의 레퍼런스)
- 탈락 사유는 outputs/candidates/curation_log.csv 에 기록

실행:  python scripts/curate_app.py   →  http://127.0.0.1:7860
"""
from __future__ import annotations

import argparse
import csv
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ANCHORS_DIR, DATASET, OUTPUTS, now_iso  # noqa: E402

CAND_DIR = OUTPUTS / "candidates"
MANIFEST = DATASET / "manifest.csv"
LOG = CAND_DIR / "curation_log.csv"

REJECT_CHECKLIST = [
    "외곽선이나 볼 모양 불일치",
    "손가락 있음",
    "글자 있음",
    "주인공 흰 모찌가 2마리 이상",
    "동행 색이 고정 표현과 다르거나, 주인공과 크기·색이 헷갈림",
    "사람이 등장함",
    "날씨 표현이 안 보임",
    "화풍 불일치",
]


def read_manifest() -> tuple[list[str], list[dict]]:
    with open(MANIFEST, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames or []), list(r)


def write_manifest(cols: list[str], rows: list[dict]) -> None:
    tmp = MANIFEST.with_suffix(".tmp")
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    tmp.replace(MANIFEST)


def log_decision(slot: str, choice: str, reasons: list[str], note: str) -> None:
    new = not LOG.exists()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["time", "slot_id", "choice", "reject_reasons", "note"])
        w.writerow([now_iso(), slot, choice, " / ".join(reasons), note])


def candidates(slot: str) -> list[str | None]:
    return [str(p) if (p := CAND_DIR / slot / f"{k}.png").exists() else None for k in (1, 2, 3)]


def build_ui(filter_default: str):
    import gradio as gr

    cols, rows = read_manifest()
    slot_ids = [r["slot_id"] for r in rows]

    def visible_slots(flt: str) -> list[str]:
        _, rs = read_manifest()
        out = []
        for r in rs:
            has = any(candidates(r["slot_id"]))
            if flt == "미선택(후보 있음)" and (r["selected"] or not has):
                continue
            if flt == "탈락(reject)" and r["selected"] != "reject":
                continue
            out.append(r["slot_id"])
        return out or slot_ids[:1]

    def info(slot: str) -> str:
        _, rs = read_manifest()
        r = next(x for x in rs if x["slot_id"] == slot)
        done = sum(1 for x in rs if x["selected"] not in ("", "reject"))
        return (f"### {slot} · {r['split']}  (선택 완료 {done}/{len(rs)})\n"
                f"- **mood** {r['mood']} · **activity** {r['main_activity']} · **sub** {r['sub_activities'] or '-'}\n"
                f"- **place** {r['place']} · **companion** {r['companion']} · **weather** {r['weather']} · "
                f"**shot** {r['shot']}\n- **file_name** `{r['file_name']}` · **selected** `{r['selected'] or '-'}`\n\n"
                f"**caption**: `{r['caption']}`")

    def show(slot: str):
        c = candidates(slot)
        return [info(slot), *c, []]

    def choose(slot: str, k: int, reasons: list[str], note: str):
        cs, rs = read_manifest()
        r = next(x for x in rs if x["slot_id"] == slot)
        src = CAND_DIR / slot / f"{k}.png"
        if not src.exists():
            return info(slot) + f"\n\n⚠️ 후보 {k} 없음"
        r["selected"] = str(k)
        if not r["file_name"]:
            r["file_name"] = f"{slot}.png"
        write_manifest(cs, rs)
        log_decision(slot, str(k), reasons, note)
        if r["split"] == "anchor":
            ANCHORS_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, ANCHORS_DIR / f"{r['mood']}.png")
        return info(slot) + f"\n\n✅ 후보 {k} 선택됨"

    def reject(slot: str, reasons: list[str], note: str):
        cs, rs = read_manifest()
        r = next(x for x in rs if x["slot_id"] == slot)
        r["selected"] = "reject"
        write_manifest(cs, rs)
        log_decision(slot, "reject", reasons, note)
        return info(slot) + "\n\n❌ 전체 탈락 (재생성 필요)"

    def step(slot: str, flt: str, d: int):
        vs = visible_slots(flt)
        i = vs.index(slot) if slot in vs else -1
        nxt = vs[max(0, min(len(vs) - 1, i + d))]
        return gr.update(choices=vs, value=nxt)

    with gr.Blocks(title="모찌 후보 큐레이션") as demo:
        gr.Markdown("# 모찌 후보 큐레이션\n이미지를 클릭하면 그 후보가 선택됩니다. 아래 탈락 기준에 하나라도 걸리면 고르지 마세요.")
        with gr.Row():
            flt = gr.Radio(["전체", "미선택(후보 있음)", "탈락(reject)"], value=filter_default, label="필터")
            slot = gr.Dropdown(choices=visible_slots(filter_default), value=visible_slots(filter_default)[0],
                               label="slot", allow_custom_value=False)
            prev_b = gr.Button("◀ 이전")
            next_b = gr.Button("다음 ▶")
        meta = gr.Markdown()
        imgs, btns = [], []
        with gr.Row():
            for k in (1, 2, 3):
                with gr.Column():
                    imgs.append(gr.Image(label=f"후보 {k}", type="filepath", interactive=False, height=420))
                    btns.append(gr.Button(f"후보 {k} 선택", variant="primary"))
        with gr.Row():
            reasons = gr.CheckboxGroup(REJECT_CHECKLIST, label="탈락 기준 체크리스트 (해당 사항 기록용)")
            with gr.Column():
                note = gr.Textbox(label="메모", lines=2)
                rej = gr.Button("전체 탈락 (재생성)", variant="stop")

        slot.change(show, slot, [meta, *imgs, reasons])
        flt.change(lambda s, f: step(s, f, 0), [slot, flt], slot)
        prev_b.click(lambda s, f: step(s, f, -1), [slot, flt], slot)
        next_b.click(lambda s, f: step(s, f, 1), [slot, flt], slot)
        for k, (im, b) in enumerate(zip(imgs, btns), 1):
            b.click(lambda s, r, n, k=k: choose(s, k, r, n), [slot, reasons, note], meta)
            im.select(lambda s, r, n, k=k: choose(s, k, r, n), [slot, reasons, note], meta)
        rej.click(reject, [slot, reasons, note], meta)
        demo.load(show, slot, [meta, *imgs, reasons])
    return demo


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=7860)
    ap.add_argument("--filter", default="미선택(후보 있음)", choices=["전체", "미선택(후보 있음)", "탈락(reject)"])
    args = ap.parse_args()
    demo = build_ui(args.filter)
    demo.launch(server_name="127.0.0.1", server_port=args.port, allowed_paths=[str(CAND_DIR)])


if __name__ == "__main__":
    main()
