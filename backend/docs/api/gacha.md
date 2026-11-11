# 모찌 뽑기

## 규칙

- 뽑기권 1장으로 1번 뽑는다. 한 요청에 1~10장을 쓴다. 화면에는 1장 뽑기와 10장 뽑기가 있다.
  - 뽑기권이 1~9장이면 10장 버튼이 "남은 n장 뽑기"로 바뀐다 (P-01B). 이때 `count`는 보유한 뽑기권 수다.
- 등급을 먼저 추첨한 뒤 그 등급 안에서 카드를 추첨한다. 추첨은 서버에서만 한다.
- 전설·신화는 그 등급에서 아직 없는 카드 중에서 뽑는다. 다 모았으면 그 등급 전체에서 뽑는다.
  - 같은 등급 안의 중복을 줄이는 장치이며, 등급 확률은 바뀌지 않는다.
- 천장·확정·보장은 없다. 몇 번을 뽑아도 특정 등급을 보장하지 않는다.
- 이미 가진 카드가 나오면 등급별로 별조각을 받는다 (P-12).
- 별조각은 전설·신화 중 아직 없는 카드와 교환할 수 있다 (P-08 ~ P-13).
- 화면 문구는 "별조각"이다. API 필드는 `shard`를 쓴다.
- 뽑기권·별조각 보관 상한은 없다.
- 시즌 구분은 없다. 뽑기 대상은 기본 모찌를 뺀 활성 카드 전체다.
- 기본 모찌(`NONE` 등급)는 가입할 때 감정마다 1장씩 받고, 각 감정의 내 모찌로 골라진다. 뽑기·도감·진행도·교환에는 나오지 않고 내 모찌 목록에만 나온다. 카드는 `seed/mozzi_cards.csv`의 `BASIC-01` ~ `BASIC-05`다.

| 등급 | 확률 | 중복 시 별조각 | 교환가 |
|---|---|---|---|
| `COMMON` 일반 | 45% | +1 | 교환 불가 |
| `RARE` 희귀 | 30% | +2 | 교환 불가 |
| `EPIC` 영웅 | 17% | +5 | 교환 불가 |
| `LEGENDARY` 전설 | 7% | +15 | 200 |
| `MYTHIC` 신화 | 1% | +40 | 400 |

수치는 서버 설정값(`gacha_tier`)이다. 앱은 `GET /gacha/rates`의 값을 보여 준다. `NONE`은 가중치 0인 행이 있지만 확률표에는 나오지 않는다.

서버는 추첨 결과만 준다. 승급·카드 뒤집기·건너뛰기 연출은 앱이 처리한다.

## 뽑기권 지급

| type | 조건 | 뽑기권 | 지급 위치 |
|---|---|---|---|
| `SIGNUP` | 회원가입 완료 (1회) | 20 | `POST /auth/signup` |
| `DAILY_LOGIN` | 그날(Asia/Seoul) 첫 접속 | 10 | `POST /rewards/daily-login` |
| `DAILY_RECORD` | 그날 일기 작성 | 10 | `POST /diaries` |
| `CARE_PET` | 그날 첫 쓰다듬기 완료 | 5 | `POST /rewards/care` |
| `CARE_FEED` | 그날 첫 간식 주기 완료 | 5 | `POST /rewards/care` |
| `CARE_PLAY` | 그날 첫 공놀이(공 세 번) 완료 | 10 | `POST /rewards/care` |

조건을 채우면 바로 지급하고, 받은 보상을 응답에 담는다. 앱은 그 응답으로 얼럿을 띄운다. 따로 받는 API는 없다.

### `POST /rewards/daily-login` — 매일 접속 보상

앱이 켜질 때(포그라운드 진입, 로그인 직후) 호출한다. 본문 없음.

Response `200`

```json
{ "date": "2026-10-29", "granted": true, "tickets": 10, "ticketCount": 30 }
```

- 같은 날 두 번째 호출부터는 `granted: false`, `tickets: 0`으로 `200`을 준다. `ticketCount`는 현재 잔액이다.

### `POST /rewards/care` — 돌보기 보상

앱의 모찌 돌보기에서 활동 하나를 끝냈을 때 호출한다. 쓰다듬기·간식은 동작이 끝났을 때, 공놀이는 세 번째 공이 돌아왔을 때다.

Request

```json
{ "action": "PET" }
```

- `action`: `PET` · `FEED` · `PLAY`. 없거나 모르는 값이면 `400 INVALID_INPUT`.

Response `200`

```json
{ "date": "2026-11-09", "action": "PET", "type": "CARE_PET", "granted": true, "tickets": 5, "ticketCount": 35 }
```

- 활동마다 그날(Asia/Seoul) 첫 호출만 지급한다. 이후 호출은 `granted: false`, `tickets: 0`이고 `ticketCount`는 현재 잔액이다.
- 지급 키는 `CARE_PET:{date}`·`CARE_FEED:{date}`·`CARE_PLAY:{date}`, 장부 `reason`은 `CARE`다. 접속 보상처럼 서버는 활동 자체를 확인하지 않는다.
- 어느 모찌와 놀았는지는 보내지 않는다. 보상은 회원 단위다.

### `POST /diaries`의 `reward`

```json
"reward": { "type": "DAILY_RECORD", "tickets": 10, "ticketCount": 40 }
```

이미 그 날짜로 받았으면 `reward: null`. 자세한 응답은 [diary.md](diary.md#post-diaries--일기-쓰기)에 있다.

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
  "exchangeCost": null
}
```

- `code`: `S{번호}-{모찌 번호}-{감정 번호}`. 감정 번호는 01 행복 · 02 평온 · 03 보통 · 04 우울 · 05 화남. 앞자리는 카드 묶음 번호일 뿐이고 시즌 기능은 없다.
- 카드 이미지는 모든 사용자에게 같은 공개 에셋이라 URL이 고정이다. `{mozzi.gacha.image-base-url}/{image_key}`.
  - 파일 이름: `{code}_{원본 파일}_{감정 영문}.png` (예: `S2-04-01_mozzi_epic_016_happy.png`).
- 보유하지 않은 카드도 `name`, `imageUrl`, `emotion`을 내린다.
  - 교환 화면(P-08, P-09)은 교환하기 전에 받을 모찌의 그림과 이름을 보여 준다.
  - 도감(P-06)에서는 앱이 `owned`가 `false`인 카드를 "?" 칸으로 가린다.
- `ownedCount`: 뽑기·교환으로 얻은 횟수 (중복 포함). 미보유면 `0`.
- `isNew`: 얻은 뒤 도감에서 아직 보지 않은 카드. 도감의 NEW 표시.
- `exchangeCost`: 이 카드를 별조각으로 교환할 때 필요한 수. 일반·희귀·영웅은 `null`.

---

## `GET /gacha/status` — 뽑기 홈 (P-01)

Response `200`

```json
{
  "ticketCount": 23,
  "shardCount": 140,
  "collection": { "owned": 8, "total": 100 }
}
```

`collection.total`은 기본 모찌를 뺀 활성 카드 수다. `owned`도 기본 모찌는 세지 않는다. `ticketCount`로 뽑기 버튼을 정한다.

| 뽑기권 | 버튼 |
|---|---|
| 10장 이상 | 1장 뽑기, 10장 뽑기 |
| 1~9장 | 1장 뽑기, 남은 n장 뽑기 (P-01B) |
| 0장 | 둘 다 비활성 (P-01C) |

## `GET /gacha/rates` — 등급별 확률 (P-05)

Response `200`

```json
{
  "rates": [
    { "tier": "COMMON", "rate": 0.45, "duplicateShards": 1 },
    { "tier": "RARE", "rate": 0.30, "duplicateShards": 2 },
    { "tier": "EPIC", "rate": 0.17, "duplicateShards": 5 },
    { "tier": "LEGENDARY", "rate": 0.07, "duplicateShards": 15 },
    { "tier": "MYTHIC", "rate": 0.01, "duplicateShards": 40 }
  ]
}
```

`rate = weight / 100000`.

## `POST /gacha/draws` — 뽑기 (P-02 ~ P-04, P-12)

Headers: `Idempotency-Key` (필수)

Request

```json
{ "count": 10 }
```

`count`: 1~10, 보유한 뽑기권 이하. 뽑기권을 `count`장 사용한다.
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
- `firstAcquired`가 `true`면 처음 얻은 카드 (P-03 "새로운 모찌"). `false`면 중복이고 `shardsGained`만큼 별조각이 늘어난다.
- 같은 요청 안에서 같은 카드가 두 번 나오면 두 번째부터 중복으로 처리한다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `count`가 1~10이 아님 |
| 409 | `NOT_ENOUGH_TICKETS` | 뽑기권이 `count`보다 적음. 잔액은 그대로 |
| 409 | `IDEMPOTENCY_CONFLICT` | 같은 키로 다른 본문 전송 |
| 503 | `GACHA_UNAVAILABLE` | 뽑힌 등급에 활성 카드가 없음. 아무것도 차감되지 않는다 |
| 5xx | | P-11 "뽑기를 시작하지 못했어요". 같은 `Idempotency-Key`로 재시도 |

## `GET /gacha/collection` — 도감 (P-06, P-07, P-08)

Query

| 이름 | 설명 |
|---|---|
| `owned` | 선택. `false`면 미보유만 (P-06 "미보유" 탭) |
| `series` | 선택. 시리즈 이름 (P-06 "과일 모찌" 탭) |

Response `200`

```json
{
  "owned": 8,
  "total": 100,
  "shardCount": 140,
  "cards": [ /* Card */ ]
}
```

기본 모찌를 뺀 활성 카드 전체를 내린다. 카드는 등급 높은 순, 같은 등급 안에서는 `code` 순이다. P-07 모찌 상세와 P-08 교환 목록도 이 응답으로 그린다.
미보유 카드도 이름·이미지가 들어 있다. 도감 칸에서는 앱이 가리고, 교환 목록에서는 그대로 보여 준다.

## `POST /gacha/collection/seen` — NEW 표시 지우기

도감에서 카드를 본 뒤 호출한다.

```json
{ "cardIds": [13, 141] }
```

Response `204`

본인 카드 중 아직 보지 않은 것만 본 것으로 바꾼다. 없거나 보유하지 않은 ID는 무시한다.

## `POST /gacha/exchanges` — 별조각으로 교환 (P-09, P-13)

Headers: `Idempotency-Key` (필수)

Request

```json
{ "cardId": 141 }
```

필요한 별조각 수는 카드의 `exchangeCost`이며 등급별로 정해져 있다 (규칙 표).

Response `201`

```json
{
  "card": { /* Card */ },
  "shardsSpent": 200,
  "shardCount": 90
}
```

- 전설·신화 중 보유하지 않은 카드만 교환할 수 있다.
- 받은 카드는 `isNew: true`다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | `cardId` 없음 |
| 404 | `NOT_FOUND` | 없거나 비활성인 카드 |
| 409 | `CARD_NOT_EXCHANGEABLE` | 일반·희귀·영웅 카드 |
| 409 | `CARD_ALREADY_OWNED` | 이미 보유한 카드 |
| 409 | `NOT_ENOUGH_SHARDS` | 별조각 부족 |
| 409 | `IDEMPOTENCY_CONFLICT` | 같은 키로 다른 본문 전송 |

---

## 서버 처리

### 뽑기 (`POST /gacha/draws`)

한 트랜잭션에서 처리한다.

1. **입력 검사:** `count`가 1~10이 아니면 `400 INVALID_INPUT`.
2. **멱등:** `idempotency_record`(`POST /gacha/draws`)를 확인한다. 같은 키면 첫 응답을 반환한다.
3. **잠금:** `member_wallet`을 `select … for update`. `ticket_balance < count`면 `409 NOT_ENOUGH_TICKETS`.
4. **보유 목록:** 보유 카드 ID를 `ownedSet`으로 읽는다.
5. **추첨 (count번 반복):**
   1. `r = random(0..99,999)`. 가중치 누적으로 등급을 고른다.
   2. 후보 = 그 등급의 활성 카드.
   3. 전설·신화이고 후보 중 `ownedSet`에 없는 카드가 있으면 그 카드들로 줄인다.
   4. 후보에서 균등하게 1장을 뽑는다.
   5. `ownedSet`에 없으면 `firstAcquired = true`, `ownedSet`에 추가.
   6. `ownedSet`에 있으면 `shardsGained = duplicate_shards`.
6. **저장:**
   - `gacha_draw` 1행, `gacha_draw_result` count행 (`tier` 스냅샷).
   - `member_card`: 새 카드는 insert(`owned_count = 1`, `seen_at = null`), 중복은 `owned_count + 1`.
7. **지갑:** 뽑기권 −count, 별조각 +합계. 장부 `DRAW` 1행, 합계 > 0이면 `DUPLICATE` 1행.
8. **응답:** `results`, `ticketCount`, `shardCount`, `collection { owned, total }`.

- **난수:** `SecureRandom`을 감싼 `RandomSource`를 주입한다 (테스트에서 고정값).
- **동시성:** 지갑 행 잠금으로 같은 회원의 뽑기·교환을 직렬화한다. `member_card` PK가 최종 방어.
- **기동 검사:** `gacha_tier` 5행, 가중치 합 100,000. 실패하면 기동 중단.
- **빈 등급:** 뽑힌 등급에 활성 카드가 없으면 트랜잭션을 롤백하고 `503 GACHA_UNAVAILABLE`.

### 교환 (`POST /gacha/exchanges`)

1. 멱등을 확인하고 지갑을 잠근다.
2. 카드가 없거나 비활성이면 `404 NOT_FOUND`.
3. 기본 모찌(`NONE`)이거나 등급의 `exchange_cost`가 `null`이면 `409 CARD_NOT_EXCHANGEABLE`.
4. `member_card`가 있으면 `409 CARD_ALREADY_OWNED`.
5. `shard_balance < exchange_cost`면 `409 NOT_ENOUGH_SHARDS`.
6. 저장:
   - `member_card` insert (`owned_count = 1`, `seen_at = null`).
   - 별조각 −cost, `EXCHANGE` 장부.

### 보상 지급 (`DAILY_LOGIN`, `DAILY_RECORD`)

`DAILY_LOGIN`(`POST /rewards/daily-login`)과 `DAILY_RECORD`(`POST /diaries`, 일기 insert와 같은 트랜잭션)는 같은 순서로 처리한다.

1. 지갑을 `select … for update`로 잠근다.
2. 장부를 `insert … on conflict (member_id, reward_key) where reward_key is not null do nothing`.
3. 0행이면 지급하지 않는다: `granted: false` 또는 `reward: null`.
4. 1행이면 `ticket_balance + 10`.

`SIGNUP`은 가입 트랜잭션에서 `member_wallet`(뽑기권 20, 별조각 0)과 `SIGNUP` 장부를 함께 만든다. 같은 트랜잭션에서 기본 모찌 5종을 `member_card`(`seen_at` = 지급 시각, NEW 아님)로 주고, 감정마다 `my_mozzi_emoticon`으로 고른다.

기본 모찌가 생기기 전에 가입한 회원은 서버가 시작할 때 카드 등록(`MozziCardSeeder`) 바로 뒤에 `BasicMozziBackfill`이 채운다. 이미 다른 모찌를 고른 감정은 그대로 둔다.

### 회원 탈퇴

탈퇴 파기에 아래를 이 순서대로 추가한다 (`on delete cascade` 없음).

1. `gacha_draw_result`
2. `gacha_draw`
3. `member_card`
4. `wallet_ledger`
5. `member_wallet`

탈퇴는 지울 때 지갑을 먼저 잠근다. 이미 진행 중인 뽑기·교환은 끝까지 처리된 뒤에 지워진다. 인증을 통과한 뒤 탈퇴와 겹친 요청은 지갑이 사라진 것을 보고 `401 SESSION_REVOKED`를 받는다.

## 테스트

| 구분 | 확인 |
|---|---|
| 확률 | 고정 시드 100,000회, 등급 비율 ±0.3%p |
| 미보유 우선 | 전설 9/10 보유 → 남은 1장. 10/10 보유 → 10장 중 하나 |
| 요청 내 중복 | 같은 카드 2번 → 첫째 `firstAcquired`, 둘째 조각 |
| 잔액 | 뽑기권 3장: `count = 3` 성공, `count = 4` 409, 잔액 그대로 |
| 동시성 | 같은 회원 뽑기 2건 동시 → 잔액 음수 없음 |
| 멱등 | 같은 키 재전송 → 같은 결과, 1회 차감 |
| 교환 | 영웅 이하 409 `CARD_NOT_EXCHANGEABLE`, 보유 카드 409, 조각 부족 409, 전설 −200 · 신화 −400, 얻은 카드 `isNew = true` |
| 보상 | 가입 +20, 매일 접속 +10 (같은 날 2회 호출 → 1회 지급), 일기 작성 +10 (같은 날짜 1회) |
| 장부 | 잔액 = 장부 합계 |
| 탈퇴 | 뽑기 관련 행 0 |

## 범위 밖

감정 풀, 출석·주간·업적 보상, 칭호, 시즌제, 카드 초기 데이터(마이그레이션에 넣지 않는다), 일기 그림 캐릭터와 카드 연결.
