"""앱 입력(JSON) -> 학습 캡션 / 생성 프롬프트.

학습·서비스가 같은 규칙을 쓰도록 조립 로직은 이 파일 하나에만 둔다.
규칙 데이터는 configs/prompt_rules.yaml 에 있다.

캡션 조립 순서 (고정):
    mochi_char, {mood}, {main_activity}, {place}, [with {companion phrase}],
    {weather light}, [{props}], [{diary detail}], {shot}
서비스(추론) 프롬프트 = 캡션 + ", {inference_style}" (build_lora_prompt)

앱 입력 예:
    {
      "mood": "happy",
      "activities": ["cooking", "reading"],   # 첫 번째가 메인(⭐). main_activity로 따로 지정 가능
      "main_activity": "cooking",             # 선택
      "place": "home",                        # 선택 (없으면 home)
      "companions": ["family"],               # 선택. friend | family | family:2 | partner | coworker | pet:puppy | pet:kitten
      "weather": "sunny",
      "diary_detail": "a small birthday cake with candles",  # 선택. 영어 디테일 1개
      "shot": "medium"                        # 선택 (없으면 medium)
    }

CLI:
    python scripts/prompt_builder.py --json '{"mood":"happy","activities":["cooking"],"weather":"sunny"}'
    python scripts/prompt_builder.py --file input.json
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

AI_DIR = Path(__file__).resolve().parents[1]
DEFAULT_RULES = AI_DIR / "configs" / "prompt_rules.yaml"


def load_rules(path: str | Path = DEFAULT_RULES) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


@dataclass
class AppInput:
    mood: str
    activities: list[str]
    weather: str
    main_activity: str | None = None
    place: str | None = None
    companions: list[str] = field(default_factory=list)
    diary_detail: str | None = None
    shot: str | None = None

    @classmethod
    def from_dict(cls, d: dict) -> "AppInput":
        acts = d.get("activities") or []
        if isinstance(acts, str):
            acts = [a for a in acts.split("|") if a]
        comps = d.get("companions") or []
        if isinstance(comps, str):
            comps = [c for c in comps.split("+") if c and c != "alone"]
        return cls(
            mood=d["mood"],
            activities=list(acts),
            weather=d["weather"],
            main_activity=d.get("main_activity") or None,
            place=d.get("place") or None,
            companions=[c for c in comps if c != "alone"],
            diary_detail=d.get("diary_detail") or None,
            shot=d.get("shot") or None,
        )

    @property
    def main(self) -> str:
        return self.main_activity or self.activities[0]

    @property
    def subs(self) -> list[str]:
        return [a for a in self.activities if a != self.main]


# ---------------------------------------------------------------------------
# 개별 문구
# ---------------------------------------------------------------------------
def parse_companion(token: str) -> tuple[str, str | None]:
    """'pet:kitten' -> ('pet', 'kitten'), 'family:2' -> ('family', '2')."""
    kind, _, detail = token.partition(":")
    return kind, (detail or None)


def companion_count(companions: list[str]) -> int:
    n = 0
    for c in companions:
        kind, detail = parse_companion(c)
        n += 2 if detail == "2" else 1
    return n


def _companion_entry(rules: dict, kind: str, detail: str | None) -> dict:
    table = rules["companions"]
    if kind not in table:
        raise ValueError(f"unknown companion: {kind}")
    entry = table[kind]
    if kind == "pet":
        pet_type = detail if detail in entry else rules["default_pet"]
        entry = entry[pet_type]
    return entry


def companion_phrase(rules: dict, companions: list[str]) -> str | None:
    """동행 목록 -> 'with ...' 없이 동행 문구. 같은 종류 2마리는 two 표현을 쓴다."""
    if not companions:
        return None
    parsed = [parse_companion(c) for c in companions]
    # 같은 종류(같은 pet 타입 포함) 2개가 들어오면 'two' 표현으로 합친다
    if len(parsed) == 2 and parsed[0] == parsed[1]:
        kind, detail = parsed[0]
        return _companion_entry(rules, kind, detail)["two"]
    parts = []
    for kind, detail in parsed:
        entry = _companion_entry(rules, kind, detail)
        parts.append(entry["two"] if detail == "2" else entry["one"])
    return " and ".join(parts)


def place_key(rules: dict, inp: AppInput) -> str:
    return inp.place or rules["default_place"]


def is_indoor(rules: dict, place: str) -> bool:
    return bool(rules["places"][place]["indoor"])


def place_phrase(rules: dict, place: str, main_activity: str) -> str:
    p = rules["places"][place]
    return (p.get("by_activity") or {}).get(main_activity, p["caption"])


def weather_phrase(rules: dict, weather: str, place: str) -> str:
    return rules["weather"][weather]["indoor" if is_indoor(rules, place) else "outdoor"]


def prop_phrases(rules: dict, subs: list[str], place: str) -> list[str]:
    where = "indoor" if is_indoor(rules, place) else "outdoor"
    placement = rules["prop_placement"][where]
    return [f"{rules['activities'][s]['prop']} {placement}" for s in subs]


def shot_key(rules: dict, inp: AppInput) -> str:
    return inp.shot or rules["default_shot"]


# ---------------------------------------------------------------------------
# 검증
# ---------------------------------------------------------------------------
def validate(rules: dict, inp: AppInput) -> list[str]:
    """제외 규칙·입력 범위 위반 목록. 빈 리스트면 통과."""
    errs: list[str] = []
    if inp.mood not in rules["moods"]:
        errs.append(f"unknown mood: {inp.mood}")
    if not inp.activities and not inp.main_activity:
        errs.append("activities: 최소 1개 필요")
    acts = list(dict.fromkeys(([inp.main_activity] if inp.main_activity else []) + inp.activities))
    if len(acts) > 3:
        errs.append("activities: 최대 3개")
    for a in acts:
        if a not in rules["activities"]:
            errs.append(f"unknown activity: {a}")
    if errs:
        return errs
    place = place_key(rules, inp)
    if place not in rules["places"]:
        return errs + [f"unknown place: {place}"]
    if inp.weather not in rules["weather"]:
        errs.append(f"unknown weather: {inp.weather}")
    main = inp.main
    if place not in rules["activities"][main]["places"]:
        errs.append(f"excluded: main activity '{main}' at '{place}'")
    indoor = is_indoor(rules, place)
    for s in inp.subs:
        where = rules["activities"][s]["prop_where"]
        if (where == "indoor" and not indoor) or (where == "outdoor" and indoor):
            errs.append(f"excluded: prop of '{s}' at '{place}'")
    n_comp = companion_count(inp.companions)
    if n_comp > rules["max_companions"]:
        errs.append(f"companions: 최대 {rules['max_companions']}마리 (입력 {n_comp})")
    ex = rules.get("exclusions", {})
    for c in inp.companions:
        kind, _ = parse_companion(c)
        if kind not in rules["companions"]:
            errs.append(f"unknown companion: {c}")
            continue
        if place in (ex.get("companion_places", {}).get(kind) or []):
            errs.append(f"excluded: companion '{kind}' at '{place}'")
    shot = shot_key(rules, inp)
    if shot not in rules["shots"]:
        errs.append(f"unknown shot: {shot}")
    elif inp.companions and shot in (ex.get("companion_shots") or []):
        errs.append(f"excluded: shot '{shot}' with companions")
    if len(inp.subs) > rules["max_props"]:
        errs.append(f"props: 최대 {rules['max_props']}개")
    return errs


# ---------------------------------------------------------------------------
# 조립
# ---------------------------------------------------------------------------
def build_caption(rules: dict, inp: AppInput, *, check: bool = True) -> str:
    """학습 캡션. 생김새·화풍은 쓰지 않는다. 서비스 추론은 build_lora_prompt (+ inference_style)."""
    if check:
        errs = validate(rules, inp)
        if errs:
            raise ValueError("; ".join(errs))
    place = place_key(rules, inp)
    parts = [
        rules["trigger"],
        inp.mood,
        rules["activities"][inp.main]["caption"],
        place_phrase(rules, place, inp.main),
    ]
    comp = companion_phrase(rules, inp.companions)
    if comp:
        parts.append(f"with {comp}")
    parts.append(weather_phrase(rules, inp.weather, place))
    parts.extend(prop_phrases(rules, inp.subs, place))
    if inp.diary_detail:
        parts.append(inp.diary_detail.strip())
    parts.append(rules["shots"][shot_key(rules, inp)]["caption"])
    return ", ".join(parts)


def with_inference_style(rules: dict, caption: str) -> str:
    """추론용: 캡션 맨 뒤에 inference_style 을 붙인다 (학습 캡션에는 붙이지 않는다)."""
    return f"{caption}, {rules['inference_style']}"


def with_variant_caption(rules: dict, caption: str, variant: str) -> str:
    """특색 캐릭터: 트리거 바로 뒤에 variants.<variant>.caption 을 붙인다."""
    trigger, _, rest = caption.partition(", ")
    return f"{trigger} {rules['variants'][variant]['caption']}, {rest}"


def with_variant_prompt(rules: dict, prompt: str, variant: str) -> str:
    """특색 캐릭터: 긴 생성 프롬프트 끝에 variants.<variant>.prompt 를 붙인다."""
    return f"{prompt}\n{' '.join(rules['variants'][variant]['prompt'].split())}"


def build_lora_prompt(rules: dict, inp: AppInput, *, check: bool = True) -> str:
    """서비스에서 LoRA 모델에 넣는 프롬프트 = 학습 캡션 + inference_style."""
    return with_inference_style(rules, build_caption(rules, inp, check=check))


def _fixed_rules_text(rules: dict) -> str:
    outline = rules["variables"].get("outline_color")
    outline_txt = rules["outline_clause"].format(outline_color=outline) if outline else ""
    return " ".join([
        rules["style"].strip(),
        rules["character"].strip().format(outline=outline_txt),
        rules["scene_rules"].strip(),
    ])


def mood_color_text(rules: dict, mood: str) -> str:
    mode = rules["variables"].get("mood_color_mode") or "environment"
    m = rules["moods"][mood]
    return rules["mood_color_modes"][mode].format(color=m["color"], light=m["light"])


def build_prompt(rules: dict, inp: AppInput, *, check: bool = True) -> str:
    """후보 생성용 긴 프롬프트: 고정 규칙 + 화풍 + 장면 묘사 (조립 순서 동일)."""
    if check:
        errs = validate(rules, inp)
        if errs:
            raise ValueError("; ".join(errs))
    place = place_key(rules, inp)
    mood = rules["moods"][inp.mood]
    act = rules["activities"][inp.main]
    scene = [
        f"Scene: Mochi feels {inp.mood}, with {mood['expression']}.",
        f"Mochi is {act['action']} in a {place_phrase(rules, place, inp.main)}.",
    ]
    comp = companion_phrase(rules, inp.companions)
    if comp:
        scene.append(f"Mochi is with {comp}, standing beside Mochi and smaller than Mochi.")
    scene.append(f"Lighting and weather: {weather_phrase(rules, inp.weather, place)}.")
    scene.append(mood_color_text(rules, inp.mood))
    props = prop_phrases(rules, inp.subs, place)
    if props:
        scene.append("Props: " + ", ".join(props) + ".")
    if inp.diary_detail:
        scene.append(f"Small detail: {inp.diary_detail.strip()}.")
    scene.append(f"Composition: {rules['shots'][shot_key(rules, inp)]['prompt']}.")
    scene.append(rules["scene_detail"]["indoor" if is_indoor(rules, place) else "outdoor"].strip())
    return _fixed_rules_text(rules) + " " + " ".join(scene)


# ---------------------------------------------------------------------------
# 단색 배경 시트 (anchor / main_sheet / companion_sheet)
# ---------------------------------------------------------------------------
def build_sheet_caption(rules: dict, mood: str | None, angle: str, companions: list[str],
                        include_main: bool = True) -> str:
    sh = rules["sheet"]
    parts: list[str] = []
    if include_main:
        parts += [rules["trigger"], mood, sh["pose_caption"], sh["background_caption"]]
        comp = companion_phrase(rules, companions)
        if comp:
            parts.append(f"with {comp}")
    else:
        # 동행 단독 시트: 주인공이 없으므로 트리거 단어를 넣지 않는다
        parts += [companion_phrase(rules, companions), sh["pose_caption"], sh["background_caption"]]
    parts += [sh["angles"][angle], "full shot"]
    return ", ".join(p for p in parts if p)


def build_sheet_prompt(rules: dict, mood: str | None, angle: str, companions: list[str],
                       include_main: bool = True) -> str:
    sh = rules["sheet"]
    view = sh["angles"][angle]
    bg = "Plain solid cream background, no scenery, no props."
    if include_main:
        m = rules["moods"][mood]
        txt = [f"Character sheet: Mochi alone, standing, {view}, feeling {mood}, with {m['expression']}.",
               mood_color_text(rules, mood)]
        comp = companion_phrase(rules, companions)
        if comp:
            txt = [f"Character sheet: Mochi standing side by side with {comp}, {view}, feeling {mood}, "
                   f"with {m['expression']}. The companion is smaller and clearly different in color."]
        return _fixed_rules_text(rules) + " " + " ".join(txt) + " " + bg
    comp = companion_phrase(rules, companions)
    return (rules["style"].strip() + " " +
            f"Character sheet: only {comp}, standing alone, {view}, a round soft mochi-like body with short "
            f"stubby arms and no fingers, dot eyes. Do not draw the white main Mochi. "
            "No humans, no other animals or characters, no text, no letters, no logos. " + bg)


# ---------------------------------------------------------------------------
def build_all(rules: dict, data: dict) -> dict:
    inp = AppInput.from_dict(data)
    errs = validate(rules, inp)
    out = {"input": data, "errors": errs}
    if not errs:
        out["caption"] = build_caption(rules, inp, check=False)
        out["lora_prompt"] = build_lora_prompt(rules, inp, check=False)
        out["prompt"] = build_prompt(rules, inp, check=False)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--json", help="앱 입력 JSON 문자열")
    g.add_argument("--file", help="앱 입력 JSON 파일")
    ap.add_argument("--rules", default=str(DEFAULT_RULES))
    args = ap.parse_args(argv)
    data: Any = json.loads(args.json) if args.json else json.loads(Path(args.file).read_text(encoding="utf-8"))
    rules = load_rules(args.rules)
    items = data if isinstance(data, list) else [data]
    results = [build_all(rules, d) for d in items]
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(results if isinstance(data, list) else results[0], ensure_ascii=False, indent=2))
    return 1 if any(r["errors"] for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
