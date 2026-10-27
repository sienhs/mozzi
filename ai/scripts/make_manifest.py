"""데이터셋 manifest와 홀드아웃 프롬프트 생성.

출력:
  dataset/manifest.csv            슬롯 목록 (anchor 5 / main_sheet 10 / companion_sheet 6 / scene 40)
  dataset/captions/*.txt          학습 캡션 (파일명 = manifest.file_name 의 stem)
  dataset/prompts/val.txt         검증 캡션 12줄 (학습 중 샘플 생성용)
  dataset/prompts/val.csv         val 입력값 + prompt/caption (평가용)
  dataset/prompts/test.csv        test 세트 (set 컬럼으로 세트별 집계)
  dataset/prompts/seeds.txt       고정 seed 목록
  dataset/excluded_combos.csv     제외 규칙으로 빠진 조합 목록

scene 할당:
  각 축의 값 목록을 할당량대로 정확히 만든 뒤, 열 내부 swap만 하는 simulated annealing으로
  (1) 제외 규칙 위반 0, (2) 모든 활동이 2가지 이상 기분, (3) 두 축 조합의 sum(count^2) 최소화
  (= pairwise 다양성 최대화)를 맞춘다. swap은 열 안에서만 일어나므로 할당량은 항상 정확하다.

사용:
  python scripts/make_manifest.py              # seed 20261019
  python scripts/make_manifest.py --seed 7 --iters 200000
"""
from __future__ import annotations

import argparse
import csv
import itertools
import math
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATASET, PROMPTS  # noqa: E402
from prompt_builder import (AppInput, build_caption, build_prompt, build_sheet_caption,  # noqa: E402
                            build_sheet_prompt, load_rules, parse_companion, validate)

# ---------------------------------------------------------------------------
# 데이터셋 사양 (README "데이터셋 사양"과 동일하게 유지)
# ---------------------------------------------------------------------------
SCENE_N = 40
EXTRA_ACTIVITY = "eating"  # 13종 × 3 + 1 의 추가 1장 (장소 선택지가 가장 넓은 활동)
PLACE_QUOTA = {"home": 12, "cafe": 6, "office_school": 6, "park": 6, "restaurant": 5, "travel_spot": 5}
COMPANION_QUOTA = {"alone": 20, "friend": 4, "family": 4, "partner": 4, "coworker": 4, "pet": 4}
WEATHER_QUOTA = {"sunny": 13, "cloudy": 9, "rainy": 9, "snowy": 9}
SHOT_QUOTA = {"close_up": 8, "medium": 20, "full": 6, "small_in_scene": 6}  # 20% / 50% / 30%
SUB_PROP_ROWS = 15          # 서브 활동 소품이 있는 장면 수
SUB_PROP_TWO = 5            # 그중 소품 2개인 장면 수
MIN_MOODS_PER_ACTIVITY = 2

HOLDOUT = {"val": 12, "test_combo": 24, "test_diary": 6, "test_multi": 6, "test_two_companions": 4}
TWO_COMPANION_SETS = [["family:2"], ["friend", "pet:puppy"], ["partner", "pet:kitten"], ["friend", "coworker"]]
SEEDS = [42, 1234, 2025, 777, 31337, 9001, 1019, 55]

COLS = ["main_activity", "mood", "place", "companion", "weather", "shot"]
MANIFEST_COLUMNS = ["slot_id", "split", "mood", "main_activity", "sub_activities", "place", "companion",
                    "weather", "diary_detail", "shot", "prompt", "caption", "file_name", "selected", "owner"]
PROMPT_COLUMNS = ["id", "set", "prompt", "caption", "mood", "main_activity", "sub_activities", "place",
                  "companion", "weather", "diary_text", "diary_detail", "shot"]


# ---------------------------------------------------------------------------
def quota_lists(rules: dict) -> dict[str, list[str]]:
    acts = list(rules["activities"])
    act_list = [a for a in acts for _ in range(3)] + [EXTRA_ACTIVITY]
    moods = list(rules["moods"])
    per = SCENE_N // len(moods)
    q = {
        "main_activity": act_list,
        "mood": [m for m in moods for _ in range(per)],
        "place": [p for p, n in PLACE_QUOTA.items() for _ in range(n)],
        "companion": [c for c, n in COMPANION_QUOTA.items() for _ in range(n)],
        "weather": [w for w, n in WEATHER_QUOTA.items() for _ in range(n)],
        "shot": [s for s, n in SHOT_QUOTA.items() for _ in range(n)],
    }
    for k, v in q.items():
        assert len(v) == SCENE_N, (k, len(v))
    return q


def row_violations(rules: dict, row: list[str]) -> int:
    act, mood, place, comp, weather, shot = row
    v = 0
    if place not in rules["activities"][act]["places"]:
        v += 1
    ex = rules["exclusions"]
    if comp != "alone":
        if place in (ex["companion_places"].get(comp) or []):
            v += 1
        if shot in ex["companion_shots"]:
            v += 1
    return v


class SceneSolver:
    def __init__(self, rules: dict, seed: int):
        self.rules = rules
        self.rng = random.Random(seed)
        q = quota_lists(rules)
        cols = []
        for c in COLS:
            vals = q[c][:]
            self.rng.shuffle(vals)
            cols.append(vals)
        self.rows = [[cols[c][r] for c in range(len(COLS))] for r in range(SCENE_N)]
        self.pairs = list(itertools.combinations(range(len(COLS)), 2))
        self.pc = {p: Counter() for p in self.pairs}
        for row in self.rows:
            for i, j in self.pairs:
                self.pc[(i, j)][(row[i], row[j])] += 1
        self.sq = sum(n * n for p in self.pairs for n in self.pc[p].values())
        self.viol = [row_violations(rules, r) for r in self.rows]

    def deficit(self) -> int:
        moods_by_act = defaultdict(set)
        for (a, m), n in self.pc[(0, 1)].items():
            if n > 0:
                moods_by_act[a].add(m)
        return sum(max(0, MIN_MOODS_PER_ACTIVITY - len(moods_by_act[a])) for a in self.rules["activities"])

    def objective(self) -> float:
        return 1000 * sum(self.viol) + 200 * self.deficit() + self.sq

    def _swap(self, c: int, r1: int, r2: int) -> None:
        rows = self.rows
        a, b = rows[r1][c], rows[r2][c]
        changes: Counter = Counter()
        for d in range(len(COLS)):
            if d == c:
                continue
            key = (min(c, d), max(c, d))
            v1, v2 = rows[r1][d], rows[r2][d]
            def k(x, y):  # (c값, d값) -> pair 키 순서
                return (x, y) if c < d else (y, x)
            changes[(key, k(a, v1))] -= 1
            changes[(key, k(b, v1))] += 1
            changes[(key, k(b, v2))] -= 1
            changes[(key, k(a, v2))] += 1
        for (key, pv), dn in changes.items():
            if dn == 0:
                continue
            n = self.pc[key][pv]
            self.sq += (n + dn) ** 2 - n * n
            self.pc[key][pv] = n + dn
        rows[r1][c], rows[r2][c] = b, a
        self.viol[r1] = row_violations(self.rules, rows[r1])
        self.viol[r2] = row_violations(self.rules, rows[r2])

    def solve(self, iters: int, t0: float = 30.0, t1: float = 0.05) -> None:
        cur = self.objective()
        best, best_rows = cur, [r[:] for r in self.rows]
        for it in range(iters):
            t = t0 * (t1 / t0) ** (it / iters)
            c = self.rng.randrange(len(COLS))
            r1, r2 = self.rng.sample(range(SCENE_N), 2)
            if self.rows[r1][c] == self.rows[r2][c]:
                continue
            self._swap(c, r1, r2)
            new = self.objective()
            if new <= cur or self.rng.random() < math.exp((cur - new) / t):
                cur = new
                if cur < best:
                    best, best_rows = cur, [r[:] for r in self.rows]
            else:
                self._swap(c, r1, r2)  # 되돌리기
        self.rows = best_rows
        self.viol = [row_violations(self.rules, r) for r in self.rows]
        self.pc = {p: Counter() for p in self.pairs}
        for row in self.rows:
            for i, j in self.pairs:
                self.pc[(i, j)][(row[i], row[j])] += 1


# ---------------------------------------------------------------------------
def assign_companion_details(rows: list[dict]) -> None:
    """family는 1마리/2마리(크기 다름), pet은 puppy/kitten을 번갈아 배정."""
    fam = pet = 0
    for r in rows:
        if r["companion"] == "family":
            r["companion"] = "family" if fam % 2 == 0 else "family:2"
            fam += 1
        elif r["companion"] == "pet":
            r["companion"] = "pet:puppy" if pet % 2 == 0 else "pet:kitten"
            pet += 1


def assign_sub_activities(rules: dict, rows: list[dict], rng: random.Random) -> None:
    order = list(range(len(rows)))
    rng.shuffle(order)
    order.sort(key=lambda i: rows[i]["shot"] == "close_up")  # 소품은 close-up이 아닌 장면 우선
    used: Counter = Counter()
    picked = order[:SUB_PROP_ROWS]
    for n, i in enumerate(picked):
        r = rows[i]
        k = 2 if n < SUB_PROP_TWO else 1
        subs: list[str] = []
        for _ in range(k):
            cands = []
            for a in rules["activities"]:
                if a == r["main_activity"] or a in subs:
                    continue
                inp = AppInput(mood=r["mood"], activities=[r["main_activity"], *subs, a], weather=r["weather"],
                               place=r["place"], companions=_comps(r["companion"]), shot=r["shot"])
                if not validate(rules, inp):
                    cands.append(a)
            rng.shuffle(cands)
            cands.sort(key=lambda a: used[a])
            if cands:
                subs.append(cands[0])
                used[cands[0]] += 1
        r["sub_activities"] = "|".join(subs)


def _comps(token: str) -> list[str]:
    return [] if token in ("", "alone") else token.split("+")


def to_input(r: dict) -> AppInput:
    subs = [s for s in (r.get("sub_activities") or "").split("|") if s]
    return AppInput(mood=r["mood"], activities=[r["main_activity"], *subs], weather=r["weather"],
                    place=r["place"], companions=_comps(r["companion"]), diary_detail=r.get("diary_detail") or None,
                    shot=r["shot"])


def file_stem(mood: str, act: str, place: str, comp: str, weather: str) -> str:
    comp = comp.replace(":", "-").replace("+", "-and-")
    return f"{mood}_{act}_{place}_{comp}_{weather}"


# ---------------------------------------------------------------------------
def build_sheet_rows(rules: dict) -> list[dict]:
    rows = []
    moods = list(rules["moods"])
    for i, m in enumerate(moods, 1):
        rows.append(dict(slot_id=f"anc_{i:02d}", split="anchor", mood=m, main_activity="anchor", place="plain",
                         companion="alone", weather="none", shot="front",
                         prompt=build_sheet_prompt(rules, m, "front", []),
                         caption=build_sheet_caption(rules, m, "front", [])))
    n = 0
    for m in moods:
        for angle, tag in (("front", "sheet-front"), ("three_quarter", "sheet-34")):
            n += 1
            rows.append(dict(slot_id=f"ms_{n:02d}", split="main_sheet", mood=m, main_activity=tag, place="plain",
                             companion="alone", weather="none", shot=angle,
                             prompt=build_sheet_prompt(rules, m, angle, []),
                             caption=build_sheet_caption(rules, m, angle, [])))
    comps = ["friend", "family", "partner", "coworker", "pet:puppy"]
    for i, c in enumerate(comps, 1):
        rows.append(dict(slot_id=f"cs_{i:02d}", split="companion_sheet", mood="none", main_activity="sheet-front",
                         place="plain", companion=c, weather="none", shot="front",
                         prompt=build_sheet_prompt(rules, None, "front", [c], include_main=False),
                         caption=build_sheet_caption(rules, None, "front", [c], include_main=False)))
    rows.append(dict(slot_id="cs_06", split="companion_sheet", mood="happy", main_activity="sheet-front",
                     place="plain", companion="friend", weather="none", shot="front",
                     prompt=build_sheet_prompt(rules, "happy", "front", ["friend"]),
                     caption=build_sheet_caption(rules, "happy", "front", ["friend"])))
    return rows


def finalize_rows(rows: list[dict]) -> list[dict]:
    counts: Counter = Counter()
    for r in rows:
        stem = file_stem(r["mood"], r["main_activity"], r["place"], r["companion"], r["weather"])
        counts[stem] += 1
        r["file_name"] = f"{stem}_{counts[stem]:02d}.png"
        r.setdefault("sub_activities", "")
        r.setdefault("diary_detail", "")
        r.setdefault("selected", "")
        r.setdefault("owner", "")
    return rows


# ---------------------------------------------------------------------------
# 홀드아웃
# ---------------------------------------------------------------------------
def feasible_space(rules: dict) -> list[tuple]:
    comps = ["alone", "friend", "family", "family:2", "partner", "coworker", "pet:puppy", "pet:kitten"]
    out = []
    for m, a, p, c, w, s in itertools.product(rules["moods"], rules["activities"], rules["places"], comps,
                                              rules["weather"], rules["shots"]):
        inp = AppInput(mood=m, activities=[a], weather=w, place=p, companions=_comps(c), shot=s)
        if not validate(rules, inp):
            out.append((a, m, p, c, w, s))
    return out


def comp_kind(token: str) -> str:
    return "+".join(parse_companion(t)[0] for t in _comps(token)) or "alone"


def pick_diverse(cands: list[tuple], n: int, rng: random.Random, taken_pairs: Counter | None = None,
                 sample: int = 1500) -> list[tuple]:
    """후보 중 n개를, 이미 고른 것들과의 두 축 조합 중복이 최소가 되도록 탐욕적으로 고른다."""
    cands = cands[:]
    rng.shuffle(cands)
    chosen: list[tuple] = []
    pc = Counter(taken_pairs or {})
    marg = Counter()
    for _ in range(n):
        best, best_score = None, None
        pool = cands if len(cands) <= sample else rng.sample(cands, sample)
        for t in pool:
            if t in chosen:
                continue
            key = (t[0], t[1], t[2], comp_kind(t[3]))
            if any((c[0], c[1], c[2], comp_kind(c[3])) == key for c in chosen):
                continue
            score = sum(pc[(i, j, t[i], t[j])] for i, j in itertools.combinations(range(6), 2)) * 3
            score += sum(marg[(i, t[i])] for i in range(6))
            if best_score is None or score < best_score:
                best, best_score = t, score
        if best is None:
            break
        chosen.append(best)
        for i, j in itertools.combinations(range(6), 2):
            pc[(i, j, best[i], best[j])] += 1
        for i in range(6):
            marg[(i, best[i])] += 1
    return chosen


def build_holdouts(rules: dict, scene_rows: list[dict], rng: random.Random) -> dict[str, list[dict]]:
    space = feasible_space(rules)
    train5 = {(r["main_activity"], r["mood"], r["place"], comp_kind(r["companion"]), r["weather"]) for r in scene_rows}
    train3 = {(r["main_activity"], r["mood"], r["place"]) for r in scene_rows}
    unseen5 = [t for t in space if (t[0], t[1], t[2], comp_kind(t[3]), t[4]) not in train5]
    # test_combo: (활동, 기분, 장소) 3축 조합까지 학습에 없던 것 = "처음 보는 조합"
    unseen3 = [t for t in unseen5 if (t[0], t[1], t[2]) not in train3]
    singles = unseen5

    out: dict[str, list[dict]] = {}
    used: set = set()

    def take(name: str, pool: list[tuple], n: int) -> list[tuple]:
        pool = [t for t in pool if t not in used]
        got = pick_diverse(pool, n, rng)
        used.update(got)
        if len(got) < n:
            raise RuntimeError(f"{name}: 후보 부족 ({len(got)}/{n})")
        return got

    def row(name: str, i: int, t: tuple, subs: list[str] | None = None, diary: dict | None = None) -> dict:
        a, m, p, c, w, s = t
        r = dict(id=f"{name}_{i:03d}", set=name, mood=m, main_activity=a, sub_activities="|".join(subs or []),
                 place=p, companion=c, weather=w, shot=s,
                 diary_text=(diary or {}).get("text", ""), diary_detail=(diary or {}).get("detail", ""))
        inp = to_input(r)
        r["caption"] = build_caption(rules, inp)
        r["prompt"] = build_prompt(rules, inp)
        return r

    out["val"] = [row("val", i, t) for i, t in enumerate(take("val", singles, HOLDOUT["val"]), 1)]
    out["test_combo"] = [row("test_combo", i, t) for i, t in
                         enumerate(take("test_combo", unseen3, HOLDOUT["test_combo"]), 1)]
    diaries = rules["diary_examples"]
    out["test_diary"] = [row("test_diary", i, t, diary=diaries[(i - 1) % len(diaries)]) for i, t in
                         enumerate(take("test_diary", unseen3, HOLDOUT["test_diary"]), 1)]
    # test_multi: 메인 + 서브 2개 (서브 소품이 그 장소에 놓일 수 있어야 함)
    multi_pool = [t for t in unseen3 if t[5] != "close_up"]
    multi = []
    for t in pick_diverse([x for x in multi_pool if x not in used], HOLDOUT["test_multi"] * 4, rng):
        a, m, p, c, w, s = t
        subs_c = [x for x in rules["activities"] if x != a and not validate(
            rules, AppInput(mood=m, activities=[a, x], weather=w, place=p, companions=_comps(c), shot=s))]
        if len(subs_c) >= 2:
            subs = rng.sample(subs_c, 2)
            multi.append((t, subs))
            used.add(t)
        if len(multi) == HOLDOUT["test_multi"]:
            break
    out["test_multi"] = [row("test_multi", i, t, subs=subs) for i, (t, subs) in enumerate(multi, 1)]
    # test_two_companions: 고정된 동행 조합 4개
    two = []
    for i, comps in enumerate(TWO_COMPANION_SETS, 1):
        token = "+".join(comps)
        pool = [(a, m, p, token, w, s) for (a, m, p, c, w, s) in unseen3 if c == "alone" and s in ("medium", "full")]
        pool = [t for t in pool if not validate(rules, AppInput(mood=t[1], activities=[t[0]], weather=t[4],
                                                                place=t[2], companions=comps, shot=t[5]))]
        pool = [t for t in pool if t not in used]
        t = pick_diverse(pool, 1, rng)[0]
        used.add(t)
        two.append(row("test_two_companions", i, t))
    out["test_two_companions"] = two
    return out


# ---------------------------------------------------------------------------
# 출력 / 리포트
# ---------------------------------------------------------------------------
def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def quota_report(rules: dict, scene: list[dict]) -> tuple[str, bool]:
    lines = ["| 축 | 값 | 목표 | 실제 | 충족 |", "|---|---|---|---|---|"]
    ok_all = True
    q = quota_lists(rules)
    for col in COLS:
        target = Counter(q[col])
        actual = Counter(comp_kind(r[col]) if col == "companion" else r[col] for r in scene)
        for v in target:
            ok = target[v] == actual[v]
            ok_all &= ok
            lines.append(f"| {col} | {v} | {target[v]} | {actual[v]} | {'O' if ok else 'X'} |")
    moods_per_act = defaultdict(set)
    for r in scene:
        moods_per_act[r["main_activity"]].add(r["mood"])
    bad = [a for a in rules["activities"] if len(moods_per_act[a]) < MIN_MOODS_PER_ACTIVITY]
    ok_all &= not bad
    lines.append(f"| 활동별 기분 종류 | 최소 {MIN_MOODS_PER_ACTIVITY} | 전 활동 | "
                 f"min={min(len(v) for v in moods_per_act.values())} | {'O' if not bad else 'X ' + ','.join(bad)} |")
    n_sub = sum(1 for r in scene if r["sub_activities"])
    ok = n_sub == SUB_PROP_ROWS
    ok_all &= ok
    lines.append(f"| 서브 활동 소품 | 1~2개 | {SUB_PROP_ROWS} | {n_sub} | {'O' if ok else 'X'} |")
    comp_close = sum(1 for r in scene if r["companion"] != "alone" and r["shot"] in ("close_up", "small_in_scene"))
    lines.append(f"| 동행 장면 구도 | medium/full | 위반 0 | {comp_close} | {'O' if comp_close == 0 else 'X'} |")
    ok_all &= comp_close == 0
    return "\n".join(lines), ok_all


def coverage_report(rules: dict, scene: list[dict]) -> str:
    space = feasible_space(rules)
    names = ["activity", "mood", "place", "companion", "weather", "shot"]
    norm = lambda t: (t[0], t[1], t[2], comp_kind(t[3]), t[4], t[5])  # noqa: E731
    space_n = [norm(t) for t in space]
    rows_n = [norm((r["main_activity"], r["mood"], r["place"], r["companion"], r["weather"], r["shot"])) for r in scene]
    lines = ["| 축 쌍 | 가능한 조합 | 커버 | 비율 | 최대 중복 |", "|---|---|---|---|---|"]
    tot_f = tot_c = 0
    for i, j in itertools.combinations(range(6), 2):
        feas = {(t[i], t[j]) for t in space_n}
        cnt = Counter((t[i], t[j]) for t in rows_n)
        cov = len(set(cnt) & feas)
        tot_f += len(feas)
        tot_c += cov
        lines.append(f"| {names[i]} × {names[j]} | {len(feas)} | {cov} | {cov / len(feas):.0%} | {max(cnt.values())} |")
    lines.append(f"| **전체** | {tot_f} | {tot_c} | {tot_c / tot_f:.0%} | |")
    return "\n".join(lines)


def excluded_combos(rules: dict) -> list[dict]:
    out = []
    reasons = {(e["activity"], e["place"]): e["reason"] for e in rules["exclusions"].get("examples", [])}
    for a, spec in rules["activities"].items():
        for p in rules["places"]:
            if p not in spec["places"]:
                indoor = rules["places"][p]["indoor"]
                default = ("실외 장소 + 실내 전용 활동" if not indoor and spec["prop_where"] == "indoor"
                           else "허용 장소 목록(activities.places)에 없음")
                out.append(dict(type="activity×place", a=a, b=p, reason=reasons.get((a, p), default)))
    for c, places in rules["exclusions"]["companion_places"].items():
        for p in places:
            out.append(dict(type="companion×place", a=c, b=p, reason="동행-장소 제외 규칙"))
    for s in rules["exclusions"]["companion_shots"]:
        out.append(dict(type="companion×shot", a="(any companion)", b=s, reason="동행 장면은 medium/full 위주"))
    for a, spec in rules["activities"].items():
        if spec["prop_where"] != "any":
            other = [p for p, v in rules["places"].items() if v["indoor"] != (spec["prop_where"] == "indoor")]
            for p in other:
                out.append(dict(type="sub_prop×place", a=a, b=p, reason=f"서브 소품은 {spec['prop_where']} 전용"))
    return out


# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20261019)
    ap.add_argument("--iters", type=int, default=120000)
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    rules = load_rules()
    rng = random.Random(args.seed)

    solver = SceneSolver(rules, args.seed)
    solver.solve(args.iters)
    if sum(solver.viol) or solver.deficit():
        print(f"[오류] 제약을 만족하지 못함: violations={sum(solver.viol)} deficit={solver.deficit()}")
        return 1

    scene = [dict(zip(COLS, r)) for r in solver.rows]
    scene.sort(key=lambda r: (list(rules["activities"]).index(r["main_activity"]), r["mood"]))
    assign_companion_details(scene)
    assign_sub_activities(rules, scene, rng)
    for i, r in enumerate(scene, 1):
        r["slot_id"] = f"sc_{i:02d}"
        r["split"] = "scene"
        inp = to_input(r)
        r["caption"] = build_caption(rules, inp)
        r["prompt"] = build_prompt(rules, inp)

    rows = finalize_rows(build_sheet_rows(rules) + scene)
    write_csv(DATASET / "manifest.csv", MANIFEST_COLUMNS, rows)

    cap_dir = DATASET / "captions"
    cap_dir.mkdir(parents=True, exist_ok=True)
    for old in cap_dir.glob("*.txt"):
        old.unlink()
    for r in rows:
        if r["split"] != "anchor":
            (cap_dir / (Path(r["file_name"]).stem + ".txt")).write_text(r["caption"] + "\n", encoding="utf-8")

    hold = build_holdouts(rules, scene, rng)
    PROMPTS.mkdir(parents=True, exist_ok=True)
    (PROMPTS / "val.txt").write_text("\n".join(r["caption"] for r in hold["val"]) + "\n", encoding="utf-8")
    write_csv(PROMPTS / "val.csv", PROMPT_COLUMNS, hold["val"])
    test_rows = [r for k in ("test_combo", "test_diary", "test_multi", "test_two_companions") for r in hold[k]]
    write_csv(PROMPTS / "test.csv", PROMPT_COLUMNS, test_rows)
    (PROMPTS / "seeds.txt").write_text("# 고정 seed 목록. infer.py는 앞에서부터 --seeds-per-prompt 개를 쓴다.\n"
                                       + "\n".join(map(str, SEEDS)) + "\n", encoding="utf-8")

    excl = excluded_combos(rules)
    write_csv(DATASET / "excluded_combos.csv", ["type", "a", "b", "reason"], excl)

    qr, ok = quota_report(rules, scene)
    cr = coverage_report(rules, scene)
    split_n = Counter(r["split"] for r in rows)
    print(f"manifest: {len(rows)} slots  {dict(split_n)}  (seed={args.seed})")
    print("\n## scene 할당량 충족\n" + qr)
    print("\n## pairwise 커버리지 (scene 40장)\n" + cr)
    print("\n## 홀드아웃\n" + "  ".join(f"{k}={len(v)}" for k, v in hold.items()))
    print(f"\n## 제외 조합: {len(excl)}건 → dataset/excluded_combos.csv")
    (DATASET / "manifest_report.md").write_text(
        f"# manifest 리포트 (seed={args.seed})\n\n## scene 할당량 충족\n{qr}\n\n## pairwise 커버리지\n{cr}\n\n"
        f"## 홀드아웃\n" + "\n".join(f"- {k}: {len(v)}" for k, v in hold.items()) + "\n", encoding="utf-8")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
