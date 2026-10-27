# 모찌 뽑기

## 규칙

- 뽑기권 1장으로 1번 뽑는다. 화면에는 1장 뽑기와 10장 뽑기가 있다.
- 등급을 먼저 추첨한 뒤 그 등급 안에서 카드를 추첨한다. 추첨은 서버에서만 한다.
- 이미 가진 카드가 나오면 등급별로 조각을 받는다 (P-12).
- 조각을 모아 원하는 카드와 교환할 수 있다 (P-08 ~ P-13).
- 화면 문구는 "별조각"/"빛조각"이 섞여 있다. API 필드는 `shard`로 통일한다.

| 등급 | 확률 | 중복 시 조각 |
|---|---|---|
| `COMMON` 일반 | 45% | +1 |
| `RARE` 희귀 | 30% | +2 |
| `EPIC` 영웅 | 17% | +5 |
| `LEGENDARY` 전설 | 6.5% | +15 |
| `MYTHIC` 신화 | 1.5% | +40 |

수치는 P-05 기준이며 서버 설정값이다. 앱은 `GET /gacha/rates`의 값을 보여 준다.

## 응답 객체

### Card

```json
{
  "cardId": 141,
  "code": "S2-01-04",
  "name": "수박 모찌",
  "tier": "EPIC",
  "emotion": "HAPPY",
  "series": "과일 모찌",
  "imageUrl": "https://mozzi-public.s3.ap-northeast-2.amazonaws.com/cards/mozzi_epic_018.webp",
  "owned": true,
  "ownedCount": 2,
  "isNew": false,
  "exchangeCost": 50
}
```

- 카드 이미지는 모든 사용자에게 같은 공개 에셋이라 URL이 고정이다.
- 보유하지 않은 카드는 `name`, `imageUrl`, `emotion`을 `null`로 내린다. 앱은 "?" 칸으로 그린다.
- `isNew`: 얻은 뒤 도감에서 아직 보지 않은 카드. 도감의 NEW 표시.
- `exchangeCost`: 이 카드를 조각으로 교환할 때 필요한 수.

---

## `GET /gacha/status` — 뽑기 홈 (P-01)

Response `200`

```json
{
  "ticketCount": 23,
  "shardCount": 140,
  "season": { "seasonId": 2, "name": "시즌 2 · 과일" },
  "collection": { "owned": 8, "total": 9 }
}
```

`ticketCount`로 1장·10장 뽑기 버튼 활성 여부를 정한다 (P-01B 3장 보유, P-01C 0장 보유).

## `GET /gacha/rates?seasonId=2` — 등급별 확률 (P-05)

Response `200`

```json
{
  "seasonId": 2,
  "rates": [
    { "tier": "COMMON", "rate": 0.45, "duplicateShards": 1 },
    { "tier": "RARE", "rate": 0.30, "duplicateShards": 2 },
    { "tier": "EPIC", "rate": 0.17, "duplicateShards": 5 },
    { "tier": "LEGENDARY", "rate": 0.065, "duplicateShards": 15 },
    { "tier": "MYTHIC", "rate": 0.015, "duplicateShards": 40 }
  ]
}
```

## `POST /gacha/draws` — 뽑기 (P-02 ~ P-04, P-12)

Headers: `Idempotency-Key` (필수)

Request

```json
{ "seasonId": 2, "count": 10 }
```

`count`: `1` 또는 `10`. 뽑기권을 `count`장 사용한다.

Response `201`

```json
{
  "drawId": 9001,
  "results": [
    {
      "card": { /* Card */ },
      "firstAcquired": true,
      "shardsGained": 0
    },
    {
      "card": { /* Card */ },
      "firstAcquired": false,
      "shardsGained": 5
    }
  ],
  "ticketCount": 13,
  "shardCount": 145
}
```

- `results`는 뽑은 순서대로 `count`개.
- `firstAcquired`가 `true`면 처음 얻은 카드 (P-03 "새로운 모찌"). `false`면 중복이고 `shardsGained`만큼 조각이 늘어난다.
- 같은 요청 안에서 같은 카드가 두 번 나오면 두 번째부터 중복으로 처리한다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `count`가 1, 10이 아님 |
| 404 | `SEASON_NOT_ACTIVE` | 진행 중인 시즌이 아님 |
| 409 | `NOT_ENOUGH_TICKETS` | 뽑기권 부족 |
| 5xx | | P-11 "뽑기를 시작하지 못했어요". 같은 `Idempotency-Key`로 재시도 |

## `GET /gacha/collection?seasonId=2` — 도감 (P-06, P-07, P-08)

Query

| 이름 | 설명 |
|---|---|
| `seasonId` | 필수 |
| `owned` | 선택. `false`면 미보유만 (P-06 "미보유" 탭) |
| `series` | 선택. 시리즈 이름 (P-06 "과일 모찌" 탭) |

Response `200`

```json
{
  "seasonId": 2,
  "owned": 8,
  "total": 9,
  "shardCount": 140,
  "cards": [ /* Card */ ]
}
```

카드는 등급 높은 순, 같은 등급 안에서는 `code` 순으로 내린다. P-07 모찌 상세와 P-08 교환 목록도 이 응답으로 그린다.

## `POST /gacha/collection/seen` — NEW 표시 지우기

도감에서 카드를 본 뒤 호출한다.

```json
{ "cardIds": [13, 141] }
```

Response `204`

## `POST /gacha/exchanges` — 조각으로 교환 (P-09, P-13)

Headers: `Idempotency-Key` (필수)

Request

```json
{ "cardId": 141 }
```

Response `201`

```json
{
  "card": { /* Card */ },
  "shardsSpent": 50,
  "shardCount": 90
}
```

| HTTP | code | 처리 |
|---|---|---|
| 404 | `NOT_FOUND` | 없는 카드 |
| 409 | `NOT_ENOUGH_SHARDS` | 조각 부족 |
| 409 | `CARD_ALREADY_OWNED` | 이미 보유한 카드 |
