# 데이터셋 구축 — 학습·검증·테스트 데이터를 어떻게 만들었나

모찌 LoRA의 학습 데이터 56장과, 학습에 쓰지 않은 검증 12개·테스트 40개를 만든 과정을 정리한다.

- 기준일: 2026-10-27 (데이터셋 v1, 10/23 빌드)
- 관련 파일: [README.md](README.md) 5장(사양 요약), [GUIDE.md](GUIDE.md) 4장(파일 설명), [dataset/manifest_report.md](dataset/manifest_report.md)(할당량 표), [experiments.md](experiments.md) 10/19·10/22·10/23(작업 기록)

---

## 1. 한눈에 보기

| 구분 | 개수 | 형태 | 용도 |
|---|---|---|---|
| anchor | 5 | 이미지 (기분별 정면, 단색 배경) | 생성할 때 참조 이미지, 평가할 때 기준 이미지. **학습에서 제외** |
| 학습 (v1) | **56** | 이미지 + 캡션 | LoRA 학습 |
| 검증 (val) | 12 | 프롬프트만 | 체크포인트 비교 (어느 step이 좋은지) |
| 테스트 (test) | **40** | 프롬프트만 | 방법·정밀도 비교 (최종 성능) |

- 검증과 테스트는 **이미지가 없고 프롬프트만** 있다. 모델이 그린 결과를 anchor와 비교해서 점수를 낸다 (6장).
- 테스트는 40개다. 원래 사양 문서의 "34개"와 다르다 (8장).

```
캐릭터 원본 디자인(mochi_{mood}.png)
   │ 참조
   ▼
① 설계: make_manifest.py ──► manifest.csv (61슬롯) + val.csv(12) + test.csv(40)
   │
② 생성: Atlas Cloud(GPT Image 2.5, edit) ── anchor 5장 먼저 → 나머지 56슬롯은 anchor를 참조
   │
③ 검수·재생성: 규칙 위반 슬롯 다시 생성
   │
④ 빌드: build_dataset.py ──► outputs/datasets/v1 (56장 + 캡션 .txt)
```

---

## 2. 설계 원칙

1. **할당량을 정확히 맞춘다.** 활동·기분·장소·동행·날씨·구도마다 필요한 장수를 먼저 정하고, 그 개수를 정확히 채운다.
2. **조합은 최대한 겹치지 않게 한다.** 같은 (활동, 기분) 같은 두 축 조합이 반복되지 않도록 배치한다. 장수가 적은 만큼(56장) 다양성이 중요하다.
3. **말이 안 되는 조합은 뺀다.** 예: 여행지에서 요리, 실외에서 영화 보기. 제외 규칙은 `prompt_rules.yaml`에 있고, 빠진 조합 60건과 이유는 `dataset/excluded_combos.csv`에 있다.
4. **검증·테스트는 학습과 겹치지 않는다.** 모델이 외운 장면이 아니라 처음 보는 장면을 얼마나 잘 그리는지 본다 (5장).
5. **재현 가능하다.** seed `20261019`로 실행하면 항상 같은 결과가 나온다.

---

## 3. 학습 데이터 구성 (61슬롯 → 학습 56장)

| 종류 (`split`) | 개수 | 내용 | 캡션 예 |
|---|---|---|---|
| `anchor` | 5 | 기분 5 × 정면. **학습 제외** | `mochi_char, happy, standing, plain cream background, front view, full shot` |
| `main_sheet` | 10 | 기분 5 × (정면, 3/4 측면), 단색 배경 | `mochi_char, calm, standing, plain cream background, three-quarter view, full shot` |
| `companion_sheet` | 6 | 동행 5종 단독(친구, 가족, 연인, 동료, 강아지) + 모찌와 친구 함께 1장 | `a pale peach friend mochi, standing, plain cream background, front view, full shot` |
| `scene` | 40 | 일상 장면 | `mochi_char, sad, eating, cozy cafe, with a pale peach friend mochi, soft overcast light through the window, full shot` |

- 동행 단독 시트에는 트리거(`mochi_char`)를 넣지 않는다. 동행을 모찌로 착각하지 않게 하려는 것이다.
- 캡션에는 **생김새와 화풍을 쓰지 않는다.** 그래야 LoRA가 `mochi_char`라는 단어에 생김새와 화풍을 같이 묶어서 배운다.
- 캡션 조립 순서는 `prompt_builder.py` 한 곳에서 정의한다: `mochi_char, {기분}, {활동}, {장소}, [with {동행}], {날씨 빛}, [{소품}], {구도}`

### 3-1. 장면 40장 할당량 (`make_manifest.py` 상단 상수)

| 축 | 할당 |
|---|---|
| 활동 (13종) | 운동·산책·독서·영화·게임·공부·업무·요리·청소·쇼핑·휴식·여행 각 3, 식사 4 |
| 기분 | happy·calm·neutral·sad·angry 각 8 |
| 장소 | 집 12, 카페 6, 사무실·학교 6, 공원 6, 식당 5, 여행지 5 |
| 동행 | 혼자 20, 친구·가족·연인·동료·반려동물 각 4 |
| 날씨 | 맑음 13, 흐림·비·눈 각 9 |
| 구도 | close-up 8, medium 20, full 6, small-in-scene 6 |
| 서브 활동 소품 | 15장 (그중 2개짜리 5장) |
| 추가 조건 | 모든 활동이 2가지 이상 기분으로 나옴 (실제 최소 3), 동행이 있는 장면은 medium·full 구도만 |

**결과:** 모든 할당량을 충족했고, 제외 규칙 위반은 0건이다 ([manifest_report.md](dataset/manifest_report.md)).

### 3-2. 조합 배치 방법

1. 축마다 할당량대로 값 목록을 만든다 (예: 기분 = happy×8, calm×8, …).
2. 같은 축 안에서 값의 순서만 바꾸는(swap) **simulated annealing**으로 최적화한다. 할당량은 그대로 유지된다.
3. 목적 함수는 "두 축 조합의 중복도(조합별 등장 횟수 제곱의 합)를 최소화하고 제외 규칙 위반은 0"이다.

**두 축 조합 커버리지 (가능한 조합 중 실제로 나온 비율)**

| 축 쌍 | 커버 | | 축 쌍 | 커버 |
|---|---|---|---|---|
| 기분 × 장소 | 100% | | 활동 × 장소 | 80% |
| 기분 × 날씨 | 100% | | 활동 × 날씨 | 77% |
| 기분 × 구도 | 100% | | 장소 × 동행 | 71% |
| 장소 × 날씨 | 100% | | 활동 × 기분 | 62% |
| 날씨 × 구도 | 100% | | 활동 × 동행 | 43% |
| **전체** | **75%** (514개 중 387개) | | | |

- 활동 × 동행은 가능한 조합이 77개인데 장면이 40장이라 낮게 나올 수밖에 없다.

---

## 4. 이미지 생성과 선별

### 4-1. 생성 방법 결정 (10/22)

| 방법 | 결과 | 채택 |
|---|---|---|
| **Atlas Cloud** (`openai/gpt-image-2.5-flare-developer/edit`, 참조 이미지 첨부) | 캐릭터와 화풍이 일관됨 | **채택** |
| 로컬 FLUX.2 klein 4B (anchor 참조) | 모찌가 길쭉해지고, 화분이 반복되고, 넓은 샷을 무시함. 1152×768 fp8 장당 약 21초, 메모리 8.1GB(6GB 초과) | 비교용으로만 생성 |

### 4-2. 생성 순서

1. **anchor 5장:** 캐릭터 원본 디자인(`mochi_{mood}.png`)을 참조로 첨부해 생성하고, 사람이 골라서 `outputs/anchors/{mood}.png`로 둔다.
2. **나머지 56슬롯:** 슬롯의 기분에 맞는 anchor를 참조로 첨부하고 긴 생성 프롬프트로 생성한다. 동행 단독 시트는 화풍 참고용으로 neutral anchor를 붙인다.
   - 생성 프롬프트는 `prompt_builder.build_prompt`가 만든다. 화풍, 캐릭터 고정 설명, 장면 규칙(사람·동물·글자 금지 등), 장면 묘사, 배경 디테일 순서다.
   - 복사용 목록: [dataset/prompts/generation_prompts.md](dataset/prompts/generation_prompts.md) (`export_prompts.py`)
3. **기록:** 장당 시간은 중앙값 40.3초(28.8~113.9초, 65건), 실패 0건이다. 로그는 `outputs/candidates/generation_log.jsonl`에 있다.

### 4-3. 검수와 재생성 (10/23)

- 검수 기준 (`curate_app.py` 탈락 체크리스트): 외곽선·볼 모양 불일치, 손가락 있음, 글자 있음, 흰 모찌 2마리 이상, 동행 색이 고정 표현과 다름, 사람 등장, 날씨 표현 안 보임, 화풍 불일치. 여기에 생성 규칙(프롬프트에 없는 동물·캐릭터 금지)도 함께 봤다.
- 규칙 위반: 병아리(sc_02), 얼굴 있는 눈사람(sc_05), 고양이와 곰인형(sc_11), 고양이(sc_12)
- sc_02, sc_11, sc_12를 다시 생성했다.

### 4-4. 빌드 (`build_dataset.py` → `outputs/datasets/v1`)

- 슬롯마다 `outputs/candidates/{slot_id}/1.png`를 사용했다 (`--auto-select 1`).
- 긴 변을 1024px로 줄였다 (LANCZOS). 장면은 1024×683, 시트는 1024×1024다.
- 이미지마다 같은 이름의 캡션 `.txt`를 둔다. 파일 이름은 `{기분}_{활동}_{장소}_{동행}_{날씨}_01.png` 형식이다.
- 빌드 정보는 `outputs/datasets/v1/dataset_info.json`에 있고, 부족 경고는 0건이다.

**최종 장수 (시트 포함 56장)**

| 축 | 개수 |
|---|---|
| 기분 | happy 11 (모찌+친구 시트 포함), 나머지 각 10 |
| 동행 | 혼자 20, 친구 6, 가족·연인·동료·반려동물 각 5 (시트 포함) |
| 장면 축 | 3-1 할당량과 같음 |

---

## 5. 검증·테스트 세트 (홀드아웃)

학습 장면과 겹치지 않는 조합만 고른다. 겹침은 (활동, 기분, 장소, 동행 종류, 날씨) 5개 축으로 판단한다.

| 세트 | 개수 | 뽑는 기준 | 무엇을 보나 |
|---|---|---|---|
| `val` | 12 | 5축 조합이 학습에 없음 | 체크포인트 비교 |
| `test_combo` | 24 | 5축 조합에 더해 **(활동, 기분, 장소) 3축 조합까지** 학습에 없음 | 처음 보는 조합 |
| `test_diary` | 6 | test_combo와 같은 기준 + 한 줄 일기 디테일 | 일기 내용 반영 (예: "벚꽃이 피었다" → `cherry blossom petals floating around`) |
| `test_multi` | 6 | 같은 기준 + 서브 활동 소품 2개 (close-up 제외) | 소품 여러 개 |
| `test_two_companions` | 4 | 같은 기준 + 동행 2마리 (가족 2, 친구+강아지, 연인+고양이, 친구+동료) | 동행 여러 명 |

- 후보 중에서 고를 때도 두 축 조합이 겹치지 않도록 다양하게 고른다 (`pick_diverse`).
- 한 줄 일기 6개: 벚꽃이 피었다 / 생일 케이크를 받았다 / 무지개를 봤다 / 친구에게 편지를 받았다 / 화분을 새로 샀다 / 따뜻한 코코아를 마셨다
- 파일:
  - `dataset/prompts/val.csv`, `val.txt` (학습 중 샘플용 캡션)
  - `dataset/prompts/test.csv` (`set` 열로 세트를 구분)
  - 한국어 요약: [eval_prompts_ko.md](dataset/prompts/eval_prompts_ko.md)
- 모든 행에 두 종류의 입력이 있다.
  - `caption`: LoRA용 짧은 캡션. 추론할 때 화풍 문구를 붙인다.
  - `prompt`: LoRA 없는 방법(base, ref, api)용 긴 생성 프롬프트
- seed: `dataset/prompts/seeds.txt` (42, 1234, 2025, …). 모든 비교에서 같은 seed를 쓴다.

---

## 6. 평가에서 쓰는 방법

- 모델이 val/test 프롬프트로 그림을 그린다.
- 그 그림을 같은 기분의 **anchor**와 비교한다.
  - `dino_sim_crop`(주 지표): OWLv2(`google/owlv2-base-patch16-ensemble`)로 흰 모찌를 잘라낸 뒤 DINOv2(`facebook/dinov2-base`)로 유사도를 잰다.
  - `clip_i`: 그림 전체의 CLIP(`openai/clip-vit-large-patch14`) 이미지 유사도
- 프롬프트를 잘 따랐는지는 `clip_t`(이미지와 텍스트의 CLIP 유사도)로 본다.
- 자세한 내용은 [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) 6장에 있다.

---

## 7. 재현 방법 (`ai/`에서, PowerShell)

```powershell
.venv\Scripts\python.exe scripts\make_manifest.py      # manifest, val, test, 리포트 (seed 20261019)
.venv\Scripts\python.exe scripts\export_prompts.py     # 복사용 생성 프롬프트, 한국어 요약
# Atlas에서 생성 → outputs/candidates/{slot_id}/1.png
.venv\Scripts\python.exe scripts\curate_app.py         # (선택) 후보 고르기 http://127.0.0.1:7860
.venv\Scripts\python.exe scripts\build_dataset.py      # outputs/datasets/v{N}
```

- 할당량을 바꾸려면 `make_manifest.py` 상단 상수와 README 5장을 같이 고친다.
- 이미지와 데이터셋 폴더(`outputs/`)는 git에 올리지 않는다. 다른 PC에서는 프롬프트와 manifest만 재현된다.

---

## 8. 알려진 한계 (보고할 때 명시)

| 항목 | 내용 | 대응 |
|---|---|---|
| **sc_11에 위반 이미지가 들어감** | sc_11은 다시 생성했지만(`2.png`), 빌드는 `1.png`를 써서 **처음 이미지(곰인형과 고양이가 있음)가 v1에 들어갔다.** 10/27 파일 비교로 확인 | v2에서 교체한다. v1 LoRA에 영향이 있었는지는 확인하지 않았다 |
| 테스트 개수 | 원래 사양 34개, 실제 **40개** (24+6+6+4) | 보고할 때 명시 |
| 동료 표현 변경 | 10/23에 `coworker` 표현을 바꾸고 val/test를 다시 만들었다 (사람으로 그려지는 문제). **학습 캡션(v1)은 예전 표현**이다 | v2에서 학습 캡션도 맞춘다 |
| 장수 | 장면 40장이라 활동 × 동행 같은 조합은 43%만 덮는다 | v2에서 늘린다 |
| 구도 | 넓은 샷(small-in-scene)과 close-up이 프롬프트로는 잘 안 고쳐진다 (10/23 시험) | v2에서 넓은 샷과 close-up 데이터를 늘린다 |
| 합성 데이터 | 학습 이미지가 모두 외부 생성 모델(GPT Image)의 결과다. 그 모델의 습관(배경 구성, 질감)도 같이 배운다 | 원본 디자인과 anchor로 검수 |
| 볼 색 | 감정별 볼 색(행복=노랑, 평온=초록 등)으로 생성했다. 팀 결정(항상 분홍 vs 감정별)은 아직 대기 중이다 | 결정되면 반영 |
