# 모찌 뽑기

## 규칙

- 뽑기권 1장으로 1번 뽑는다. 화면에는 1장 뽑기와 10장 뽑기가 있다.
  - 뽑기권이 1~9장이면 10장 버튼이 "남은 n장 뽑기"로 바뀐다 (P-01B). 이때 `count`는 보유한 뽑기권 수다.
- 등급을 먼저 추첨한 뒤 그 등급 안에서 카드를 추첨한다. 추첨은 서버에서만 한다.
- 전설·신화는 그 등급에서 아직 없는 카드 중에서 먼저 추첨한다. 그 등급을 모두 가졌으면 전체에서 추첨한다.
  - 같은 등급 안의 중복을 줄이는 장치이며, 등급 확률은 바뀌지 않는다.
- 천장·확정 장치는 없다. 몇 번을 뽑아도 특정 등급을 보장하지 않는다.
- 이미 가진 카드가 나오면 등급별로 조각을 받는다 (P-12).
- 조각을 모아 아직 없는 카드와 교환할 수 있다 (P-08 ~ P-13).
- 화면 문구는 "별조각"으로 통일한다. API 필드는 `shard`다.
- 시즌 2(과일)는 과일 20종 × 감정 5 = 100장이다.
- 감정 풀(뽑기권 출처별로 감정을 정해 뽑는 규칙)은 추후 결정한다. 지금은 시즌 전체에서 추첨한다.

| 등급 | 확률 | 중복 시 조각 | 교환에 필요한 조각 |
|---|---|---|---|
| `COMMON` 일반 | 45% | +1 | 10 |
| `RARE` 희귀 | 30% | +2 | 20 |
| `EPIC` 영웅 | 17% | +5 | 50 |
| `LEGENDARY` 전설 | 6.5% | +15 | 150 |
| `MYTHIC` 신화 | 1.5% | +40 | 400 |

수치는 P-05 기준이며 서버 설정값이다. 앱은 `GET /gacha/rates`의 값을 보여 준다.

## 응답 객체

### Card

```json
{
  "cardId": 141,
  "code": "S2-04-01",
  "name": "수박 모찌",
  "tier": "EPIC",
  "emotion": "HAPPY",
  "series": "과일 모찌",
  "imageUrl": "https://mozzi-dev-backend-645819131894.s3.ap-northeast-2.amazonaws.com/cards/S2-04-01_mozzi_epic_016_happy.png",
  "owned": true,
  "ownedCount": 2,
  "isNew": false,
  "exchangeCost": 50
}
```

- `code`: `S{시즌}-{모찌 번호}-{감정 번호}`. 감정 번호는 01 행복 · 02 평온 · 03 보통 · 04 우울 · 05 화남.
- 카드 이미지는 모든 사용자에게 같은 공개 에셋이라 URL이 고정이다.
  - 파일 이름: `{code}_{원본 파일}_{감정 영문}.png` (예: `S2-04-01_mozzi_epic_016_happy.png`).
- 보유하지 않은 카드도 `name`, `imageUrl`, `emotion`을 내린다.
  - 교환 화면(P-08, P-09)은 교환하기 전에 받을 모찌의 그림과 이름을 보여 준다.
  - 도감(P-06)에서는 앱이 `owned`가 `false`인 카드를 "?" 칸으로 가린다.
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
  "collection": { "owned": 8, "total": 100 }
}
```

`ticketCount`로 뽑기 버튼을 정한다.

| 뽑기권 | 버튼 |
|---|---|
| 10장 이상 | 1장 뽑기, 10장 뽑기 |
| 1~9장 | 1장 뽑기, 남은 n장 뽑기 (P-01B) |
| 0장 | 둘 다 비활성 (P-01C) |

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

`count`: `1` ~ `10`, 보유한 뽑기권 이하. 뽑기권을 `count`장 사용한다.
앱은 `1`, `10`, 또는 뽑기권이 1~9장일 때 보유 수(남은 n장 뽑기)를 보낸다.

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
  "shardCount": 145,
  "collection": { "owned": 10, "total": 100 }
}
```

- `results`는 뽑은 순서대로 `count`개.
- `collection`은 이번 뽑기를 반영한 도감 진행도다. 결과 요약("새 모찌 n종 · 별조각 +n · 도감 진행도")을 다시 조회하지 않고 그린다.
- `firstAcquired`가 `true`면 처음 얻은 카드 (P-03 "새로운 모찌"). `false`면 중복이고 `shardsGained`만큼 조각이 늘어난다.
- 같은 요청 안에서 같은 카드가 두 번 나오면 두 번째부터 중복으로 처리한다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `count`가 1~10이 아님 |
| 404 | `SEASON_NOT_ACTIVE` | 진행 중인 시즌이 아님 |
| 409 | `NOT_ENOUGH_TICKETS` | 뽑기권이 `count`보다 적음 |
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
  "total": 100,
  "shardCount": 140,
  "cards": [ /* Card */ ]
}
```

카드는 등급 높은 순, 같은 등급 안에서는 `code` 순으로 내린다. P-07 모찌 상세와 P-08 교환 목록도 이 응답으로 그린다.
미보유 카드도 이름·이미지가 들어 있다. 도감 칸에서는 앱이 가리고, 교환 목록에서는 그대로 보여 준다.

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

필요한 조각 수는 카드의 `exchangeCost`이며 등급별로 정해져 있다 (규칙 표).

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
