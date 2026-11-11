"""요청 값(Scene) → 생성 프롬프트. 규칙 데이터는 prompt_rules.yaml.

조립 순서는 학습 캡션과 같다 (ai/scripts/prompt_builder.py):
    mochi_char[ {characterPrompt}], {mood}, {what}, {where}, [with {who}], {빛(날씨·시간대)}, [{소품}], {shot}, {inference_style}
예: mochi_char, happy, cooking, home kitchen, with a pale yellow family mochi, warm sunset light through the
    window, medium shot, warm children's picture-book illustration, crayon and watercolor textures

거부하지 않고 고쳐서 그린다 (WORKER_DESIGN.md 5-4). 기본값을 넣은 것은 남기지 않고, 들어온 값을 바꾸거나 뺀 것만
fixes 에 남긴다. 그릴 내용이 아예 없을 때(what 이 사람 단어뿐 등)만 InvalidMessage 를 낸다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from .messages import InvalidMessage, Scene

RULES_PATH = Path(__file__).with_name("prompt_rules.yaml")

_LEAD = re.compile(r"^(?:(?:at|in|on|to|with|during|around|a|an|the|my|our)\s+)+")  # "at my home" → "home"
_TAIL = re.compile(r"\s+(?:day|days|weather|time)$")  # "rainy day" → "rainy"
_EDGE = {"with", "and", "for", "to", "of", "at", "in", "on", "a", "an", "the", "my", "our"}  # 앞뒤에 남으면 뗌
_COUNT = re.compile(r"^(?:two|2)\s+")


@dataclass
class Prompt:
    text: str
    fixes: list[str] = field(default_factory=list)  # 고친 내역 (결과 메시지 fixes)


@lru_cache(maxsize=1)
def rules() -> dict:
    return yaml.safe_load(RULES_PATH.read_text(encoding="utf-8"))


def norm(s: str | None) -> str:
    """소문자, 공백 하나로."""
    return " ".join((s or "").lower().split())


def strip_lead(s: str) -> str:
    return _LEAD.sub("", s)


def build_prompt(scene: Scene) -> Prompt:
    r = rules()
    fixes: list[str] = []
    mood = _mood(scene.mood, fixes)
    activity, what, subs = _what(scene.what, fixes)
    where, indoor = _where(scene.where, activity, fixes)
    who = _who(scene.who, fixes)
    light = _light(scene.weather, scene.time_of_day, indoor, fixes)
    props = [p for p in (_prop(s, indoor, fixes) for s in subs) if p]
    wear = _character(scene.character_prompt, fixes)

    parts = [f"{r['trigger']} {wear}" if wear else r["trigger"], mood, what, where]
    if who:
        parts.append(f"with {who}")
    parts += [light, *props, r["shot"], r["inference_style"]]
    return Prompt(", ".join(parts), fixes)


# ---------------------------------------------------------------------- 항목별
def _mood(raw: str | None, fixes: list[str]) -> str:
    r = rules()
    v = norm(raw)
    if not v:
        return r["default_mood"]
    for code, aliases in r["moods"].items():
        if v == code or v in aliases:
            return code
    fixes.append(f"mood: '{raw}' 모름 → {r['default_mood']}")
    return r["default_mood"]


def _what(raw: str, fixes: list[str]) -> tuple[str | None, str, list[str]]:
    """"cooking, reading" → (메인 활동 코드 또는 None, 메인 캡션 문구, 나머지 활동들). 나머지는 소품이 된다."""
    r = rules()
    items = [s.strip() for s in raw.split(",") if s.strip()]
    if len(items) > r["max_activities"]:
        fixes.append(f"what: 활동은 {r['max_activities']}개까지라 뒤를 뺌 ('{raw}')")
        items = items[:r["max_activities"]]
    code, phrase = _activity(items[0] if items else "", "what", fixes)
    if not phrase:
        raise InvalidMessage(f"what: '{raw}' 에서 그릴 내용을 찾지 못함")
    return code, phrase, items[1:]


def _activity(raw: str, name: str, fixes: list[str]) -> tuple[str | None, str]:
    """(활동 코드 또는 None, 문구). 모르는 활동은 정리한 영어 문구 그대로."""
    v = norm(raw)
    for code, a in rules()["activities"].items():
        if v in (code, a["caption"], *a.get("aliases", [])):
            return code, a["caption"]
    return None, clean_phrase(raw, name, fixes)


def _prop(raw: str, indoor: bool, fixes: list[str]) -> str | None:
    """두 번째 이후 활동 → 소품 문구. 아는 활동이면 'a small frying pan on the table', 모르면 문구 그대로."""
    r = rules()
    code, phrase = _activity(raw, "what", fixes)
    if code is None:
        article = norm(raw).split(" ", 1)[0]
        if phrase and article in ("a", "an") and not phrase.startswith(f"{article} "):  # 물건이면 관사를 살린다
            phrase = f"{article} {phrase}"
        return phrase or None
    return f"{r['activities'][code]['prop']} {r['prop_placement']['indoor' if indoor else 'outdoor']}"


def _where(raw: str | None, activity: str | None, fixes: list[str]) -> tuple[str, bool]:
    """(장소 문구, 실내 여부)."""
    r = rules()
    places = r["places"]
    v = strip_lead(norm(raw))
    code = r["default_place"] if not v else None
    for c, p in places.items():
        if code is None and v in (c, norm(p["caption"]), *p.get("aliases", [])):
            code = c
    if code is None:
        phrase = clean_phrase(raw, "where", fixes)
        if phrase:
            return phrase, not (set(phrase.split()) & set(r["outdoor_words"]))
        fixes.append(f"where: '{raw}' 에서 장소를 찾지 못함 → {r['default_place']}")
        code = r["default_place"]
    p = places[code]
    return (p.get("by_activity") or {}).get(activity, p["caption"]), bool(p["indoor"])


def _who(raw: str | None, fixes: list[str]) -> str | None:
    r = rules()
    v = strip_lead(norm(raw))
    if not v or v in r["alone"]:
        return None
    index = {}  # 단어 → (종류, 수)
    for kind, words in r["who"].items():
        index.update({w: (kind, 1) for w in words.get("one") or []})
        index.update({w: (kind, 2) for w in words.get("two") or []})

    counts: dict[str, int] = {}  # 들어온 순서를 지킨다
    for token in re.split(r",|&|\band\b|\bwith\b", v):
        token = strip_lead(token.strip())
        if not token or token in r["alone"]:
            continue
        two = bool(_COUNT.match(token))
        token = _COUNT.sub("", token)
        kind, n = index.get(token) or index.get(token.removesuffix("s"), (None, 1))
        if kind is None:
            people = set(r["people_words"])
            if any(w.removesuffix("'s") in people or w.removesuffix("s") in people for w in token.split()):
                kind = r["default_companion"]  # 목록에 없는 사람 (선생님 등): 사람을 그리지 않고 친구 모찌로
                fixes.append(f"who: '{token}' → {kind}")
            else:  # 목록에 없는 동물 (앵무새 등): 그 동물을 모찌 스타일로
                name = " ".join(re.sub(r"[^a-z -]", " ", token).split()[-2:])
                if not name:
                    continue
                kind = f"animal:{name}"
        counts[kind] = min(counts.get(kind, 0) + (2 if two else n), 2)

    # 종류가 여럿이면 종류마다 1마리씩 먼저 준다: "with family and a puppy" → 가족 모찌 1 + 강아지
    kinds = list(counts)[:r["max_companions"]]
    if len(counts) > len(kinds):
        fixes.append(f"who: 최대 {r['max_companions']}마리라 {list(counts)[len(kinds):]} 뺌 ('{raw}')")
    if len(kinds) == 1:
        return _companion(kinds[0], two=counts[kinds[0]] >= 2)
    return " and ".join(_companion(k, two=False) for k in kinds) or None


def _companion(kind: str, two: bool) -> str:
    """동행 문구. 목록에 없는 동물(animal:parrot)은 'a round mochi-style parrot' (학습한 강아지·고양이 문구와 같은 모양)."""
    if kind.startswith("animal:"):
        name = kind.removeprefix("animal:")
        if two:
            return f"two round mochi-style {name if name.endswith('s') else name + 's'}"
        return f"a round mochi-style {name}"
    return rules()["companions"][kind]["two" if two else "one"]


def _light(weather_raw: str | None, time_raw: str | None, indoor: bool, fixes: list[str]) -> str:
    """날씨 + 시간대 → 빛 문구 하나 (prompt_rules.yaml weather 주석의 규칙)."""
    r = rules()
    side = "indoor" if indoor else "outdoor"
    weather = _lookup(r["weather"], weather_raw, "weather", fixes)
    time = _lookup(r["times"], time_raw, "timeOfDay", fixes)
    if weather is not None and weather != "sunny":
        tag = time and r["times"][time].get("time_tag")
        return f"{r['weather'][weather][side]}, {tag}" if tag else r["weather"][weather][side]
    if time is not None:
        return r["times"][time][side]
    return r["weather"]["sunny"][side] if weather == "sunny" else r["default_light"][side]


def _lookup(table: dict, raw: str | None, name: str, fixes: list[str]) -> str | None:
    """"in the evening" → evening, "on a rainy day" → rainy (앞의 전치사·관사, 뒤의 day/weather 를 뗀다)."""
    v = _TAIL.sub("", strip_lead(norm(raw)))
    if not v:
        return None
    for code, entry in table.items():
        if v == code or v in entry["aliases"]:
            return code
    fixes.append(f"{name}: '{raw}' 모름 → 없는 것으로 봄")
    return None


def _character(raw: str | None, fixes: list[str]) -> str | None:
    """특색 캐릭터 문구 검사 (CHARACTER_PROMPT_RULES.md 8장). 통과 못 하면 빼고 참조 이미지만 쓴다."""
    c = rules()["character_prompt"]
    v = norm(raw).rstrip(".")
    if not v:
        return None
    if len(v) > c["max_chars"]:
        reason = f"{c['max_chars']}자 넘음"
    elif not re.match(c["pattern"], v):
        reason = "'wearing ...' / 'holding ...' 형식 아님 (소문자·공백·하이픈만, 쉼표 없음)"
    else:
        banned = [w for w in re.split(r"[ -]", v) if w in c["banned_words"]]
        reason = f"쓰지 않는 단어 {banned}" if banned else None
    if reason:
        fixes.append(f"characterPrompt: {reason} → 뺌")
        return None
    return v


# ---------------------------------------------------------------------- 자유 문구
def clean_phrase(raw: str, name: str, fixes: list[str]) -> str:
    """사용자가 추가한 장소·활동 문구를 캡션에 넣을 수 있게 정리한다.
    쉼표(캡션 항목 구분자)와 문장부호를 빼고, 사람 단어를 빼고, 길이를 줄인다."""
    r = rules()
    v = norm(raw).replace(",", " and ")
    v = re.sub(r"[^a-z0-9' -]", " ", v)
    words = strip_lead(" ".join(v.split())).split()
    people = set(r["people_words"])
    kept = [w for w in words if w.removesuffix("'s") not in people]
    if len(kept) < len(words):
        fixes.append(f"{name}: 사람 단어를 뺌 ('{raw}')")
    while kept and kept[-1] in _EDGE:
        kept.pop()
    while kept and kept[0] in _EDGE:
        kept.pop(0)
    out = " ".join(kept)
    limit = r["max_phrase_chars"]
    if len(out) > limit:
        out = out[:limit + 1].rsplit(" ", 1)[0]
        fixes.append(f"{name}: {limit}자로 줄임")
    return out
