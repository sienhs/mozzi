"""요약 CSV → 발표용 비교표(.md)와 그래프(.png). 출력: results/report/{tag}/ (기본 tag = 오늘 날짜)

날짜 폴더마다 따로 저장하므로 이전 날짜의 리포트는 덮어쓰지 않는다 (같은 날 다시 실행하면 그날 폴더만 갱신).

  lora_comparison.md        LoRA 유무(방법별) 품질 비교 (해상도별, 같은 precision)
  quantization.md           klein_lora precision 비교: 품질 / latency / VRAM / 로딩 / fallback
  set_breakdown.md          test 세트별(combo/diary/multi/two_companions) 품질
  training.md               학습 비교: precision, rank, s/it, 소요 시간, 성공 여부
  quality_vs_speed.png      품질(dino_sim) vs 속도(latency 중앙값) 산점도
  checkpoint_sweep.md       체크포인트 step 별 품질 표 (dino_crop 최고 step 표시)
  step_curve.png            체크포인트 step 별 품질 변화 (dino_crop / clip_i / clip_t)
  sweep_grid_{prec}_{res}.png  val 프롬프트 × step 이미지 그리드
  grid_{prompt_id}.png      같은 프롬프트·seed 의 method × precision 이미지 그리드

같은 조합(method, precision, res, lora_step)이 여러 번 실행됐으면 가장 최근 success 행을 쓴다.

예:
  python scripts/make_report.py                       # → results/report/20261023/
  python scripts/make_report.py --since 20261023      # 10/20 동작 확인 실행 등 이전 기록 제외
  python scripts/make_report.py --tag 20261023_sweep  # 같은 날 여러 버전을 남길 때
  python scripts/make_report.py --grid-res 768 --grid-prompts test_combo_001,test_diary_001
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INFERENCE_SUMMARY, REPORT, RUNS, TRAINING_SUMMARY, today  # noqa: E402

METHOD_ORDER = ["klein_base", "klein_ref", "klein_lora", "api_ref"]
PREC_ORDER = ["bf16", "fp8", "gguf_q8", "gguf_q4", "na"]
TEST_SETS = ["test_combo", "test_diary", "test_multi", "test_two_companions"]
# infer.py run_id 접미사: 스윕 곡선에서 제외 (_style = 10/23 화풍 문구 시험, 지금은 기본값이라 접미사 없음)
SWEEP_VARIANT_SUFFIXES = ("_style", "_nostyle", "_offload")
# dataviz 기본 팔레트 (categorical slot 1~4, 고정 순서) + 텍스트/표면 토큰
COLORS = {"klein_base": "#2a78d6", "klein_ref": "#eb6834", "klein_lora": "#1baf7a", "api_ref": "#eda100"}
MARKERS = {"bf16": "o", "fp8": "s", "gguf_q8": "^", "gguf_q4": "D", "na": "P"}
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def f(x) -> float | None:
    try:
        return float(x) if x not in (None, "") else None
    except ValueError:
        return None


def fmt(x, nd=3) -> str:
    v = f(x)
    return "–" if v is None else f"{v:.{nd}f}"


def latest_by_key(rows: list[dict], key) -> dict:
    out = {}
    for r in rows:
        out[key(r)] = r  # CSV는 시간순 append → 마지막이 최신
    return out


def md_table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(lines)


def style_axes(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_facecolor(SURFACE)
    ax.set_title(title, loc="left", color=INK, fontsize=12, fontweight="bold")
    ax.set_xlabel(xlabel, color=INK2)
    ax.set_ylabel(ylabel, color=INK2)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)
    ax.tick_params(colors=INK2)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quality-precision", default="fp8", help="LoRA 유무 비교표에 쓸 precision")
    ap.add_argument("--grid-res", type=int, default=768)
    ap.add_argument("--grid-prompts", default=None, help="쉼표 구분 prompt id (기본: 세트별 첫 프롬프트)")
    ap.add_argument("--tag", default=today(), help="출력 폴더 results/report/{tag}/ (기본: 오늘 날짜. 이전 리포트는 그대로 남음)")
    ap.add_argument("--since", default=None, help="이 날짜(YYYYMMDD) 이후 실행만 포함 (예: 20261023)")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False

    out = REPORT / args.tag
    out.mkdir(parents=True, exist_ok=True)
    since = args.since or ""
    inf = [r for r in read_csv(INFERENCE_SUMMARY) if r["date"] >= since]
    ok = [r for r in inf if r["status"] == "success"]
    full = [r for r in ok if not r.get("lora_step")]          # 체크포인트 스윕 제외
    latest = latest_by_key(full, lambda r: (r["method"], r["precision"], r["resolution"]))
    written = []

    # 1. LoRA 유무 비교 -----------------------------------------------------
    rows = []
    for res in sorted({k[2] for k in latest}, key=int):
        for m in METHOD_ORDER:
            prec = "na" if m == "api_ref" else args.quality_precision
            r = latest.get((m, prec, res))
            if r:
                rows.append([res, m, prec, fmt(r["dino_sim"]), fmt(r["clip_i"]), fmt(r["clip_t"], 2),
                             fmt(r["dino_sim_crop"]), r.get("human_score") or "–", r["run_id"]])
    (out / "lora_comparison.md").write_text(
        f"# LoRA 유무 비교 (품질, precision={args.quality_precision})\n\n"
        "dino_sim/clip_i: anchors 대비 캐릭터 일관성, clip_t: 프롬프트 충실도, dino_sim_crop: 주인공 크롭 기준\n\n"
        + (md_table(["res", "method", "precision", "dino_sim", "clip_i", "clip_t", "dino_crop", "human", "run_id"], rows)
           if rows else "_아직 성공한 추론 실행이 없습니다._") + "\n", encoding="utf-8")
    written.append("lora_comparison.md")

    # 2. 양자화 비교 --------------------------------------------------------
    rows = []
    for r in sorted(inf, key=lambda r: (r["method"] != "klein_lora", r["method"], r["resolution"],
                                        PREC_ORDER.index(r["precision"]) if r["precision"] in PREC_ORDER else 9)):
        if r.get("lora_step") or not r["method"].startswith("klein"):
            continue
        if latest.get((r["method"], r["precision"], r["resolution"])) is not r and r["status"] == "success":
            continue
        rows.append([r["method"], r["precision"], r["resolution"], r["status"], fmt(r["dino_sim"]), fmt(r["clip_t"], 2),
                     fmt(r["latency_median_sec"], 2), fmt(r["latency_p90_sec"], 2), fmt(r["model_load_sec"], 1),
                     fmt(r["vram_peak_gb_torch"], 2), fmt(r["vram_peak_gb_smi"], 2), fmt(r["shared_peak_gb"], 2),
                     r["sysmem_fallback"] or "–", fmt(r["gpu_temp_max"], 0), (r.get("error") or "")[:60]])
    (out / "quantization.md").write_text(
        "# 양자화 비교 (klein 계열)\n\nlatency = 디노이즈 4-step + VAE 디코드 (텍스트 인코딩 제외, warmup 1장 제외)\n"
        "VRAM torch = max_memory_allocated, smi = NVML 디바이스 사용량 피크, shared = 공유 GPU 메모리 피크\n\n"
        + (md_table(["method", "precision", "res", "status", "dino_sim", "clip_t", "lat_med(s)", "lat_p90(s)",
                     "load(s)", "VRAM torch", "VRAM smi", "shared", "fallback", "temp", "error"], rows)
           if rows else "_기록 없음_") + "\n", encoding="utf-8")
    written.append("quantization.md")

    # 3. 세트별 품질 --------------------------------------------------------
    rows = []
    for r in latest.values():
        mp = RUNS / r["run_id"] / "metrics.json"
        if not mp.exists():
            continue
        q = json.loads(mp.read_text(encoding="utf-8")).get("quality") or {}
        for s in TEST_SETS:
            if s in q:
                rows.append([r["method"], r["precision"], r["resolution"], s, str(q[s]["n"]), fmt(q[s]["dino_sim"]),
                             fmt(q[s]["clip_t"], 2), fmt(q[s].get("dino_sim_crop"))])
    rows.sort()
    (out / "set_breakdown.md").write_text(
        "# test 세트별 품질\n\n" + (md_table(["method", "precision", "res", "set", "n", "dino_sim", "clip_t", "dino_crop"], rows)
                                    if rows else "_기록 없음 (outputs/runs 이 있는 PC에서 실행)_") + "\n", encoding="utf-8")
    written.append("set_breakdown.md")

    # 4. 학습 비교 ----------------------------------------------------------
    tr = [r for r in read_csv(TRAINING_SUMMARY) if r["date"] >= since]
    rows = [[r["run_id"], r["train_precision"], r["rank"], r["resolution"], r["status"],
             f"{r['steps_done']}/{r['steps_target']}", fmt(r["sec_per_it"], 2), fmt(r["est_total_hours"], 2),
             fmt(f(r["sec_per_it"]) * 2000 / 3600 if f(r["sec_per_it"]) else None, 2),
             fmt(r["total_train_min"], 1), fmt(r["vram_peak_gb_smi"], 2), fmt(r["shared_peak_gb"], 2),
             r["sysmem_fallback"] or "–", fmt(r["ram_peak_gb"], 1), (r.get("error") or "")[:60]] for r in tr]
    (out / "training.md").write_text(
        "# 학습 비교\n\n" + (md_table(["run_id", "precision", "rank", "res", "status", "steps", "s/it",
                                     "예상 총(h)", "2000step 환산(h)", "소요(min)", "VRAM smi", "shared", "fallback", "RAM", "error"], rows)
                           if rows else "_기록 없음_") + "\n", encoding="utf-8")
    written.append("training.md")

    # 5. 품질 vs 속도 -------------------------------------------------------
    pts = [r for r in latest.values() if f(r["latency_median_sec"]) is not None and f(r["dino_sim"]) is not None]
    if pts:
        for res in sorted({r["resolution"] for r in pts}, key=int):
            sub = [r for r in pts if r["resolution"] == res]
            fig, ax = plt.subplots(figsize=(8, 5), facecolor=SURFACE)
            for r in sub:
                ax.scatter(f(r["latency_median_sec"]), f(r["dino_sim"]), s=80, c=COLORS.get(r["method"], INK2),
                           marker=MARKERS.get(r["precision"], "o"), edgecolors=SURFACE, linewidths=2, zorder=3)
                ax.annotate(f"{r['method'].replace('klein_', '')}/{r['precision']}",
                            (f(r["latency_median_sec"]), f(r["dino_sim"])), textcoords="offset points",
                            xytext=(7, 5), fontsize=8, color=INK2)
            style_axes(ax, f"품질 vs 속도 ({res}px)", "latency 중앙값 (초/장, 낮을수록 빠름)", "dino_sim (높을수록 캐릭터 일관)")
            from matplotlib.lines import Line2D
            h = [Line2D([], [], color=COLORS[m], marker="o", linestyle="", label=m) for m in METHOD_ORDER
                 if any(r["method"] == m for r in sub)]
            h += [Line2D([], [], color=INK2, marker=MARKERS[p], linestyle="", label=p) for p in PREC_ORDER
                  if any(r["precision"] == p for r in sub)]
            ax.legend(handles=h, frameon=False, fontsize=8, loc="best", labelcolor=INK2)
            fig.tight_layout()
            name = f"quality_vs_speed_{res}.png"
            fig.savefig(out / name, dpi=160)
            plt.close(fig)
            written.append(name)

    # 6. step 곡선 (두 지표를 나란히: 이중 축 금지) ------------------------
    from PIL import Image
    # 프롬프트 변형 실행(run_id 에 _style 등)은 같은 lora_step 이라도 스윕에서 뺀다
    sw = [r for r in ok if r.get("lora_step") and not r["run_id"].endswith(SWEEP_VARIANT_SUFFIXES)]
    if sw:
        groups: dict = {}
        for r in sorted(sw, key=lambda r: r["run_id"]):  # 같은 step 재실행이면 최근 것
            groups.setdefault((r["precision"], r["resolution"]), {})[int(r["lora_step"])] = r
        md = ["# 체크포인트 스윕 (klein_lora, val 12개, distilled 4-step)", "",
              "dino_crop: 주인공 크롭 vs anchor (캐릭터 일관성, 주 지표) · clip_i: 이미지 전체 vs anchor · "
              "clip_t: 프롬프트 충실도 · dino_sim: 이미지 전체 vs anchor (배경 영향 큼)", ""]
        for (prec, res), d in sorted(groups.items()):
            best = max(d, key=lambda s: f(d[s]["dino_sim_crop"]) or -1)
            md += [f"## {prec} / {res}", "", md_table(
                ["step", "dino_crop", "clip_i", "clip_t", "dino_sim", "lat_med(s)", "VRAM torch", "fallback", "run_id"],
                [[f"**{s}**" if s == best else str(s), fmt(d[s]["dino_sim_crop"]), fmt(d[s]["clip_i"]),
                  fmt(d[s]["clip_t"], 2), fmt(d[s]["dino_sim"]), fmt(d[s]["latency_median_sec"], 2),
                  fmt(d[s]["vram_peak_gb_torch"], 2), d[s]["sysmem_fallback"], d[s]["run_id"]] for s in sorted(d)]),
                   "", f"굵게 = dino_crop 최고. 숫자만으로 고르지 말고 `sweep_grid_{prec}_{res}.png` 를 같이 본다.", ""]
        (out / "checkpoint_sweep.md").write_text("\n".join(md), encoding="utf-8")
        written.append("checkpoint_sweep.md")

        for (prec, res), d in sorted(groups.items()):
            steps = sorted(d)
            pps = {s: read_csv(RUNS / d[s]["run_id"] / "per_prompt.csv") for s in steps}
            pids = [x["id"] for x in pps[steps[-1]]]
            fig, axes = plt.subplots(len(pids), len(steps), figsize=(1.7 * len(steps), 1.25 * len(pids)),
                                     facecolor=SURFACE, squeeze=False)
            for i, pid in enumerate(pids):
                for j, s in enumerate(steps):
                    ax = axes[i][j]
                    ax.set_xticks([])
                    ax.set_yticks([])
                    for sp in ax.spines.values():
                        sp.set_color(GRID)
                    hit = next((x for x in pps[s] if x["id"] == pid), None)
                    p = RUNS / d[s]["run_id"] / "images" / hit["image"] if hit else None
                    if p and p.exists():
                        im = Image.open(p)
                        im.thumbnail((320, 320))
                        ax.imshow(im)
                    if i == 0:
                        ax.set_title(f"step {s}", color=INK, fontsize=8)
                    if j == 0:
                        ax.set_ylabel(pid, color=INK, fontsize=7)
            fig.tight_layout()
            name = f"sweep_grid_{prec}_{res}.png"
            fig.savefig(out / name, dpi=100)
            plt.close(fig)
            written.append(name)

        fig, axes = plt.subplots(1, 3, figsize=(15, 4.2), facecolor=SURFACE)
        for ax, metric, label in ((axes[0], "dino_sim_crop", "dino_crop (캐릭터 일관성)"),
                                  (axes[1], "clip_i", "clip_i (anchor 유사도)"),
                                  (axes[2], "clip_t", "clip_t (프롬프트 충실도)")):
            for i, ((prec, res), d) in enumerate(sorted(groups.items())):
                steps = sorted(d)
                ys = [f(d[s][metric]) for s in steps]
                col = list(COLORS.values())[i % 4]
                ax.plot(steps, ys, color=col, linewidth=2, marker="o", markersize=6, label=f"{prec}/{res}")
                if ys and ys[-1] is not None:
                    ax.annotate(f"{ys[-1]:.3f}", (steps[-1], ys[-1]), textcoords="offset points", xytext=(5, 0),
                                fontsize=8, color=INK2)
            style_axes(ax, label, "학습 step", metric)
        if len(groups) > 1:
            axes[2].legend(frameon=False, fontsize=8, labelcolor=INK2)
        fig.tight_layout()
        fig.savefig(out / "step_curve.png", dpi=160)
        plt.close(fig)
        written.append("step_curve.png")

    # 7. 이미지 그리드 ------------------------------------------------------
    from PIL import Image
    cells = {(r["method"], r["precision"]): r for r in latest.values() if r["resolution"] == str(args.grid_res)}
    if cells:
        methods = [m for m in METHOD_ORDER if any(k[0] == m for k in cells)]
        precs = [p for p in PREC_ORDER if any(k[1] == p for k in cells)]
        if args.grid_prompts:
            pids = args.grid_prompts.split(",")
        else:
            any_run = RUNS / next(iter(cells.values()))["run_id"] / "per_prompt.csv"
            pp = read_csv(any_run)
            pids = [next((x["id"] for x in pp if x["set"] == s), None) for s in TEST_SETS]
            pids = [p for p in pids if p]
        for pid in pids:
            fig, axes = plt.subplots(len(methods), len(precs), figsize=(2.6 * len(precs), 2.8 * len(methods)),
                                     facecolor=SURFACE, squeeze=False)
            caption = ""
            for i, m in enumerate(methods):
                for j, p in enumerate(precs):
                    ax = axes[i][j]
                    ax.set_xticks([])
                    ax.set_yticks([])
                    for s in ax.spines.values():
                        s.set_color(GRID)
                    r = cells.get((m, p))
                    img = None
                    if r:
                        pp = read_csv(RUNS / r["run_id"] / "per_prompt.csv")
                        hit = next((x for x in pp if x["id"] == pid), None)
                        if hit and (RUNS / r["run_id"] / "images" / hit["image"]).exists():
                            img = Image.open(RUNS / r["run_id"] / "images" / hit["image"])
                            caption = caption or hit.get("caption", "")
                    if img is not None:
                        ax.imshow(img)
                    else:
                        ax.set_facecolor(SURFACE)
                        ax.text(0.5, 0.5, "없음", ha="center", va="center", color=INK2, transform=ax.transAxes)
                    if i == 0:
                        ax.set_title(p, color=INK, fontsize=10)
                    if j == 0:
                        ax.set_ylabel(m, color=INK, fontsize=10)
            fig.suptitle(f"{pid} ({args.grid_res}px)\n{caption[:110]}", color=INK, fontsize=9, x=0.01, ha="left")
            fig.tight_layout()
            name = f"grid_{pid}_{args.grid_res}.png"
            fig.savefig(out / name, dpi=110)
            plt.close(fig)
            written.append(name)

    print("[report] " + ", ".join(written) + f"  → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
