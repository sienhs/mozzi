# 뽑기 캐릭터 프롬프트 → 일기용 문구 변환 작업

뽑기 캐릭터 이미지를 만들 때 쓴 프롬프트를, 일기 그림에 넣을 **짧은 문구 한 줄**로 바꾸는 작업입니다.
캐릭터마다 문구 1줄을 만들어서 7장 형식으로 넘겨주세요.

```
[원본] THIS CHARACTER: - Name: "Pumpkin Wizard Mozzi" ... - Wears: a round pumpkin hood ... - Holds: ... - Effects: ...
   ↓
[결과] wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim
```

---

## 1. 이 문구가 하는 일

일기 그림을 그릴 때 이 문구와 캐릭터 이미지를 같이 넣어서 "이 모찌는 이 옷을 입었다"를 알려 줍니다.
그림의 나머지는 일기가 정합니다.

| 그림 요소 | 정하는 것 |
|---|---|
| 표정 | 그날 감정 |
| 포즈, 손에 든 것 | 그날 한 일 (요리, 독서 ...) |
| 배경, 빛 | 장소, 시간대 |
| **옷, 모자, 장식** | **← 이 문구** |

원본 프롬프트는 스티커 한 장을 완성하는 글이라 표정, 포즈, 소품, 효과까지 다 정해 둡니다. 그대로 넣으면 일기와 부딪칩니다.
실제로 레몬 모찌 문구에 "반쪽 레몬을 들고 있다"가 있었더니, 파스타를 먹는 일기가 레몬을 든 그림으로 나왔습니다.

---

## 2. 원본에서 쓰는 것과 버리는 것

| 원본 항목 | 처리 |
|---|---|
| Name, tier, event | ❌ 버림 |
| Emotion set, Expression, Emotion details | ❌ 버림 |
| **Wears** | ✅ **씀** (줄여서) |
| Holds | ✅ 씀 (10/29 결정). 대표 소품 하나를 `and holding ...`으로 붙입니다. 그날 한 일의 소품이 덜 보일 수 있습니다 |
| Arm pose | ❌ 버림 |
| Effects (오라, 반짝이, 빛, 도깨비불) | ❌ 버림 |
| Costume check | ❌ 버림. 단, 어떤 옷이 핵심인지 고를 때 참고 |

---

## 3. 변환할 때 유의할 점

### 3-1. 글보다 **완성된 그림**을 기준으로
원본 글과 실제 이미지가 다른 경우가 많습니다. 그림을 그릴 때 참조하는 건 이미지라서, **이미지에 실제로 보이는 것**을 써야 합니다.
- 호박 모찌: 원본 글에는 없지만 이미지에 **금색 테두리와 금색 브로치**가 눈에 띕니다 → `gold trim`을 넣었습니다.
- 글에는 있지만 이미지에서 잘 안 보이는 것은 뺍니다.

### 3-2. 감정 5장에 **모두 있는 것만**
감정별 이미지를 같이 보고, 다섯 장 모두에 있는 것만 씁니다. 우울한 버전에만 있는 눈물이나, 행복한 버전에서만 위로 말린 덩굴 같은 것은 빼세요.

### 3-3. 2~3개만, 눈에 띄는 순서로
- 가장 눈에 띄는 옷·장식 2~3개를 고릅니다. 순서는 머리 → 몸 → 작은 장식입니다.
- 길면 일기의 장소·활동 문구가 약해집니다. 세밀한 모양은 참조 이미지가 채워 주니 다 쓰지 않아도 됩니다.

### 3-4. 하나씩 **색 + 모양 + 위치**로
- ❌ `a hat`
- ✅ `a yellow lemon bucket hat with a green leaf on top`

### 3-5. 형식
- [ ] `wearing `으로 시작
- [ ] 영어, **모두 소문자**
- [ ] **120자 이하** (공백 포함)
- [ ] **쉼표, 마침표, 따옴표, 괄호 없음** (하이픈 `-`은 괜찮음). 항목은 `and`, `with`로 잇기

쉼표를 쓰면 안 되는 이유: 그릴 때 이 문구 뒤에 `, happy, cooking, home kitchen`처럼 쉼표로 다른 정보가 붙습니다. 문구 안에 쉼표가 있으면 중간에서 끊겨 읽힙니다.

### 3-6. 쓰지 않는 단어

| 종류 | 예 | 이렇게 됩니다 | 대신 |
|---|---|---|---|
| 사람·직업·역할 | wizard, witch, princess, knight, chef, maid, girl, boy, person | 사람이 그려짐 | 옷 모양으로: `witch hat` → `a tall pointed purple hat` |
| 동물 이름 | bat, cat, bunny, bear, dog, bird, fox | 그 동물이 따로 그려짐 | 모양으로: `bat-wing collar` → `scalloped collar` |
| 행사·테마 | halloween, christmas, valentine, party, spooky | 장면 전체가 그 테마로 바뀜 | 쓰지 않음 |
| 빛·효과 | glow, glowing, aura, sparkle, wisp, magic, shimmer, flame | 배경에 빛이 떠다니고 그림체가 바뀜 | 쓰지 않음 |
| 그림체 | sticker, cute, kawaii, chibi, 3d, glossy, outline | 일기 그림체(동화책 크레파스)와 충돌 | 쓰지 않음 |
| 표정·포즈 | smile, happy, sad, tear, eyes, mouth, raised, waving | 그날 감정과 충돌 | 쓰지 않음 |
| 몸 | mochi, body, white, round, cheeks | 모찌가 한 마리 더 그려지거나 기본 설명과 겹침 | 쓰지 않음 (기본 모찌 설명은 따로 들어감) |
| 이름·등급 | mythic, legendary, epic, rare, 캐릭터 이름 | 길이만 차지 | 쓰지 않음 |

- 과일, 채소, 음식 이름은 **옷에 붙이면** 괜찮습니다: `pumpkin hood`, `lemon bucket hat`.
  따로 쓰면(`with pumpkins`) 배경에 호박이 잔뜩 그려집니다.

### 3-7. 색은 진하게
함께 그려지는 친구·가족 모찌가 연한 색(연분홍, 연파랑, 연노랑, 복숭아색)입니다. `pale pink` 같은 색은 섞여 보일 수 있으니 진한 색 이름(`deep purple`, `bright red`, `orange`)을 쓰세요.

### 3-8. 캐릭터끼리 표현을 맞추기
같은 종류의 옷은 같은 단어로 씁니다. 어떤 캐릭터는 `hood`, 비슷한 다른 캐릭터는 `cap`, `bonnet`처럼 섞이면 결과가 들쭉날쭉해집니다. 자주 나오는 단어:

| 부위 | 쓸 단어 |
|---|---|
| 머리 전체를 덮는 것 | `hood` |
| 챙 있는 모자 | `bucket hat` / `hat` |
| 어깨에 두르는 것 | `cape` |
| 목 장식 | `ribbon bow`, `scarf`, `collar` |
| 작은 장식 | `charm`, `brooch` |

### 3-9. 이렇게 된 캐릭터는 따로 표시
아래 경우는 문구만으로 해결이 안 될 수 있습니다. 7장 `note`에 적어 주세요.
- **몸 색이 흰색이 아닌 캐릭터** (예: 몸 전체가 분홍색). 일기 그림은 "몸은 흰색"으로 고정되어 있습니다.
- 옷이 너무 복잡해서 2~3개로 줄이기 어려운 경우

---

## 4. 예시

### 호박 마법사 모찌

원본 `Wears:`

> a round pumpkin hood in warm orange with soft ridges, stopping above the eyebrows, its green stem and a curly vine with two leaves forming a little crown on top; plus a short deep-purple cape draped around the upper body, its collar shaped like two small bat wings (wing shapes only, no bat face).

결과 (105자)

```
wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim
```

| 원본 | 처리 | 이유 |
|---|---|---|
| `stopping above the eyebrows` | 뺌 | 얼굴 위치는 이미지가 맡음 |
| `soft ridges`, `two leaves`, `crown` | 뺌 | 길이. 이미지에 있음 |
| `bat wings` | 뺌 | 박쥐가 그려짐 |
| `gold trim` | **넣음** | 글에 없지만 그림에서 눈에 띔 (3-1) |
| Holds 호박 랜턴 | 넣어도 됨 | `... and holding a pumpkin lantern` |
| Effects 도깨비불, 오라 | 뺌 | 빛·효과 |

### 다른 캐릭터

| 캐릭터 | 결과 |
|---|---|
| 레몬 | `wearing a yellow lemon bucket hat with a green leaf on top and a lemon slice pattern on the brim` |
| 수박 | `wearing a green striped watermelon rind hood with a curly stem on top and a red watermelon cape with black seeds` |
| 비 | `wearing a soft grey hooded raincoat tied with a light blue ribbon bow and a teardrop charm` |

### 자주 하는 실수

| 문구 | 문제 |
|---|---|
| `wearing a pumpkin wizard costume for halloween` | `wizard`, `halloween`, 색·모양 없음 |
| `wearing an orange pumpkin hood, holding a glowing jack-o'-lantern` | 쉼표, `glowing`, 따옴표 (`and holding`으로 이으면 됨) |
| `a white mochi wearing an orange pumpkin hood` | `wearing`으로 시작 안 함, `white mochi` |
| `Wearing An Orange Pumpkin Hood.` | 대문자, 마침표 |

---

## 5. ChatGPT 같은 LLM으로 변환할 때

여러 캐릭터를 한 번에 바꾸려면 LLM에 아래 지시문과 **원본 프롬프트 + 캐릭터 이미지**를 같이 주세요.
결과는 반드시 사람이 이미지와 비교해서 3장 기준으로 한 번 확인해 주세요. LLM은 글만 보고 이미지에 없는 것을 쓰거나, 쉼표·금지어를 자주 넣습니다.

```text
Convert a sticker-generation prompt for a character into a short appearance phrase
for a diary illustration. Look at the attached character image(s) as well as the text.

The base character "Mochi" (a white round blob with pink cheeks) is described elsewhere.
Your phrase describes ONLY the outfit and accessories this special version wears,
plus at most one item it holds.
Expression, pose, background and effects are decided by the diary, not by you.

Rules:
- Use the "Wears" part of the text (plus one main "Holds" item), checked against the image. If the image shows a
  clearly visible outfit detail the text misses, you may add it. Drop details not visible.
- If several emotion images are attached, describe only what appears in all of them.
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
{"phrase": "<phrase>", "dropped": ["<things you left out and why>"]}
```

---

## 6. 하지 말 것

- **원본 프롬프트를 고치지 마세요.** 원본은 그대로 두고 결과만 따로 만듭니다. 규칙이 바뀌면 원본에서 다시 변환합니다.
- 한 캐릭터에 문구를 여러 개 만들지 마세요. **캐릭터당 1줄**입니다.
- 기본(흰) 모찌는 문구를 만들지 않습니다. 빈칸으로 두세요.

---

## 7. 넘겨줄 형식

CSV(또는 시트) 한 장으로 주세요. 캐릭터 1개 = 1줄입니다.

| code | name | phrase | length | note |
|---|---|---|---|---|
| pumpkin_wizard | 호박 마법사 모찌 | wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim | 105 | 랜턴은 뺐음 |
| lemon | 레몬 모찌 | wearing a yellow lemon bucket hat with a green leaf on top and a lemon slice pattern on the brim | 96 | |

- `code`: 백엔드 DB의 캐릭터 ID나 코드
- `length`: 엑셀이면 `=LEN(C2)`로 셀 수 있습니다
- `note`: 3-9에 해당하는 것, 애매해서 고민한 것

넘겨주시면 AI 쪽에서 일기 장면 몇 장(먹는 장면, 친구와 함께, 우울한 날, 공원)을 그려 확인하고, 고칠 캐릭터가 있으면 다시 말씀드리겠습니다.
