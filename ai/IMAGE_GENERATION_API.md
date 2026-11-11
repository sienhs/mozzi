# 이미지 생성 요청·결과 규격 (Spring ↔ AI 서버)

일기 그림을 만들 때 Spring이 AI 서버로 보내는 **요청 메시지**와, AI 서버가 돌려주는 **결과 메시지**의 형식이다.

- 상태: **초안 v0.1 (2026-10-27)**. 8장의 미정 항목은 팀에서 정한다.
- 전달 방식(MQ 종류, 큐 이름, Lambda 사용 여부)은 아키텍처가 정해지는 대로 따로 정한다. **이 문서의 JSON 형식은 전달 방식과 상관없이 같다.**
- 값 목록과 조합 규칙의 원본은 [configs/prompt_rules.yaml](configs/prompt_rules.yaml)이다. 둘이 다르면 yaml이 맞다.

---

## 1. 원칙: Spring은 프롬프트 문장을 만들지 않는다

Spring은 일기에서 고른 **값(코드)만** 보낸다. 영어 프롬프트 문장은 AI 서버가 만든다.

```
Spring: {"mood": "happy", "activities": ["cooking"], "place": "home", ...}
   ↓
AI 서버: "mochi_char, happy, cooking, home kitchen, sunny window light, medium shot, warm children's ..."
```

**이유**
- LoRA는 **정해진 순서와 표현의 캡션**으로 학습됐다. 단어 하나만 바뀌어도 결과가 달라진다. 예: 동료를 `coworker`라고 쓰면 사람으로 그려진다.
- 문구를 고칠 때마다 Java를 다시 배포하지 않아도 된다. 문구는 AI 쪽에서 시험한 뒤 바꾼다.

---

## 2. 요청 메시지 (Spring → AI 서버)

```json
{
  "job_id": "diary-1234-v2",
  "diary_id": 1234,
  "requested_at": "2026-10-27T15:10:35+09:00",
  "scene": {
    "mood": "happy",
    "activities": ["cooking", "reading"],
    "place": "home",
    "companions": ["family"],
    "weather": "sunny",
    "shot": null,
    "diary_detail": null
  },
  "character": null,
  "output": {
    "s3_key": "diary/1234/v2.png",
    "upload_url": "https://...presigned PUT URL..."
  }
}
```

### 2-1. 공통 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `job_id` | string | O | 요청 고유 ID. **같은 일기를 고쳐서 다시 요청하면 새 ID**를 쓴다 (예: `diary-{id}-v{버전}`). 결과 중복을 거르는 데 쓴다 |
| `diary_id` | number | O | 일기 ID |
| `requested_at` | string (ISO 8601, 시간대 포함) | O | 요청 시각. 너무 오래된 요청을 거르는 데 쓴다 |
| `scene` | object | O | 장면 값 (2-2) |
| `character` | object \| null | X | 특색(뽑기) 캐릭터. 기본 모찌면 `null` (2-3) |
| `output` | object | O | 결과 이미지를 올릴 위치 (8장 미정 ②) |

### 2-2. `scene`: 장면 값

| 필드 | 타입 | 필수 | 허용 값 | 기본값 |
|---|---|---|---|---|
| `mood` | string | O | `happy` 행복 · `calm` 평온 · `neutral` 기본 · `sad` 우울 · `angry` 화남 | |
| `activities` | string[] | O, 1~3개 | 아래 활동 코드. **첫 번째가 메인 활동(⭐)**, 나머지는 소품으로 들어간다 | |
| `place` | string | X | `home` 집 · `cafe` 카페 · `office_school` 회사/학교 · `park` 공원 · `restaurant` 식당 · `travel_spot` 여행지 | `home` |
| `companions` | string[] | X, 최대 2마리 | `friend` 친구 · `family` 가족 · `partner` 연인 · `coworker` 동료 · `pet:puppy` 강아지 · `pet:kitten` 고양이. 같은 종류 2마리는 `family:2`처럼 쓴다 (`friend`·`family`·`partner`·`coworker`만, 반려동물은 종류별 1마리). 혼자면 `[]` | `[]` |
| `weather` | string | O | `sunny` 맑음 · `cloudy` 흐림 · `rainy` 비 · `snowy` 눈 | |
| `shot` | string \| null | X | `close_up` · `medium` · `full` · `small_in_scene` | `medium` |
| `diary_detail` | string \| null | X | 일기 속 디테일 하나를 영어 짧은 구로 (예: `a small birthday cake with candles`). **당분간 `null`** (8장 미정 ③) | `null` |

**활동 코드 (13종)**

| 코드 | 한글 | 코드 | 한글 | 코드 | 한글 |
|---|---|---|---|---|---|
| `exercise` | 운동 | `studying` | 공부 | `shopping` | 쇼핑 |
| `walk` | 산책 | `work` | 일하기 | `resting` | 휴식 |
| `reading` | 독서 | `cooking` | 요리 | `traveling` | 여행 |
| `movie` | 영화 보기 | `cleaning` | 청소 | | |
| `gaming` | 게임 | `eating` | 식사 | | |

### 2-3. `character`: 특색(뽑기) 캐릭터

```json
"character": { "code": "lemon", "ref_image_url": "https://.../lemon_happy.png" }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `code` | string | O | 캐릭터 코드. 현재 시험한 코드: `lemon`, `watermelon`, `rain` |
| `ref_image_url` | string | O | 참조 이미지 **1장**. AI 서버가 내려받을 수 있는 주소(S3 presigned GET 등). 감정별 이미지가 있으면 **`scene.mood`와 같은 감정의 이미지**를 보낸다. 1장뿐인 캐릭터는 그 1장을 보낸다 |

- 캐릭터 외형 문구(예: `wearing a yellow lemon bucket hat ...`)는 AI 쪽 yaml에서 관리한다 (8장 미정 ④).
- 시험 결과: 참조 이미지를 넣으면 원본과 가장 비슷하게 나온다. 이미지 1장도 충분하다. 표정은 장면의 `mood`를 따른다.

---

## 3. 조합 규칙 (안 되는 조합)

아래 조합은 AI 서버가 **거부한다** (`INVALID_INPUT`). 앱 화면에서 미리 막아 주는 것이 가장 좋다.

### 3-1. 메인 활동 × 장소

| 메인 활동 | 가능한 장소 |
|---|---|
| `exercise` | home, park, travel_spot |
| `walk` | park, travel_spot |
| `reading` | home, cafe, office_school, park |
| `movie` | home |
| `gaming` | home, cafe |
| `studying` | home, cafe, office_school |
| `work` | home, cafe, office_school |
| `cooking` | home, restaurant |
| `cleaning` | home, office_school |
| `eating` | home, cafe, restaurant, park, travel_spot, office_school (전부) |
| `shopping` | home, travel_spot |
| `resting` | home, cafe, park, travel_spot |
| `traveling` | travel_spot |

### 3-2. 그 밖의 규칙

| 규칙 | 내용 |
|---|---|
| 서브 활동(2·3번째) 소품 | `movie` · `gaming` · `cooking` · `cleaning` · `resting`은 **실내 장소**(home, cafe, office_school, restaurant)에서만 서브 활동으로 쓸 수 있다 |
| 동행 × 장소 | `coworker`는 home 불가 / `family`, `partner`는 office_school 불가 / `pet`은 office_school, restaurant 불가 |
| 동행 × 구도 | 동행이 있으면 `close_up`, `small_in_scene` 불가 |
| 동행 수 | 최대 2마리 (`family:2`는 2마리로 센다) |
| 활동 수 | 1~3개 |

> 8장 미정 ⑤: 서브 소품이나 구도처럼 가벼운 위반은 AI 서버가 **자동으로 고쳐서**(해당 소품 빼기, 구도를 `medium`으로) 그릴지 정해야 한다.

---

## 4. 결과 메시지 (AI 서버 → Spring)

```json
{
  "job_id": "diary-1234-v2",
  "status": "success",
  "image": { "s3_key": "diary/1234/v2.png", "width": 768, "height": 768 },
  "worker": "gpu_server",
  "prompt": "mochi_char, happy, cooking, home kitchen, with a pale yellow family mochi, ...",
  "timing": { "queue_wait_sec": 3.2, "gen_sec": 4.1 },
  "finished_at": "2026-10-27T15:10:44+09:00",
  "error": null
}
```

| 필드 | 설명 |
|---|---|
| `job_id` | 요청의 `job_id` 그대로 |
| `status` | `success` \| `failed` |
| `image` | 성공했을 때만 값이 있다. 현재 크기는 768×768 (8장 미정 ⑥) |
| `worker` | 누가 그렸는지: `gpu_server` \| `laptop` \| `external_api` |
| `prompt` | 실제로 쓴 프롬프트. 디버깅용이고 저장은 선택이다 |
| `timing` | 대기 시간, 생성 시간 (초) |
| `error` | 실패했을 때만: `{"code": "...", "message": "..."}` |

**에러 코드**

| code | 의미 | Spring 처리 (제안) |
|---|---|---|
| `INVALID_INPUT` | 값이 허용 목록에 없거나 3장 규칙 위반. `message`에 이유 (예: `excluded: main activity 'walk' at 'home'`) | 재시도하지 않는다. 입력을 고친다 |
| `REF_IMAGE_FAILED` | `ref_image_url`을 받지 못함 | 재시도 1회 |
| `GENERATION_FAILED` | 생성 중 오류 | 재시도, 또는 외부 API로 대체 |
| `EXPIRED` | `requested_at`이 너무 오래돼서 그리지 않음 | 대체 경로에서 처리 |

**중복:** 같은 `job_id`의 결과가 두 번 올 수 있다. 예를 들어 GPU 서버가 늦게 끝났는데 외부 API로도 처리된 경우다. **먼저 도착한 결과를 쓰고 나머지는 무시한다.**

---

## 5. 예시

**기본 모찌, 혼자, 공원 산책**
```json
{"mood": "calm", "activities": ["walk"], "place": "park", "companions": [], "weather": "snowy", "shot": "full"}
```
→ `mochi_char, calm, walking, park, gentle snowfall and snowy ground, full shot, warm children's picture-book illustration, ...`

**친구 2명과 집에서 요리, 책은 소품으로**
```json
{"mood": "happy", "activities": ["cooking", "reading"], "place": "home", "companions": ["friend:2"], "weather": "sunny"}
```
→ `mochi_char, happy, cooking, home kitchen, with two pale peach friend mochi, sunny window light, an open book on the table, medium shot, ...`

**강아지·고양이와 공원 산책**
```json
{"mood": "calm", "activities": ["walk"], "place": "park", "companions": ["pet:puppy", "pet:kitten"], "weather": "snowy", "shot": "full"}
```

**거부되는 예**
```json
{"mood": "sad", "activities": ["walk"], "place": "home", "weather": "rainy"}
```
→ `INVALID_INPUT`: `excluded: main activity 'walk' at 'home'` (산책은 공원·여행지만)

---

## 6. 앱 화면에 쓸 한글 라벨

라벨 전체는 [configs/labels_ko.yaml](configs/labels_ko.yaml)에 있다. 화면 표기를 바꿔도 **코드 값은 바꾸지 않는다.**

---

## 7. 처리 시간 (참고, 실측)

| 환경 | 장당 생성 | 비고 |
|---|---|---|
| 노트북 RTX 4050 6GB, gguf_q4, 768 | 7.5초 (기본) / 12.9초 (참조 이미지 1장) | 모델 교체를 포함하면 요청 1건당 약 40~45초 (추정) |
| GPU 서버 H200 | 측정 예정 | |

---

## 8. 미정 항목 (팀에서 정할 것)

| # | 항목 | 선택지 |
|---|---|---|
| ① | 전달 방식 | RabbitMQ (TTL로 자동 대체) / SQS + Lambda / HTTP |
| ② | 결과 이미지 업로드 | Spring이 presigned PUT URL을 준다 (AI 서버에 AWS 키 불필요, 추천) / AI 서버가 자체 IAM 키로 올린다 |
| ③ | `diary_detail` (일기 → 영어 디테일) | 당분간 `null` / Spring이 LLM으로 뽑아서 보낸다 / AI 서버가 일기 원문을 받아서 뽑는다 |
| ④ | 캐릭터 외형 문구를 둘 곳 | AI yaml에서 관리 (`code`만 전송, 문구를 시험한 뒤 반영) / DB에서 관리해서 문구를 같이 전송 |
| ⑤ | 가벼운 규칙 위반 | 거부 / AI 서버가 자동 보정 |
| ⑥ | 이미지 크기 | 768×768 (현재 실험 기준) / 다른 비율 |
| ⑦ | 대기 한도 | 몇 초 안에 못 그리면 외부 API로 넘길지 |
