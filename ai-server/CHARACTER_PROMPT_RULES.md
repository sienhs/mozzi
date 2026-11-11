# 특색 캐릭터 문구 규칙 (`characterPrompt`)

뽑기 캐릭터를 만들 때 쓴 원본 프롬프트(스티커 한 장용)를 **일기 그림용 짧은 문구**로 바꾸는 규칙이다.
백엔드는 이 규칙으로 만든 문구를 DB에 저장해 두고, 이미지 생성 요청의 `characterPrompt`로 보낸다.

- 상태: 초안 (2026-10-28). 시험 생성 결과에 따라 고친다.
- 근거: [ai/experiments.md](../ai/experiments.md) 2026-10-26 특색(뽑기) 캐릭터 재현 시험

---

## 1. 왜 원본을 그대로 쓰지 않나

원본 프롬프트는 스티커 한 장을 완성하기 위한 글이라 표정, 포즈, 들고 있는 물건, 빛 효과, 배경 분위기까지 정한다.
일기 그림에서는 이것들을 다른 값이 정한다.

| 그림 요소 | 일기 그림에서 정하는 값 |
|---|---|
| 표정 | 일기의 감정 |
| 포즈, 손에 든 것 | 일기의 활동 (`what`) |
| 배경, 빛 | 장소 (`where`), 시간대 (`timeOfDay`) |
| **옷, 모자, 장식** | **`characterPrompt`** ← 이 문구가 맡는 것은 이것뿐 |

원본을 그대로 넣으면 둘이 부딪친다. 10/26 시험에서 "반쪽 레몬을 들고 있다"는 문구 때문에 파스타를 먹는 장면이 레몬을 든 그림이 됐다.

---

## 2. 언제 만들고 어디에 두나

| 시점 | 할 일 |
|---|---|
| 캐릭터를 만들 때 **1번** | 원본 프롬프트 → 변환 (사람 또는 LLM, 9장) → 자동 검사 (8장) → DB에 저장 |
| 일기 요청마다 | 저장된 문구를 그대로 `characterPrompt`로 보낸다. **매번 새로 만들지 않는다** (같은 캐릭터가 그릴 때마다 달라진다) |
| 기본 모찌 | `characterImageUrl: "DEFAULT"`. 이때 워커는 `characterPrompt`(기본 모찌 설명)를 쓰지 않는다. 기본 모찌는 학습한 트리거(`mochi_char`)가 이미 그린다 |

- 원본 프롬프트는 지우지 않고 따로 둔다. 규칙이 바뀌면 다시 변환한다.
- DB 칸 이름 예: `character.diary_prompt` (원본은 `character.source_prompt`)

---

## 3. 문구가 들어가는 자리

워커는 문구를 캐릭터 트리거(`mochi_char`) **바로 뒤에** 붙인다.

```
mochi_char wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim, happy, cooking, home kitchen, ...
           └──────────────────────────────── characterPrompt ────────────────────────────────────────┘
```

여기서 두 가지 규칙이 나온다.

- **`wearing`으로 시작한다.** `mochi_char` 다음에 자연스럽게 이어져서, 옷이 모찌의 것으로 묶인다.
- **쉼표를 쓰지 않는다.** 캡션은 쉼표로 감정, 활동, 장소를 나눈다. 문구 안에 쉼표가 있으면 뒷부분이 다른 항목으로 읽힌다. `and`, `with`로 잇는다.

참조 이미지(`characterImageUrl`)도 같이 들어간다. 글은 "무엇을 입었는지"를 알려 주고, 세밀한 모양은 참조 이미지가 채운다. 그래서 모든 세부를 다 쓸 필요는 없다.

---

## 4. 형식

| 항목 | 규칙 |
|---|---|
| 언어 | 영어, 모두 소문자 |
| 시작 | `wearing ` |
| 길이 | **120자 이하** (공백 포함) |
| 문장부호 | 쉼표, 마침표, 따옴표, 괄호, 줄바꿈 없음. 하이픈(`-`)만 허용 |
| 항목 수 | 옷·장식 **2~3개** (가장 눈에 띄는 것부터) |
| 순서 | 머리 → 몸 → 목·작은 장식 |
| 각 항목 | **색 + 모양 + 위치** (`a red cape` 보다 `a short deep purple cape with gold trim`) |

---

## 5. 원본에서 무엇을 남기나

원본 프롬프트의 항목별로 정리했다.

| 원본 항목 | 처리 | 이유 |
|---|---|---|
| Name, tier, event | ❌ 버림 | 이름의 `wizard`는 사람이나 고깔모자로, `Halloween`은 장면 전체의 분위기로 번진다 |
| Emotion set | ❌ 버림 | 감정은 일기가 정한다 |
| **Wears** | ✅ **남김** (줄여서) | 이 문구의 중심 재료다 |
| Holds | ✅ 남김 (10/29 결정) | `and holding ...`으로 붙인다. 활동 소품을 밀어낼 수 있지만 캐릭터 소품을 살리기로 했다 (1장의 레몬 사례처럼 그날 한 일이 덜 보일 수 있다) |
| Expression | ❌ 버림 | 감정이 정한다 |
| Arm pose | ❌ 버림 | 활동이 정한다 |
| Emotion details | ❌ 버림 | 감정별 차이는 감정이 정한다 |
| Effects (오라, 반짝이, 빛) | ❌ 버림 | 동화책 그림체가 깨지고, 집·카페 장면에도 빛이 떠다닌다 |
| Costume check | ❌ 버림 | 단, **어떤 옷이 핵심인지 고를 때** 참고한다 |

---

## 6. 쓰지 않는 단어

| 종류 | 예 | 문제 | 대신 |
|---|---|---|---|
| 사람·역할 | wizard, witch, princess, knight, chef, maid, girl, boy, man, woman, person, human, kid, worker, student | 사람이 그려진다 (`coworker`가 직장인으로 나온 적 있음) | 옷 모양으로: `witch hat` → `a tall pointed purple hat` |
| 동물 이름 | bat, cat, bunny, bear, dog, bird, fox | 그 동물이 따로 그려진다 | 모양으로: `bat-wing collar` → `scalloped collar` |
| 행사·테마 | halloween, christmas, valentine, event, festival, party, spooky | 장면 전체가 그 테마로 바뀐다 | 쓰지 않는다. 옷만으로 충분하다 |
| 빛·효과 | glow, glowing, aura, sparkle, sparkling, wisp, magic, magical, shimmer, flame, lit | 배경과 그림체가 바뀐다 | 쓰지 않는다 |
| 화풍 | sticker, cute, kawaii, chibi, 3d, render, glossy, outline, pixel, anime | 워커의 화풍 문구와 충돌한다 | 쓰지 않는다 |
| 표정·포즈 | smile, smiling, happy, sad, angry, tear, crying, eyes, mouth, raised, waving | 감정, 활동과 충돌한다 | 쓰지 않는다 |
| 몸 | mochi, body, white, round blob, cheeks | 기본 모찌 설명과 겹치거나, `mochi`가 모찌를 한 마리 더 그리게 한다 | 쓰지 않는다 |
| 이름·등급 | mythic, legendary, epic, rare, tier, 캐릭터 이름 | 의미 없이 길이만 차지한다 | 쓰지 않는다 |

과일, 채소, 음식 이름은 **옷에 붙여서** 쓰면 된다 (`pumpkin hood`, `lemon bucket hat`, `watermelon rind hood`).
단독으로 쓰면(`with pumpkins`) 배경에 그 물건이 잔뜩 그려진다.

---

## 7. 색 주의

동행 모찌는 색으로 구분한다.

| 동행 | 색 |
|---|---|
| 친구 | 연한 복숭아색 (pale peach) |
| 가족 | 연노랑 (pale yellow) |
| 연인 | 연분홍 (pale pink) + 하트 |
| 동료 | 연파랑 (pale blue) |

- 옷이 이 색들 위주면 동행과 섞일 수 있다. **진한 색 이름**(`deep purple`, `bright red`, `orange`)을 쓰고 `pale`은 피한다.
- **몸 색 자체가 흰색이 아닌 캐릭터**는 이 문구로 표현할 수 없다. 워커의 기본 설명이 "몸은 흰색"으로 고정되어 있다. 이런 캐릭터가 나오면 AI 담당에게 알린다.

---

## 8. 자동 검사

저장하기 전에 백엔드가 검사한다. 워커도 같은 검사를 한다.

1. `^(wearing|holding) [a-z][a-z -]*$` 에 맞는다 (소문자, 공백, 하이픈만). 입은 것이 없는 캐릭터는 `holding ...`으로 시작한다
2. 길이 120자 이하
3. 6장의 단어가 **단어 단위로** 없다 (`light blue`의 `light`처럼 색 이름 안의 단어는 걸리지 않게, 금지 목록에 `light`는 넣지 않았다)

워커는 검사를 통과하지 못한 문구를 빼고 참조 이미지만으로 그린다. 그리고 결과에 보정 내역을 남긴다 (구현 예정).

---

## 9. 예시

### 9-1. 호박 마법사 모찌 (원본 → 변환)

원본의 Wears 줄:

> a round pumpkin hood in warm orange with soft ridges, stopping above the eyebrows, its green stem and a curly vine with two leaves forming a little crown on top; plus a short deep-purple cape draped around the upper body, its collar shaped like two small bat wings (wing shapes only, no bat face).

변환 결과 (105자):

```
wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim
```

| 원본 표현 | 처리 |
|---|---|
| `stopping above the eyebrows` | 버림. 얼굴 위치는 참조 이미지가 맡는다 |
| `soft ridges`, `two leaves`, `crown` | 버림. 길이가 모자라고 참조 이미지에 있다 |
| `bat wings` | 버림. 박쥐가 그려진다 |
| `gold trim` | **추가.** 원본 글에는 없지만 그림에서 눈에 띈다 |
| 호박 랜턴 (Holds) | 넣어도 된다: `... and holding a pumpkin lantern` |
| 도깨비불, 오라, 반짝이 (Effects) | 버림 |

잘못된 예:

| 문구 | 문제 |
|---|---|
| `wearing a pumpkin wizard costume for halloween` | `wizard`(사람), `halloween`(테마), 색·모양이 없음 |
| `wearing an orange pumpkin hood, holding a glowing jack-o'-lantern` | 쉼표, `glowing`, 따옴표 (`and holding`으로 이으면 된다) |
| `a white mochi wearing an orange pumpkin hood` | `wearing`으로 시작하지 않음, `white mochi` |

### 9-2. 기존 캐릭터 (이 규칙으로 다시 쓴 것)

| 캐릭터 | 문구 | 길이 |
|---|---|---|
| 레몬 | `wearing a yellow lemon bucket hat with a green leaf on top and a lemon slice pattern on the brim` | 96 |
| 수박 | `wearing a green striped watermelon rind hood with a curly stem on top and a red watermelon cape with black seeds` | 112 |
| 비 | `wearing a soft grey hooded raincoat tied with a light blue ribbon bow and a teardrop charm` | 90 |

위 문구는 들고 있는 것을 뺀 버전이다. 10/29부터 `holding`을 허용하므로 `... and holding half a yellow lemon`처럼 붙여도 된다. 실제 캐릭터 144개의 문구는 캐릭터 매칭표의 phrase 열을 그대로 쓴다 (전부 8장 검사 통과).

---

## 10. LLM으로 변환할 때 (선택)

캐릭터를 뽑을 때마다 새로 만들어진다면 사람이 매번 쓸 수 없다. 그때는 LLM에 아래 지시문과 원본 프롬프트를 주고, 결과를 8장 검사에 통과시킨다. 통과하지 못하면 2번까지 다시 요청하고, 그래도 안 되면 `null`로 저장한다(참조 이미지만으로 그린다).

```text
Convert a sticker-generation prompt for a character into a short appearance phrase
for a diary illustration.

The base character "Mochi" (a white round blob with pink cheeks) is already described
elsewhere. Your phrase describes ONLY the outfit and accessories this special version wears,
plus at most one item it holds.
Expression, pose, background and effects are decided by the diary, not by you.

Rules:
- Use the "Wears" part of the input. Ignore name, tier, event, emotion, expression,
  pose, effects and costume checks. You may add the one main held item as "and holding ...".
- Start with "wearing " ("holding " if it wears nothing). English, all lowercase.
- At most 120 characters. No commas, periods, quotes or parentheses; join items with "and" / "with".
- 2-3 items, most visible first, head -> body -> small accessories. Each item: color + shape + position.
- Never use: people or role words (wizard, witch, princess, knight, girl, boy, person ...),
  animal names (bat, cat, bunny ...), event or theme words (halloween, christmas, party ...),
  effect words (glow, aura, sparkle, magic ...), style words (sticker, cute, chibi, 3d ...),
  expression or pose words, "mochi", "body", "white".
- Fruit, vegetable or food names are fine only as part of clothing ("pumpkin hood").
- Prefer strong color names (deep purple, bright red, orange) over "pale ...".

Examples:
- wearing a yellow lemon bucket hat with a green leaf on top and a lemon slice pattern on the brim
- wearing a soft grey hooded raincoat tied with a light blue ribbon bow and a teardrop charm

Return JSON only:
{"characterPrompt": "<phrase>", "dropped": ["<things in Wears you left out and why>"]}
```

`dropped`는 저장하지 않아도 된다. 문구가 이상할 때 원인을 찾는 데 쓴다.

---

## 11. 참조 이미지 (`characterImageUrl`)

- 캐릭터의 **기본 이미지 1장**을 보낸다. 감정마다 다른 이미지를 고를 필요는 없다. 표정은 일기의 감정(`emotion`)이 정한다 (10/26 레몬 시험에서 참조 이미지와 표정이 달라도 감정을 따랐다).
- 배경과 효과(오라, 반짝이)가 없는 버전이 있으면 그것을 보낸다. 참조 이미지의 어두운 배경과 빛이 장면으로 번질 수 있다.
- 형식: png, webp, jpg. 투명 배경은 워커가 흰색으로 채우고 768px로 줄인다.
- 워커가 내려받을 수 있는 주소여야 한다 (S3 presigned GET 등).

---

## 12. 새 캐릭터 시험 

캐릭터 세트를 미리 만드는 경우, 새 캐릭터는 문구를 저장하기 전에 몇 장 그려 본다.

| 장면 | 확인할 것 |
|---|---|
| 먹는 장면 | 활동 소품(음식)이 남아 있는지. 캐릭터 소품만 들고 있어도 허용한다 (10/29 결정) |
| 연인 동행 장면 | 동행 모찌와 색이 섞이지 않는다 |
| 우울, 화남 | 표정이 감정을 따른다 |
| 공원 같은 바깥 장소 | 배경에 테마 물건(호박, 도깨비불 등)이 번지지 않는다 |

옷이 알아볼 만큼 재현되고 장면이 망가지지 않으면 통과다.

---

## 13. 정할 것

- 요청의 감정(`emotion`)이 비거나 모르는 값이면 표정은 `neutral`로 그려진다.
- 몸 색이 흰색이 아닌 캐릭터를 어떻게 다룰지 (7장)
- 캐릭터 세트를 미리 만드는지, 뽑을 때마다 새로 만드는지 (사람 확인을 할 수 있는지가 달라진다)
