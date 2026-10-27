# 일기 · 그림 생성

## 응답 객체

### DiaryDetail

```json
{
  "diaryId": 102,
  "recordDate": "2026-10-22",
  "emotion": "CALM",
  "activities": ["REST", "FAMILY"],
  "memo": "퇴근하고 오므라이스를 만들어 먹었어.",
  "title": "모찌의 따뜻한 저녁",
  "image": {
    "imageId": 501,
    "status": "SUCCEEDED",
    "imageUrl": "https://mozzi-diary.s3.ap-northeast-2.amazonaws.com/diary/12/102/501.webp?X-Amz-Expires=600&...",
    "imageUrlExpiresAt": "2026-10-22T21:22:00+09:00"
  },
  "createdAt": "2026-10-22T21:12:00+09:00",
  "updatedAt": "2026-10-22T21:12:00+09:00"
}
```

| 필드 | 설명 |
|---|---|
| `activities` | 칩 표시 순서로 정렬 |
| `memo` | 사용자가 쓴 한 줄. 없으면 `null` |
| `title` | 그림 생성 때 AI가 붙이는 제목 (최대 30자). 그림이 완성되기 전에는 `null` |
| `image.imageUrl` | 10분짜리 presigned URL. 완성 전·실패 시 `null` |
| `createdAt` | D-01 "오후 9:12에 남긴 기록" |

- 카드 제목은 `memo`가 있으면 `memo`, 없으면 `title`을 쓴다.
- `imageUrl`은 저장해 두지 않는다. 만료 후 이미지 요청이 403이면 상세를 다시 조회해 새 URL을 받는다. 이미지 캐시 키는 URL이 아니라 `imageId`로 잡는다.

### DiarySummary

목록 행용. `DiaryDetail`에서 `memo`, `updatedAt`, 이미지 URL을 뺀 형태다.

```json
{
  "diaryId": 101,
  "recordDate": "2026-10-21",
  "emotion": "SAD",
  "activities": ["WORK"],
  "title": "조금 늦었던 퇴근",
  "image": { "imageId": 500, "status": "SUCCEEDED" },
  "createdAt": "2026-10-21T22:03:00+09:00"
}
```

---

## `POST /diaries` — 일기 작성 (R-03)

Headers: `Idempotency-Key` (필수)

Request

```json
{
  "recordDate": "2026-10-22",
  "emotion": "CALM",
  "activities": ["REST", "FAMILY"],
  "memo": "퇴근하고 오므라이스를 만들어 먹었어"
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `recordDate` | O | 오늘(Asia/Seoul)만. 00:00~03:00 사이에는 전날도 허용 |
| `emotion` | O | `Emotion` 1개 |
| `activities` | | 0개 이상, 중복 불가. 생략하면 빈 목록 |
| `memo` | | 최대 100자. 앞뒤 공백 제거, 비어 있으면 `null`로 저장 |

하루에 일기는 하나다. 삭제한 날짜에는 다시 쓸 수 있다.

Response `201` — 저장과 함께 첫 그림 생성을 요청한다.

```json
{
  "diaryId": 102,
  "recordDate": "2026-10-22",
  "image": { "imageId": 501, "status": "PENDING" }
}
```

앱은 응답을 받으면 G-01로 이동해 그림 상태를 폴링한다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_RECORD_DATE` | 허용되지 않는 날짜 |
| 409 | `DIARY_ALREADY_EXISTS` | 그날 일기가 이미 있음. 응답의 `diaryId`로 상세 이동 |

`409 DIARY_ALREADY_EXISTS`는 공통 오류 본문에 `diaryId`가 추가된다.

```json
{
  "code": "DIARY_ALREADY_EXISTS",
  "message": "오늘은 이미 기록을 남겼어요.",
  "fieldErrors": null,
  "traceId": "a1b2c3d4e5f6",
  "diaryId": 102
}
```

E-02 "다시 저장하기"는 같은 `Idempotency-Key`로 재전송한다. 첫 요청이 이미 저장됐다면 지금은 위 409가 오고, 앱은 상세로 이동하면 된다.

> 예정: 첫 기록이면 뽑기권 지급 결과 `"reward": { "ticketGranted": 1, "ticketCount": 2 }`를 응답에 추가한다.
> 보상은 `recordDate`당 한 번이다. 일기를 지우고 같은 날짜로 다시 써도 다시 주지 않는다 (`ticketGranted: 0`).

## `GET /diaries/{diaryId}` — 일기 상세 (D-01, G-02)

Response `200` — `DiaryDetail`

| HTTP | code | 처리 |
|---|---|---|
| 404 | `NOT_FOUND` | 없거나 삭제됐거나 다른 회원의 일기 |

## `GET /diaries` — 일기 목록

Query (모두 선택)

| 이름 | 설명 |
|---|---|
| `cursor`, `size` | [커서 페이지네이션](common.md#목록-커서-페이지네이션) |
| `emotion` | `Emotion` |
| `activity` | `ActivityCode` |
| `from`, `to` | `YYYY-MM-DD`, 양 끝 포함 |

정렬: `recordDate` 최신순.

Response `200`

```json
{ "items": [ /* DiarySummary */ ], "nextCursor": "MjAyNi0xMC0yMXwxMDE" }
```

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `from`이 `to`보다 늦음, 잘못된 커서 |

## `PATCH /diaries/{diaryId}` — 일기 수정

바꿀 필드만 보낸다. 빠지거나 `null`인 필드는 그대로 둔다.

```json
{ "emotion": "HAPPY", "activities": ["REST"], "memo": "수정한 한 줄" }
```

- 메모를 지우려면 `"memo": ""`, 활동을 모두 지우려면 `"activities": []`.
- `recordDate`는 바꿀 수 없다 (보내면 400).
- 수정해도 그림은 다시 그리지 않는다.

Response `200` — `DiaryDetail`

## `DELETE /diaries/{diaryId}` — 일기 삭제

Response `204`. 소프트 삭제.

---

## 그림 생성

그림은 일기 저장과 분리된 비동기 작업이다. 그림이 실패해도 일기는 남고, 그림만 다시 요청한다.

```
POST /diaries → diary + diary_image(PENDING) 저장 → 큐
                                                 │
                워커: 프롬프트 생성 → 이미지 모델 → S3 업로드
                                                 │
     diary_image(SUCCEEDED / FAILED) 갱신 → 푸시 "모찌가 그림을 완성했어요"
```

## `GET /diaries/{diaryId}/image` — 생성 상태 (G-01, H-03 폴링)

3초 간격, 최대 3분. `SUCCEEDED` 또는 `FAILED`가 되면 멈춘다.

Response `200` — 생성 중

```json
{
  "imageId": 501,
  "status": "GENERATING",
  "stage": "COMPOSING",
  "progress": 40,
  "estimatedSeconds": 30,
  "imageUrl": null,
  "imageUrlExpiresAt": null,
  "title": null,
  "failureCode": null,
  "retryable": null,
  "remainingRetries": null
}
```

Response `200` — 완성

```json
{
  "imageId": 501,
  "status": "SUCCEEDED",
  "stage": null,
  "progress": 100,
  "estimatedSeconds": null,
  "imageUrl": "https://...",
  "imageUrlExpiresAt": "2026-10-22T21:22:00+09:00",
  "title": "모찌의 따뜻한 저녁",
  "failureCode": null,
  "retryable": null,
  "remainingRetries": null
}
```

Response `200` — 실패

```json
{
  "imageId": 501,
  "status": "FAILED",
  "stage": null,
  "progress": null,
  "estimatedSeconds": null,
  "imageUrl": null,
  "imageUrlExpiresAt": null,
  "title": null,
  "failureCode": "GENERATION_TIMEOUT",
  "retryable": true,
  "remainingRetries": 2
}
```

- `progress`는 단계 기준 근사치: `ANALYZING` 15, `COMPOSING` 40, `DRAWING` 70, `FINISHING` 90.
- `failureCode`: `GENERATION_TIMEOUT`, `MODEL_ERROR`, `CONTENT_BLOCKED`, `STORAGE_ERROR`

## `POST /diaries/{diaryId}/image/retry` — 다시 그리기 (E-01, E-03)

Headers: `Idempotency-Key` (필수)

Response `202`

```json
{ "imageId": 502, "status": "PENDING", "remainingRetries": 1 }
```

| HTTP | code | 처리 |
|---|---|---|
| 409 | `IMAGE_NOT_RETRYABLE` | 이미 완성됐거나 생성 중 |
| 429 | `RETRY_LIMIT_EXCEEDED` | 오늘 재시도 횟수 초과 |
