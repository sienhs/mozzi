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

> 현재는 헤더 검증만 한다. 같은 키로 재전송했을 때 첫 응답을 그대로 돌려주는 처리는 아직 없다.

## 오류 응답

```json
{
  "code": "INVALID_INPUT",
  "message": "입력값을 다시 확인해 주세요.",
  "fieldErrors": [
    { "field": "memo", "reason": "100자 이하로 입력해 주세요." }
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

감정 얼굴 이미지는 앱 번들 에셋이다. 서버는 코드만 내려준다.

### ActivityCode — 활동

`STUDY` 공부 · `WORK` 업무 · `EXERCISE` 운동 · `REST` 휴식 · `FRIEND` 친구 · `HOBBY` 취미 · `FAMILY` 가족 · `ETC` 기타

라벨과 표시 순서는 서버의 `activity` 테이블 기준이다 (`GET /meta`로 내려줌).

### ImageStatus — 그림 생성 상태

| 값 | 의미 |
|---|---|
| `PENDING` | 대기 중 |
| `GENERATING` | 생성 중 |
| `SUCCEEDED` | 완성 |
| `FAILED` | 실패 |

### ImageStage — 생성 단계 (G-01 진행 문구)

`ANALYZING` 기록을 읽는 중 → `COMPOSING` 장면을 고르는 중 → `DRAWING` 그리는 중 → `FINISHING` 마무리 중

### CardTier — 카드 등급

`COMMON` 일반 · `RARE` 희귀 · `EPIC` 영웅 · `LEGENDARY` 전설 · `MYTHIC` 신화
