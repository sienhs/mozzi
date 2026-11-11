"""요청·결과 메시지. 형식: WORKER_DESIGN.md 4장 (Java 와 맞춘 ai-request / ai-response)

여기서는 타입과 필수 값만 검사한다. 값의 뜻(감정·장소 등을 프롬프트로 바꾸기, 기본값)은 prompt.py 가 맡는다.
Java 는 비어 있는 값을 "" 로 보내므로 "" 와 null 은 같은 것(값 없음)으로 본다.
characterImageUrl 이 "DEFAULT" 이면 기본 모찌다: 참조 이미지를 쓰지 않고, characterPrompt(기본 캐릭터 설명)도 쓰지 않는다.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    INVALID_INPUT = "INVALID_INPUT"          # 다시 해도 똑같은 입력 오류 → 재시도하지 않음
    EXPIRED = "EXPIRED"                      # 요청 큐에 너무 오래 있었음
    REF_IMAGE_FAILED = "REF_IMAGE_FAILED"    # 참조 이미지를 받지 못함
    GENERATION_FAILED = "GENERATION_FAILED"  # 그림 생성 오류 (GPU 오류 포함)
    UPLOAD_FAILED = "UPLOAD_FAILED"          # S3 업로드 오류


class InvalidMessage(ValueError):
    """입력 오류. diaryId 를 알면 실패 결과를 돌려보낼 수 있다."""

    def __init__(self, message: str, diary_id: int | None = None, user_id: int | None = None):
        super().__init__(message)
        self.diary_id = diary_id
        self.user_id = user_id


@dataclass(frozen=True)
class Scene:
    """그림 내용. what 만 필수이고 나머지는 None 이면 prompt.py 가 기본값을 쓴다."""
    what: str
    mood: str | None = None
    weather: str | None = None
    time_of_day: str | None = None
    where: str | None = None
    who: str | None = None
    character_prompt: str | None = None


@dataclass(frozen=True)
class Request:
    diary_id: int
    user_id: int
    date: date
    scene: Scene
    character_image_url: str | None = None   # None: 기본 모찌 ("DEFAULT")
    test: bool = False                       # True: 백엔드 시험 요청. S3 의 시험용 폴더에 저장한다


DEFAULT_CHARACTER = "DEFAULT"


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def parse_request(body: str) -> Request:
    try:
        d = json.loads(body)
    except json.JSONDecodeError as e:
        raise InvalidMessage(f"JSON 아님: {e}") from None
    if not isinstance(d, dict):
        raise InvalidMessage("JSON 객체가 아님")

    diary_id = d.get("diaryId")
    if not _is_int(diary_id) or diary_id <= 0:
        raise InvalidMessage("diaryId: 양의 정수여야 함")

    user_id = d.get("userId")
    if isinstance(user_id, str) and user_id.strip().isdigit():
        user_id = int(user_id)
    if not _is_int(user_id) or user_id < 0:
        raise InvalidMessage("userId: 0 이상의 정수여야 함", diary_id=diary_id)

    def bad(msg: str) -> InvalidMessage:
        return InvalidMessage(msg, diary_id=diary_id, user_id=user_id)

    def text(key: str) -> str | None:
        v = d.get(key)
        if v is None:
            return None
        if not isinstance(v, str):
            raise bad(f"{key}: 문자열이어야 함")
        return v.strip() or None

    what = text("what")
    if what is None:
        raise bad("what: 비어 있으면 안 됨")

    try:
        diary_date = date.fromisoformat(text("date") or "")
    except ValueError:
        raise bad(f"date: YYYY-MM-DD 형식이어야 함 ({d.get('date')!r})") from None

    image_url = text("characterImageUrl")
    is_default = image_url is None or image_url.upper() == DEFAULT_CHARACTER
    if not is_default and not image_url.startswith(("https://", "http://")):
        raise bad(f'characterImageUrl: http(s) 주소나 "{DEFAULT_CHARACTER}" 여야 함')

    test = d.get("test")
    if test is None:
        test = False
    elif not isinstance(test, bool):
        raise bad(f"test: true 나 false 여야 함 ({test!r})")

    scene = Scene(what=what, mood=text("emotion"), weather=text("weather"), time_of_day=text("timeOfDay"),
                  where=text("where"), who=text("who"),
                  character_prompt=None if is_default else text("characterPrompt"))
    return Request(diary_id=diary_id, user_id=user_id, date=diary_date, scene=scene,
                   character_image_url=None if is_default else image_url, test=test)


@dataclass
class Result:
    """ai-response. errorCode, errorMessage 는 실패일 때만 값이 있다.
    프롬프트·seed·시간 같은 확인용 값은 결과에 넣지 않고 로그에만 남긴다 (loop.py)."""
    diary_id: int
    user_id: int | None
    status: str                              # SUCCEEDED | FAILED
    image_url: str | None = None
    error_code: str | None = None
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {_camel(k): v for k, v in asdict(self).items()}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


def failure(diary_id: int, user_id: int | None, code: ErrorCode, message: str) -> Result:
    return Result(diary_id=diary_id, user_id=user_id, status="FAILED", error_code=code.value,
                  error_message=message[:500])


def now() -> datetime:
    return datetime.now(timezone.utc).astimezone()
