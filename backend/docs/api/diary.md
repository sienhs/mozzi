# 일기 · 아이콘 · 그림 생성

경로 앞에는 공통 prefix `/api/v1`이 붙는다 ([공통 규칙](common.md#기본)).

## 흐름

```
아이콘 만들기 (이름 + 카테고리, 글자만)
        │
일기 쓰기: 이모티콘 1개 + 한 줄 일기 + 내 아이콘들 (무엇을 1개 이상)
        │
그림 만들기: 캐릭터 + 시간대 + 날씨 + 카테고리별 아이콘 1개씩 → 비동기 생성
        │
캘린더(한 달 감정) · 하루 일기 · 일기 목록으로 조회
```

## 응답 객체

### MyIcon

```json
{
  "myIconId": 15,
  "name": "도서관",
  "category": "WHERE",
  "createdAt": "2026-10-28T21:12:00+09:00"
}
```

| 필드 | 설명 |
|---|---|
| `name` | 아이콘 이름. 이미지는 없고 글자만 있다 |
| `category` | [`IconCategory`](common.md#iconcategory--아이콘-카테고리) |

### DiaryImage

```json
{ "status": "SUCCEEDED", "imageUrl": "https://mozzi-diary.s3.ap-northeast-2.amazonaws.com/diary/3f2a9c1e-....webp" }
```

| 필드 | 설명 |
|---|---|
| `status` | [`ImageStatus`](common.md#imagestatus--그림-생성-상태) |
| `imageUrl` | 공개 URL. 완성 전이거나 실패했으면 `null` |

그림을 아직 요청하지 않은 일기는 `image` 자리에 `null`이 내려간다.

---

## 기본 데이터

### `GET /emoticons` — 이모티콘 목록

감정 하나에 이모티콘 하나, 5개. 서버가 미리 등록해 둔다.

Response `200`

```json
{
  "items": [
    { "emoticonId": 1, "emotion": "HAPPY", "imageUrl": "https://.../emoticons/happy.webp" },
    { "emoticonId": 2, "emotion": "CALM", "imageUrl": "https://.../emoticons/calm.webp" }
  ]
}
```

---

## 내 아이콘

### `POST /my-icons` — 아이콘 만들기

Request

```json
{ "name": "도서관", "category": "WHERE" }
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `name` | O | 최대 10자. 앞뒤 공백 제거. 중복 허용 |
| `category` | O | `WHERE`, `WHO`, `WHAT` |

- 카테고리마다 최대 9개. 삭제한 아이콘은 세지 않는다.

Response `201` — `MyIcon`

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 이름이 비었거나 10자 초과, 잘못된 카테고리 |
| 409 | `MY_ICON_LIMIT_EXCEEDED` | 그 카테고리에 이미 9개 |

### `GET /my-icons` — 내 아이콘 목록

Query

| 이름 | 필수 | 설명 |
|---|---|---|
| `category` | O | `WHERE`, `WHO`, `WHAT` |

정렬: 만든 순서 (오래된 것부터). 카테고리당 최대 9개라 페이지를 나누지 않는다.

Response `200`

```json
{ "items": [ /* MyIcon */ ] }
```

### `DELETE /my-icons/{myIconId}` — 아이콘 삭제

Response `204`. 소프트 삭제.

삭제한 아이콘은 그 아이콘을 붙였던 예전 일기에서도 보이지 않는다. 그래서 일기에 남은 아이콘이 없을 수도 있다.

| HTTP | code | 처리 |
|---|---|---|
| 404 | `NOT_FOUND` | 없거나 이미 삭제했거나 다른 회원의 아이콘 |

---

## 일기

### `POST /diaries` — 일기 쓰기

Headers: `Idempotency-Key` (필수)

Request

```json
{
  "emoticonId": 2,
  "content": "퇴근하고 오므라이스를 만들어 먹었어",
  "myIconIds": [15, 21, 30]
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `emoticonId` | O | 서버가 이 이모티콘의 감정을 일기에 함께 저장한다 |
| `content` | | 한 줄 일기. 최대 50자. 앞뒤 공백 제거, 비어 있으면 `null`로 저장 |
| `myIconIds` | O | 내 아이콘 ID. 중복 불가, 카테고리별 개수 제한 없음. `WHAT` 아이콘이 1개 이상 있어야 한다 |

- 날짜는 받지 않는다. 서버가 오늘 날짜(Asia/Seoul)로 저장한다.
- 하루에 일기는 하나다.
- 그림은 여기서 만들지 않는다. [`POST /diaries/{diaryId}/image`](#post-diariesdiaryidimage--그림-만들기)로 따로 요청한다.

Response `201`

```json
{ "diaryId": 102, "recordDate": "2026-10-28" }
```

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 50자 초과, `WHAT` 아이콘 없음, 삭제했거나 다른 회원의 아이콘 |
| 404 | `NOT_FOUND` | 없는 이모티콘 |
| 409 | `DIARY_ALREADY_EXISTS` | 오늘 일기가 이미 있음. 응답의 `diaryId`로 이동 |

`WHAT` 아이콘이 없으면 `message`가 "무엇을 했는지 하나 이상 골라 주세요."다. 사용할 수 없는 아이콘이 섞여 있으면 "사용할 수 없는 아이콘이 있어요."다.

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

### `GET /diaries/daily` — 하루 일기

Query

| 이름 | 필수 | 설명 |
|---|---|---|
| `date` | O | `YYYY-MM-DD` |

Response `200`

```json
{
  "diaryId": 102,
  "recordDate": "2026-10-28",
  "emoticonId": 2,
  "emotion": "CALM",
  "content": "퇴근하고 오므라이스를 만들어 먹었어",
  "myIcons": {
    "WHERE": [ /* MyIcon */ ],
    "WHO": [],
    "WHAT": [ /* MyIcon */ ]
  },
  "image": { "status": "SUCCEEDED", "imageUrl": "https://..." },
  "createdAt": "2026-10-28T21:12:00+09:00",
  "updatedAt": "2026-10-28T21:12:00+09:00"
}
```

| 필드 | 설명 |
|---|---|
| `content` | 쓰지 않았으면 `null` |
| `myIcons` | 카테고리별로 묶는다. 세 키는 항상 있고, 없으면 빈 배열. 삭제한 아이콘은 빠진다. 카테고리 안에서는 만든 순서 |
| `image` | `DiaryImage`. 그림을 요청하기 전이면 `null` |

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `date` 없음, 형식 오류 |
| 404 | `NOT_FOUND` | 그 날짜에 일기가 없음 |

홈은 [`GET /home`](home.md)을 쓴다.

### `GET /diaries/monthly` — 한 달 감정 (캘린더)

Query

| 이름 | 필수 | 설명 |
|---|---|---|
| `yearMonth` | O | `YYYY-MM` |

일기를 쓴 날만 날짜순으로 내려간다. 빈 날짜는 앱이 빈칸으로 그린다. 미래 달이면 빈 목록. 한 달 최대 31개라 페이지를 나누지 않는다.

Response `200`

```json
{
  "yearMonth": "2026-10",
  "items": [
    { "diaryId": 101, "recordDate": "2026-10-21", "emoticonId": 4, "emotion": "SAD" },
    { "diaryId": 102, "recordDate": "2026-10-22", "emoticonId": 2, "emotion": "CALM" }
  ]
}
```

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `yearMonth` 없음, 형식 오류 |

### `GET /diaries` — 일기 목록

Query (모두 선택)

| 이름 | 설명 |
|---|---|
| `cursor`, `size` | [커서 페이지네이션](common.md#목록-커서-페이지네이션) |
| `emotion` | `Emotion` |
| `from`, `to` | `YYYY-MM-DD`, 양 끝 포함 |

정렬: `recordDate` 최신순.

Response `200`

```json
{
  "items": [
    {
      "diaryId": 102,
      "recordDate": "2026-10-22",
      "emoticonId": 1,
      "emotion": "HAPPY",
      "content": "퇴근하고 오므라이스를 만들어 먹었어",
      "image": { "status": "SUCCEEDED", "imageUrl": "https://..." }
    }
  ],
  "nextCursor": "MjAyNi0xMC0yMXwxMDE"
}
```

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `from`이 `to`보다 늦음, 잘못된 커서 |

일기 수정·삭제 API는 없다. 하루의 기록은 남겨 둔다.

---

## 그림 만들기

그림은 일기 저장과 분리된 비동기 작업이다. 일기 하나에 그림은 하나이고, 실패하면 같은 그림을 다시 요청한다.

```
앱: POST /diaries/{id}/image
                │
서버: diary_image(PENDING) 저장 → 202 → 커밋 후 비동기로
      GMS 번역 + 유해성 판정(어디서·누구와·무엇을) → SQS(ai-request)
                │
AI 서버: 이미지 생성 → S3 업로드 → SQS(ai-response)
                │
서버: SQS 롱 폴링으로 결과 수신 → diary_image(SUCCEEDED / FAILED, image_url) 갱신 → FCM 푸시
                │
앱: 푸시를 받으면 GET /diaries/daily?date= 로 그림 확인
```

- 타임아웃은 없다. AI 서버가 결과를 보낼 때까지 `PENDING`이고, 그동안은 다시 요청할 수 없다. 그래서 결과에 일기 ID만 있어도 어느 요청의 결과인지 헷갈리지 않는다.
- 번역이나 큐 적재에 실패하면 바로 `FAILED`가 되고, 실패 횟수에 세지 않는다.
- 결과는 [푸시](#그림-결과-푸시-fcm)로 알린다. 앱이 꺼져 있어도 받는다. 푸시를 놓쳐도 `GET /diaries/daily`의 `image`로 확인할 수 있다.
- 번역하는 같은 GMS 호출에서 고른 값(아이콘 이름 등)이 그림으로 그릴 수 없는 내용인지 함께 판정한다. 욕설(변형 표기 포함), 성적인 내용, 잔인한 폭력, 자해, 마약, 혐오 표현이면 AI 서버로 보내지 않고 `FAILED`가 되며, **실패 횟수에 센다**. 같은 값으로 다시 요청하면 같은 판정이 나오기 때문이다. 음주(치맥 등)나 일상적인 슬픔·화남은 막지 않는다.

### `POST /diaries/{diaryId}/image` — 그림 만들기

Headers: `Idempotency-Key` (필수)

Request

```json
{
  "characterId": 7,
  "timeOfDay": "EVENING",
  "weather": "RAINY",
  "whereMyIconId": 15,
  "whoMyIconId": 21,
  "whatMyIconId": 30
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `characterId` | O | 그림에 들어갈 모찌 |
| `timeOfDay` | | `MORNING` 아침 · `LUNCH` 점심 · `EVENING` 저녁 |
| `weather` | | `NONE` 입력되지 않음 · `SUNNY` 맑음 · `CLOUDY` 흐림 · `RAINY` 비 · `SNOWY` 눈. 보내지 않으면 `NONE` |
| `whereMyIconId` | | 이 일기에 붙인 `WHERE` 아이콘 중 하나 |
| `whoMyIconId` | | 이 일기에 붙인 `WHO` 아이콘 중 하나 |
| `whatMyIconId` | O | 이 일기에 붙인 `WHAT` 아이콘 중 하나 |

- 서버는 고른 아이콘의 **이름**을 그림 기록에 저장한다. 나중에 아이콘을 지워도 그림이 무엇으로 만들어졌는지는 남는다.
- **오늘 쓴 일기만** 그림을 만들 수 있다. 다시 요청하는 것도 그날만 된다.
- 실패한 그림은 다시 요청할 수 있다. 실패는 3번까지라 최대 3번 시도한다 (처음 1번 + 다시 2번).

| 현재 그림 상태 | 결과 |
|---|---|
| (지난 날짜의 일기) | `400 IMAGE_ONLY_TODAY` |
| 없음 | `202` |
| `PENDING`, `SUCCEEDED` | `409 IMAGE_ALREADY_REQUESTED` |
| `FAILED`, 실패 3번 미만 | `202`. 새로 고른 값으로 다시 생성 |
| `FAILED`, 실패 3번 | `429 RETRY_LIMIT_EXCEEDED` |

Response `202`

```json
{ "diaryId": 102, "imageStatus": "PENDING" }
```

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `characterId`·`whatMyIconId` 없음, 이 일기에 없는 아이콘, 카테고리가 맞지 않는 아이콘 |
| 400 | `IMAGE_ONLY_TODAY` | 오늘 일기가 아님 |
| 404 | `NOT_FOUND` | 없거나 다른 회원의 일기 |
| 409 | `IMAGE_ALREADY_REQUESTED` | 생성 중이거나 이미 완성됨 |
| 429 | `RETRY_LIMIT_EXCEEDED` | 실패 3번 |

> 예정: 캐릭터 테이블과 보유 확인 (뽑기로 얻은 캐릭터만 가능, 기본 캐릭터 1개 지급). 그 전까지 `characterId`는 저장만 하고, AI 서버에는 설정값의 기본 캐릭터 이미지·프롬프트를 보낸다.

### 그림 결과 푸시 (FCM)

그림이 끝나면(`SUCCEEDED` 또는 `FAILED`) 일기 주인의 기기로 푸시를 한 번 보낸다. 기기는 [`PUT /members/me/push-tokens`](auth.md#put-membersmepush-tokens--푸시-토큰-등록)로 등록한 것 중 활성인 것(마지막에 로그인한 기기)이다.

| 경우 | 제목 | 본문 |
|---|---|---|
| 성공 | 그림일기가 완성됐어요 | 오늘의 그림을 확인해 보세요. |
| 유해성 판정으로 막힘 | 그림을 그리지 못했어요 | 그림으로 그릴 수 없는 내용이 있어요. 아이콘을 바꿔서 다시 그려 주세요. |
| 그 밖의 실패 | 그림을 그리지 못했어요 | 다시 그려 볼 수 있어요. |
| 실패 3번째 (더 요청할 수 없음) | 그림을 그리지 못했어요 | 이 일기의 그림은 더 그릴 수 없어요. |

`data` (값은 모두 문자열):

```json
{
  "type": "DIARY_IMAGE",
  "diaryId": "102",
  "recordDate": "2026-10-28",
  "status": "SUCCEEDED",
  "imageUrl": "https://.../diary/....webp"
}
```

| 키 | 설명 |
|---|---|
| `type` | 푸시 종류. 그림 결과는 `DIARY_IMAGE` |
| `diaryId`, `recordDate` | 알림을 누르면 `GET /diaries/daily?date={recordDate}`로 이동 |
| `status` | `SUCCEEDED`, `FAILED` |
| `imageUrl` | `SUCCEEDED`일 때만 |
| `code` | `FAILED`이고 사용자가 고칠 수 있는 이유일 때만. 지금은 `INAPPROPRIATE_CONTENT`(유해한 내용) 하나 |

- 앱이 백그라운드면 OS가 제목·본문을 알림으로 띄운다. 포그라운드면 OS는 띄우지 않으므로 앱이 `data`를 보고 처리한다.
- 같은 결과가 SQS로 두 번 와도 푸시는 한 번만 간다.
- 보내기에 실패해도 다시 보내지 않는다. 그림 결과는 저장되어 있으므로 앱은 일기에서 확인한다.
- FCM이 앱이 지워진 토큰이라고 답하면 그 기기는 비활성화한다.
- 실패 이유(`code`)는 저장하지 않는다. `GET /diaries/daily`에서는 `FAILED`만 보인다.
- 서버에 Firebase 키(`FIREBASE_SERVICE_ACCOUNT_JSON`)가 없으면 푸시는 로그로만 남는다.

### AI 서버와 주고받는 메시지

AI 서버는 DB를 읽지 않으므로 필요한 값을 모두 메시지에 담는다.

`ai-request` (서버 → AI)

```json
{
  "diaryId": 102,
  "userId": 12,
  "date": "2026-10-28",
  "emotion": "CALM",
  "characterImageUrl": "https://.../characters/mozzi.webp",
  "characterPrompt": "a white round mochi rice cake with pink cheeks and short arms and legs",
  "timeOfDay": "in the evening",
  "weather": "on a rainy day",
  "where": "at home",
  "who": "with mom",
  "what": "cooking"
}
```

- `userId`는 일기 주인의 회원 ID다.
- `date`는 오늘 날짜(`YYYY-MM-DD`)다. 그림은 그날 일기에만 요청할 수 있어서 일기 날짜와 같다.
- `emotion`은 일기의 감정 코드다 (`HAPPY`, `CALM`, `NEUTRAL`, `SAD`, `ANGRY`).
- `what`만 항상 값이 있다. 나머지 선택 값은 없으면 `null`이 아니라 `""`로 보낸다.
- `characterImageUrl`은 캐릭터 이미지가 없으면 `"DEFAULT"`다. AI 서버는 기본 캐릭터로 그린다. 이때 `characterPrompt`는 `""`다 (AI 서버가 기본 캐릭터의 설명을 자체로 갖고 있다).
- `timeOfDay`, `where`, `who`는 고르지 않았으면 `""`. `weather`가 `NONE`(입력되지 않음)이어도 `""`.
- 번역은 GMS `gpt-4.1-mini`로 한 번에 한다. 자주 쓰는 태그(집, 가족, 요리 등)는 프롬프트의 용어집대로 같은 영어로 옮긴다.
- `timeOfDay`, `weather`, `characterPrompt`는 고정값이라 번역하지 않는다. `characterPrompt`는 캐릭터 이미지가 있을 때만 설정값(`MOZZI_DEFAULT_CHARACTER_PROMPT`, 영어)을 그대로 보낸다.

`ai-response` (AI → 서버)

```json
{
  "diaryId": 102,
  "userId": 12,
  "status": "SUCCEEDED",
  "imageUrl": "https://{bucket}.s3.ap-northeast-2.amazonaws.com/diary/12/102/6f1c2a9e1b2c.png",
  "errorCode": null,
  "errorMessage": null
}
```

| 필드 | 설명 |
|---|---|
| `diaryId` | 필수 |
| `userId` | 필수. 일기 주인과 다르면 결과를 버린다 (그림 저장·푸시 모두 하지 않음) |
| `status` | `SUCCEEDED`, `FAILED` |
| `imageUrl` | `SUCCEEDED`면 필수. AI 서버가 S3에 올린 공개 URL을 그대로 `diary_image.image_url`에 저장한다 |
| `errorCode` | `FAILED`일 때. 서버 로그에만 남긴다 |
| `errorMessage` | `FAILED`일 때. 사용자 입력이 섞일 수 있어 로그에도 남기지 않는다. 사용자에게는 서버가 정한 실패 문구를 푸시로 보낸다 |

- 서버는 `ai-response`를 롱 폴링(20초)으로 계속 받는다. 처리한 메시지만 지운다.
- 결과는 그 일기의 **현재 요청**에 반영한다. SQS가 같은 결과를 두 번 보내도 한 번만 반영된다.
- `FAILED`만 실패 횟수에 센다. AI 서버로 가기 전 유해성 판정으로 막힌 요청도 실패 횟수에 센다.
- 형식이 맞지 않는 메시지는 버린다. 서버가 처리하다 오류가 나면 메시지를 지우지 않아 다시 전달된다.
