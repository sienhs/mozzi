# 공통 규칙

## 기본

| 항목 | 규칙 |
|---|---|
| Base URL | `/api/v1` (아래 모든 문서의 경로 앞에 붙는다) |
| 인증 | `Authorization: Bearer {accessToken}`. 예외는 `POST /auth/google`, `/auth/signup`, `/auth/refresh` 뿐 |
| 형식 | JSON만 받는다. 필드는 camelCase. 정의되지 않은 필드를 보내면 400 |
| 날짜 | `YYYY-MM-DD` |
| 일시 | ISO-8601 + 오프셋 (`2026-10-22T21:12:00+09:00`). 서버 기준 시간대는 `Asia/Seoul` |
| ID | 숫자 (`Long`) |
| null | 값이 없는 필드도 키는 빠지지 않고 `null`로 내려간다 |

## 성공 응답

래퍼 없이 리소스를 그대로 반환한다.

| 코드 | 사용 |
|---|---|
| 200 | 조회, 수정 |
| 201 | 생성 |
| 202 | 접수됨, 비동기 처리 (그림 다시 그리기) |
| 204 | 본문 없음 (로그아웃, 삭제) |

## 목록 (커서 페이지네이션)

요청: `?cursor={nextCursor}&size=20` — 첫 페이지는 `cursor` 없이 보낸다. `size` 기본 20, 최대 100.

```json
{ "items": [], "nextCursor": "MjAyNi0xMC0yMXwxMDE" }
```

`nextCursor`가 `null`이면 마지막 페이지다. 커서 값은 해석하지 말고 그대로 돌려보낸다.

## 중복 요청 방지

두 번 눌리면 안 되는 요청(일기 작성, 다시 그리기, 뽑기, 교환)은 `Idempotency-Key: {UUID}` 헤더가 필수다(최대 64자). 재전송할 때는 같은 키를 쓴다.

같은 키로 재전송하면 첫 응답을 그대로 돌려준다. 기록은 24시간 보관하고, 지난 기록은 매일 04:50에 지운다. 실패한 요청은 기록하지 않으므로 같은 키로 다시 시도할 수 있다. 같은 키로 다른 본문을 보내면 `409 IDEMPOTENCY_CONFLICT`. 키는 회원·API마다 따로 보며, 다시 그리기는 일기마다 따로 본다.

`POST /diaries/{diaryId}/image/test`(테스트·임시)는 헤더 검증만 한다.

## 오류 응답

```json
{
  "code": "INVALID_INPUT",
  "message": "입력값을 다시 확인해 주세요.",
  "fieldErrors": [
    { "field": "content", "reason": "50자 이하로 입력해 주세요." }
  ],
  "traceId": "a1b2c3d4e5f6"
}
```

- 앱은 `code`로 분기한다. `message`는 사용자에게 그대로 보여 줘도 되는 문장이다.
- `fieldErrors`는 입력 검증 실패일 때만 채워지고, 그 외에는 `null`.
- 문의할 때는 `traceId`를 같이 전달하면 서버 로그를 찾을 수 있다.

## 공통 오류 코드

| HTTP | code | 상황 | 앱 처리 |
|---|---|---|---|
| 400 | `INVALID_INPUT` | 형식·검증 오류 | `fieldErrors` 표시 |
| 401 | `ACCESS_TOKEN_MISSING` | 토큰 없음 | 로그인 화면 |
| 401 | `ACCESS_TOKEN_INVALID` | 위조·형식 오류 | 로그인 화면. 재발급하지 않음 |
| 401 | `ACCESS_TOKEN_EXPIRED` | 만료 | **이 코드일 때만** 재발급 후 원 요청 1회 재시도 |
| 401 | `SESSION_REVOKED` | 다른 기기에서 로그인해 세션 교체됨 | 토큰 삭제 후 로그인 화면 |
| 404 | `NOT_FOUND` | 없는 리소스, 또는 다른 회원의 리소스 | |
| 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 메서드 | |
| 406 | `NOT_ACCEPTABLE` | JSON 이외의 `Accept` | |
| 409 | `IDEMPOTENCY_CONFLICT` | 같은 키로 다른 본문 전송 | |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | JSON 이외의 `Content-Type` | |
| 429 | `RATE_LIMITED` | 호출 제한 초과 | 잠시 후 재시도 |
| 500 | `INTERNAL_ERROR` | 서버 오류 | |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | 인증 처리 중 DB 장애 | 일시 장애 안내. **토큰을 삭제하지 않는다** |

도메인별 오류 코드는 각 문서에 있다.

## Enum

### Emotion — 감정

| 값 | 라벨 | 색상 토큰 |
|---|---|---|
| `HAPPY` | 행복 | happy `#F3D889` |
| `CALM` | 평온 | calm `#B8CBA8` |
| `NEUTRAL` | 보통 | — |
| `SAD` | 우울 | sad `#B8C5DD` |
| `ANGRY` | 화남 | — |

감정마다 이모티콘이 하나씩 있다. 이미지는 `GET /emoticons`로 내려준다.

### IconCategory — 아이콘 카테고리

`WHERE` 어디서 · `WHO` 누구와 · `WHAT` 무엇을

### TimeOfDay — 그림 시간대

`MORNING` 아침 · `LUNCH` 점심 · `EVENING` 저녁

### Weather — 그림 날씨

`NONE` 입력되지 않음 · `SUNNY` 맑음 · `CLOUDY` 흐림 · `RAINY` 비 · `SNOWY` 눈

### ImageStatus — 그림 생성 상태

| 값 | 의미 |
|---|---|
| `PENDING` | 그리는 중 |
| `SUCCEEDED` | 완성 |
| `FAILED` | 실패 |

### CardTier — 카드 등급

`COMMON` 일반 · `RARE` 희귀 · `EPIC` 영웅 · `LEGENDARY` 전설 · `MYTHIC` 신화
