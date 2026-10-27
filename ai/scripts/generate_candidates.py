"""manifest 슬롯별 후보 이미지 생성 (슬롯당 3장).

- provider 는 scripts/providers.py 의 인터페이스로 교체 가능 (--provider 또는 .env IMAGE_PROVIDER_IMPL)
- anchor 가 아닌 슬롯은 outputs/anchors/{mood}.png 를 레퍼런스로 첨부 (없으면 경고 후 레퍼런스 없이)
- 저장: outputs/candidates/{slot_id}/{1,2,3}.png  (이미 n장이 있으면 건너뜀 → 재실행 안전)
- 실패 시 --retries 만큼 재시도 (지수 백오프)
- 로그: outputs/candidates/generation_log.jsonl (장수, 소요 시간, 비용)

권장 순서: anchors 먼저 생성 → curate_app 에서 anchor 선택 → 나머지 슬롯 생성
  python scripts/generate_candidates.py --splits anchor
  python scripts/generate_candidates.py --splits main_sheet,companion_sheet,scene
  python scripts/generate_candidates.py --provider dry_run --limit 3   # 프롬프트만 확인
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
from providers import Job, get_provider  # noqa: E402

CAND_DIR = OUTPUTS / "candidates"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provider", default=None, help="dry_run | external_api | klein_local")
    ap.add_argument("--splits", default="anchor,main_sheet,companion_sheet,scene")
    ap.add_argument("--slots", default=None, help="쉼표 구분 slot_id 지정")
    ap.add_argument("-n", "--per-slot", type=int, default=3)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--limit", type=int, default=None, help="슬롯 수 제한 (테스트용)")
    ap.add_argument("--no-ref", action="store_true", help="레퍼런스 이미지 첨부 안 함")
    ap.add_argument("--out", default=str(CAND_DIR))
    ap.add_argument("--manifest", default=str(DATASET / "manifest.csv"))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with open(args.manifest, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    splits = set(args.splits.split(","))
    rows = [r for r in rows if r["split"] in splits]
    if args.slots:
        want = set(args.slots.split(","))
        rows = [r for r in rows if r["slot_id"] in want]
    if args.limit:
        rows = rows[: args.limit]

    jobs: list[Job] = []
    skipped = 0
    for r in rows:
        d = out / r["slot_id"]
        have = {p.stem for p in d.glob("*.png")} if d.exists() else set()
        refs: list[Path] = []
        if not args.no_ref and r["split"] != "anchor":
            mood = r["mood"] if r["mood"] in ("happy", "calm", "neutral", "sad", "angry") else "neutral"
            a = ANCHORS_DIR / f"{mood}.png"
            if a.exists():
                refs = [a]
            else:
                print(f"[경고] anchor 없음({a.name}) → {r['slot_id']} 레퍼런스 없이 생성")
        for k in range(1, args.per_slot + 1):
            if str(k) in have:
                skipped += 1
                continue
            jobs.append(Job(key=f"{r['slot_id']}/{k}", prompt=r["prompt"], refs=refs, size=args.size,
                            seed=1000 * k + int(r["slot_id"].split("_")[1])))
    print(f"[plan] slots={len(rows)} new_images={len(jobs)} skipped_existing={skipped}")
    if not jobs:
        return 0

    prov = get_provider(args.provider)
    log_path = out / "generation_log.jsonl"
    made = failed = 0
    cost = 0.0
    pending = jobs
    not_impl = None
    for attempt in range(args.retries + 1):
        retry: list[Job] = []
        for job, img, sec, err in prov.generate_batch(pending):
            rec = {"time": now_iso(), "key": job.key, "provider": prov.name, "sec": round(sec, 2),
                   "attempt": attempt, "refs": [p.name for p in job.refs]}
            if img is not None:
                p = out / f"{job.key}.png"
                p.parent.mkdir(parents=True, exist_ok=True)
                img.save(p)
                made += 1
                cost += prov.cost_per_image_usd
                rec.update(ok=True, cost_usd=prov.cost_per_image_usd)
            else:
                rec.update(ok=False, error=err)
                retry.append(job)
                if "NotImplementedError" in (err or ""):
                    not_impl = err
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        failed = len(retry)
        if not retry or prov.name == "dry_run":
            break
        if not_impl:  # provider 미구현은 재시도해도 소용없음
            print(f"[중단] {not_impl}")
            break
        if attempt < args.retries:
            wait = 2 ** attempt * 5
            print(f"[retry] {len(retry)}건 실패 → {wait}s 후 재시도 ({attempt + 1}/{args.retries})")
            time.sleep(wait)
            pending = retry
    prov.close()
    print(f"[done] generated={made} failed={failed} cost_usd={cost:.2f} log={log_path}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
