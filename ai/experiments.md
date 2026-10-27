# 실험 기록 (날짜별)

하루 단위로 **무엇을 왜 했고, 결과가 어떻게 나왔고, 결과가 어디에 있는지** 적는다.

- 측정값은 실제 실행에서 얻은 값만 쓴다. 추정치는 "예상"이라고 표시한다.
- 상세 수치: `results/*.csv` · 표와 그림: `results/report/{날짜}/` · 원본: `outputs/runs/{run_id}/`
- 실험 설계(조합을 나눈 이유, 지표 정의): [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md)

**작성 규칙**
- 스크립트(`train.py`, `infer.py`, `run_matrix.py`)는 실행이 끝날 때마다 **파일 맨 끝**에 한 줄을 자동으로 붙인다.
- 그래서 그날 첫 실험을 돌리기 전에 맨 아래에 `## 날짜` 섹션과 `### 자동 기록` 제목을 먼저 만들어 둔다.
- 하루가 끝나면 위쪽의 요약(목적 / 실험 / 결정 / 다음)을 채운다.

---

## 2026-10-19 — 환경 구축

**목적:** 학습·추론·평가 파이프라인을 처음부터 끝까지 갖춘다.

| 작업 | 결과 | 위치 |
|---|---|---|
| venv + ai-toolkit 설치 | torch 2.13.0+cu130, ai-toolkit `2d4c89d` 고정, CUDA 동작 확인 | `README.md` 1장 |
| 프롬프트 규칙 | 캡션·프롬프트 조립 규칙과 제외 규칙 | `configs/prompt_rules.yaml`, `scripts/prompt_builder.py` |
| manifest 생성 (seed 20261019) | 61슬롯, 할당량 전부 충족, 2축 조합 커버리지 75%, 평가용 52개(val 12 + test 40), 제외 조합 60건 | `dataset/manifest.csv`, `dataset/manifest_report.md` |
| 모델 다운로드 | klein distilled·base 4B, Qwen3-4B, flux2 VAE, GGUF Q8_0·Q4_K_M | HF 캐시 |

---

## 2026-10-20 — 추론·학습 동작 확인 (6GB에서 되는가)

**목적:** 각 단계가 6GB에서 돌아가는지, 속도와 메모리가 어느 정도인지 먼저 잰다. 화질은 아직 보지 않는다.

| 실험 | 결과 | 위치 |
|---|---|---|
| klein_base 정밀도별 추론 (768) | 장당 fp8 9.01s · gguf_q8 10.09s · gguf_q4 **7.93s** · bf16 **too_slow** (warmup 1장이 5분 넘게 걸림). 6GB 안에 다 들어간 건 q4뿐 | `results/inference_summary.csv`, `results/report/quantization.md` |
| 스모크 학습 (512, qfloat8, rank 8, 50 step) | **3.67 s/it**, 전용 VRAM 5.76GB + 공유 0.99GB, 공유 메모리로 넘침 없음 (경계선) | `results/training_summary.csv` (`20261020_train_qfloat8_r8_smoke-2`) |
| 스모크 LoRA 추론 | 장당 fp8 9.38s, gguf_q4 8.51s. ai-toolkit LoRA가 diffusers에서 정상 로딩됨 | `inference_summary.csv` (`20261020_klein_lora_*`) |
| eval / make_report 동작 확인 | DINOv2·CLIP·OWLv2 동작. OWLv2 크롭이 주인공 모찌를 잡는 것을 육안으로 확인 | `results/report/` (동작 확인용) |

**발견**
- fp8은 LoRA를 붙인 **뒤에** 켜야 한다. 순서가 반대면 `Float8` addmm 오류가 난다.
- 짧은 캡션만 넣으면 **실사 인형 사진**처럼 나온다. → 10/23에 화풍 문구로 해결했다.

**참고:** 이날 fp8 측정은 배터리 상태여서 본 측정으로 보지 않는다. 품질 지표는 비어 있다.

### 자동 기록
- 20261020 `20261020_klein_base_fp8_768` infer klein_base/fp8/768 → success, n=4, median=9.01s
- 20261020 `20261020_klein_base_gguf_q8_768` infer klein_base/gguf_q8/768 → success, n=2, median=10.09s
- 20261020 `20261020_klein_base_gguf_q4_768` infer klein_base/gguf_q4/768 → success, n=2, median=7.93s
- 20261020 `20261020_klein_base_bf16_768` infer klein_base/bf16/768 → too_slow (warmup 1장 5분+ 미완료, 수동 중단)
- 20261020 `20261020_train_qfloat8_r8_smoke` train qfloat8/r8 → success, 3.61s/it, 50/50 steps, 8.4min
- 20261020 `20261020_train_qfloat8_r8_smoke-2` train qfloat8/r8 → success, 3.67s/it, 50/50 steps, 4.7min
- 20261020 `20261020_klein_lora_fp8_768` infer klein_lora/fp8/768 → success, n=2, median=9.38s
- 20261020 `20261020_klein_lora_gguf_q4_768` infer klein_lora/gguf_q4/768 → success, n=2, median=8.51s

---

## 2026-10-22 — 학습 해상도 결정 + 학습 이미지 생성 시작

**목적:** 768과 1024 중 어느 해상도로 학습할지 정하고, 학습 이미지를 만들 방법을 고른다.

| 실험 | 결과 | 위치 |
|---|---|---|
| 768 스모크 학습 (qfloat8, rank 8, 50 step) | **7.08 s/it**, 전용 5.76GB + 공유 0.93GB, 공유 메모리로 넘침 없음, 61°C → 2000 step 예상 약 3.9시간 | `training_summary.csv` (`20261022_train_qfloat8_r8_smoke`) |
| 1024 스모크 학습 | **12.35 s/it**, 전용 5.75GB + 공유 1.56GB, **공유 메모리로 넘침**, 64°C → 예상 약 6.9시간 | `training_summary.csv` (`..._smoke-2`) |
| 생성 프롬프트 수정 | "소품 최대 3개" 삭제, 장면에 배경 디테일(`scene_detail`) 추가, 동물 금지 규칙 추가. 캡션은 그대로 | `configs/prompt_rules.yaml`, `dataset/prompts/generation_prompts.md` |
| Atlas Cloud(GPT Image 2.5)로 anchor 5장 + 시험 장면 생성 | 10건 생성, 캐릭터 디자인 원본(`mochi_{mood}.png`)을 참조 이미지로 사용 | `outputs/anchors/`, `outputs/candidates/generation_log.jsonl` |
| 로컬 klein으로 같은 장면 생성 (anchor 참조) | 1152×768 fp8 장당 약 21.2s, 메모리 최고 8.13GB (6GB 초과). 화분이 반복되고, 넓은 샷을 무시하고, 모찌가 길쭉해짐 | `outputs/candidates_klein/klein_log.jsonl` |

**결정**
- 학습 해상도 **768**. 1024는 공유 메모리로 넘쳐서 느리다.
- 학습 이미지는 **Atlas**로 만든다. 로컬 klein은 참조를 넣어도 효과가 작다.

### 자동 기록
- 20261022 `20261022_train_qfloat8_r8_smoke` train qfloat8/r8 → success, 7.08s/it, 50/50 steps, 7.7min
- 20261022 `20261022_train_qfloat8_r8_smoke-2` train qfloat8/r8 → success, 12.35s/it, 50/50 steps, 13.4min

---

## 2026-10-23 — 본 학습 → 체크포인트 선택 → 추론 프롬프트 개선

**목적:** 학습 데이터를 완성해서 본 학습을 돌리고, 어느 step이 좋은지 고르고, 이상하게 나오는 이미지를 고친다.

### 1. 학습 데이터 완성 (Atlas)

| 작업 | 결과 | 위치 |
|---|---|---|
| 나머지 슬롯 생성 (09:29~10:04) | 실패 없음. 장당 중앙값 40.3s (28.8~113.9s, 10/22분 포함 65건) | `outputs/candidates/generation_log.jsonl` |
| 검수 | 캐릭터와 화풍은 일관됨. 규칙 위반: 병아리(sc_02), 얼굴 있는 눈사람(sc_05), 고양이·곰인형(sc_11), 고양이(sc_12) | 대화 기록 |
| 재생성 (10:20~10:24) | sc_02 · sc_11 · sc_12를 다시 생성 → 후보 2번 사용 | `outputs/candidates/{slot}/` |
| 데이터셋 v1 빌드 | **56장** (모찌 시트 10, 동행 시트 6, 장면 40). 장면은 1024×683, 시트는 1024×1024 | `outputs/datasets/v1` |
| 로컬 klein 참조 없이 생성 (비교용) | 장당 약 17.5s, 메모리 최고 8.55GB | `outputs/candidates_klein_noref/` |

### 2. 본 학습 `20261023_train_qfloat8_r16`

**설정:** 768, rank 16, qfloat8, 2000 step, lr 1e-4

| 구간 | 결과 |
|---|---|
| step 1~1500 | **6.07~6.18 s/it**로 안정 (768 스모크 7.08보다 빠름) |
| step 1500 샘플링 직후 | **23~25 s/it로 약 4배 느려짐.** 과열·전원 문제는 아니었고, VRAM 6GB가 꽉 차 있었다. 샘플링 뒤 메모리가 다시 배치되면서 공유 메모리로 넘친 것으로 추정 (확정 아님). 1572에서 중단 |
| 1500에서 재개 (`--resume --no-sample`) | **6.04 s/it**로 돌아옴, 51.8분, 전용 5.77GB + 공유 0.96GB, 78°C |
| **합계** | **약 204.6분** (1~1500 구간 152.8분 + 재개 51.8분. 첫 구간 로딩·캐싱 약 17분과 버린 1501~1572 구간은 제외) |

- 위치: `results/training_summary.csv` (notes에 두 구간 정리), `outputs/runs/20261023_train_qfloat8_r16/log.txt`
- 코드 수정 (`train.py`): `--no-sample` 추가, Ctrl+C로 중단하면 `interrupted`로 기록, 로그를 줄 단위로 즉시 기록

### 3. 체크포인트 스윕 (fp8, 768, val 12장, 화풍 문구 없이)

| step | 250 | 500 | 750 | 1000 | 1250 | 1500 | 1750 | 2000 |
|---|---|---|---|---|---|---|---|---|
| dino_crop (캐릭터) | 0.379 | 0.398 | 0.445 | 0.455 | 0.454 | 0.459 | **0.483** | 0.460 |
| clip_i | 0.653 | 0.700 | 0.718 | 0.715 | 0.721 | 0.717 | 0.716 | **0.745** |
| clip_t (프롬프트) | 34.11 | 34.81 | 33.83 | 33.43 | 34.59 | 34.55 | 34.39 | 34.31 |

- 캐릭터는 750 step 무렵 거의 다 배웠다. 과적합 신호(clip_t 하락)는 없다. 장당 8.3~8.7s.
- 모든 step에 공통으로 나온 문제:
  - 동료(coworker) 동행이 **사람**으로 그려짐 (val_002)
  - close-up 장면이 **실사풍** (val_006, val_012)
  - 와이드 샷인데 모찌가 큼 (val_003, val_010)
  - 칠판에 글자 (val_011)
- 위치: `results/report/20261023_sweep/` (`checkpoint_sweep.md`, `step_curve.png`, `sweep_grid_fp8_768.png`)

### 4. 추론 프롬프트 시험 (s2000, val 12장)

| 버전 | dino_crop | clip_i | clip_t | 장당 |
|---|---|---|---|---|
| 캡션만 (원래) | 0.460 | 0.745 | 34.31 | 8.58s |
| A: + 화풍 문구 | 0.551 | 0.752 | 33.72 | 8.39s |
| **B: A + 동료 표현 변경** | **0.559** | **0.761** | 34.19 | 8.19s |

- 화풍 문구: `warm children's picture-book illustration, crayon and watercolor textures`
  - 실사풍이 해결됨 (val_012의 dino_crop 0.32 → 0.66)
- 동료 표현: `a pale blue coworker mochi with an ID badge` → `a small pale blue mochi with a tiny ID badge`
  - 사람이 아니라 작은 하늘색 모찌로 나옴
- B의 val_002·011은 캡션 문구 자체가 달라서, clip_t를 엄밀하게 비교한 것은 아니다.
- 위치: `outputs/runs/20261023_klein_lora_fp8_768_s2000_style/`, `..._s2000_comp_style/` (요약 행은 `inference_summary.csv`)

### 5. 1차 비교 실험 (test 40개, 768)

`run_matrix.py --kind inference --priority 1`. LoRA는 2000 step, 화풍 문구 기본 적용.

| 실행 | 장당 (중앙값) | 장당 e2e | VRAM torch | 공유 메모리 | dino_crop | clip_i | clip_t |
|---|---|---|---|---|---|---|---|
| klein_base fp8 (긴 프롬프트) | 7.52s | 14.56s | 5.19GB | 0.81GB, 넘침 | **0.560** | 0.699 | 33.80 |
| klein_ref fp8 (긴 프롬프트 + anchor 원본 크기) | 69.35s | 76.39s | 5.35GB | 1.08GB, 넘침 | **0.580** | 0.734 | 34.05 |
| klein_lora fp8 | 8.15s | 14.99s | 5.23GB | 0.81GB, 넘침 | 0.552 | 0.743 | 34.27 |
| klein_lora gguf_q8 | 9.49s | 16.33s | 5.60GB | 1.06GB, 넘침 | 0.544 | **0.746** | 34.28 |
| **klein_lora gguf_q4** | **7.49s** | **14.33s** | **4.01GB** | 0.08GB, **넘침 없음** | 0.548 | 0.742 | **34.45** |
| klein_lora bf16 | too_slow | | | | | | |
| api_ref | error | | | | | | |

- bf16: 3/4 step에서 206초 경과, 장당 상한 120초 초과로 중단.
- api_ref: 외부 API 공급자가 정해지지 않아 실행하지 못함 (`IMAGE_API_PROVIDER` 미구현).
- 리포트: `results/report/20261023/` (`quantization.md`, `lora_comparison.md`, `set_breakdown.md`, 그리드 이미지)

**발견**
- **양자화(Q2):** 화질 지표는 fp8, q8, q4 차이가 작다 (dino_crop 0.544~0.552). q4가 가장 빠르고, 6GB 안에 들어가는 유일한 정밀도다.
- **LoRA 효과(Q1):** dino_crop은 base·ref가 LoRA보다 약간 높지만 차이가 작다. clip_i는 LoRA가 높다 (0.743 vs base 0.699). LoRA는 짧은 캡션만 쓰고 base는 생김새를 길게 설명하는 프롬프트를 쓰므로, 지표만으로 우열을 정하기 어렵다. 그리드 이미지와 사람 평가로 확인한다.
- ref는 품질 지표가 가장 높지만 장당 69초로 서비스에 쓰기 어렵다. 단, 10/26에 q4와 768 참조로 장당 약 13초를 확인했다 (10/26 항목).

### 결정
- `inference_style`(화풍 문구)을 `klein_lora` 추론의 **기본값**으로 한다 (`--no-inference-style`로 끔).
- 동료 동행 표현을 바꿨다. manifest, val, test를 같은 seed로 다시 만들었고, 바뀐 건 동료가 나오는 줄뿐이다.
- 1차 비교 실험은 **2000 step** 체크포인트로 돌린다. 1750과 점수 차이가 작고, 화풍 문구 시험도 2000으로 했다.
- 학습 중 샘플링은 6GB에서 속도 저하 위험이 있다. 확인은 학습 뒤 스윕으로 한다.

### 남은 문제 / 다음
- 와이드 샷과 칠판 글자는 프롬프트로 안 고쳐진다. → v2 데이터셋에서 넓은 샷과 close-up 데이터를 늘린다.
- v1 LoRA는 옛 동료 표현으로 학습됐다. v2에서 새 표현으로 맞춘다.
- 1차 비교 실험 결과로 LoRA 효과(Q1)와 서비스 정밀도(Q2)를 정한다.
- 팀 결정 대기: 볼 색(항상 분홍 vs 감정별 색), test 세트 수(사양 34 vs 실제 40).

### 자동 기록
- 20261023 `20261023_train_qfloat8_r16` train qfloat8/r16 → success, 6.04s/it, 2000/2000 steps, 51.8min
- 20261023 `20261023_klein_lora_fp8_768_s250` infer klein_lora/fp8/768 → success, n=12, median=8.34s
- 20261023 `20261023_klein_lora_fp8_768_s500` infer klein_lora/fp8/768 → success, n=12, median=8.51s
- 20261023 `20261023_klein_lora_fp8_768_s750` infer klein_lora/fp8/768 → success, n=12, median=8.66s
- 20261023 `20261023_klein_lora_fp8_768_s1000` infer klein_lora/fp8/768 → success, n=12, median=8.55s
- 20261023 `20261023_klein_lora_fp8_768_s1250` infer klein_lora/fp8/768 → success, n=12, median=8.57s
- 20261023 `20261023_klein_lora_fp8_768_s1500` infer klein_lora/fp8/768 → success, n=12, median=8.62s
- 20261023 `20261023_klein_lora_fp8_768_s1750` infer klein_lora/fp8/768 → success, n=12, median=8.58s
- 20261023 `20261023_klein_lora_fp8_768_s2000` infer klein_lora/fp8/768 → success, n=12, median=8.58s
- 20261023 run_matrix: ckpt_sweep_fp8_768=success
- 20261023 `20261023_klein_lora_fp8_768_s2000_style` infer klein_lora/fp8/768 → success, n=12, median=8.36s
- 20261023 `20261023_klein_lora_fp8_768_s2000_comp_style` infer klein_lora/fp8/768 → success, n=12, median=8.19s
- 20261023 `20261023_klein_base_fp8_768` infer klein_base/fp8/768 → success, n=40, median=7.52s
- 20261023 `20261023_klein_ref_fp8_768` infer klein_ref/fp8/768 → success, n=40, median=69.35s
- 20261023 `20261023_klein_lora_fp8_768` infer klein_lora/fp8/768 → success, n=40, median=8.15s
- 20261023 `20261023_klein_lora_bf16_768` infer klein_lora/bf16/768 → too_slow (TooSlowError: 206s after step 3/4 > max 120s per image)
- 20261023 `20261023_klein_lora_gguf_q8_768` infer klein_lora/gguf_q8/768 → success, n=40, median=9.49s
- 20261023 `20261023_klein_lora_gguf_q4_768` infer klein_lora/gguf_q4/768 → success, n=40, median=7.49s
- 20261023 `20261023_api_ref_na_768` infer api_ref/na/768 → error (RuntimeError: NotImplementedError: IMAGE_API_PROVIDER 가 아직 정해지지 않았습니다. scripts/providers.py 의 ExternalApiProvider.genera)
- 20261023 run_matrix: base_fp8_768=success, ref_fp8_768=success, lora_fp8_768=success, lora_bf16_768=infer_failed(rc=2), lora_gguf_q8_768=success, lora_gguf_q4_768=success, api_ref_768=infer_failed(rc=2)

---

## 2026-10-26 — 특색(뽑기) 캐릭터 재현 시험

**목적:** 뽑기로 만든 특색 캐릭터(레몬 모찌)를 재학습 없이 로컬 모델로 그릴 수 있는지 확인한다.

### 1. 레몬 모찌 시험 (`scripts/variant_test.py`)

**설정**
- 모델: klein distilled 4B + gguf_q4 + LoRA s2000
- 생성: 768, 4-step, seed 42
- 프롬프트: val에서 감정별 1개씩 5개
- 참조 이미지: `mochi data/모찌/레몬/mozzi_rare_041~045.png` (행복·평온·기본·우울·화남 순). 투명 배경을 흰색으로 채우고 768로 줄여서 첨부

| 조건 | 입력 | 장당 (중앙값) | VRAM torch | 공유 메모리 | 결과 |
|---|---|---|---|---|---|
| A. LoRA + 글 | 캡션에 레몬 문구 + 화풍 문구 | 7.48s | 4.01GB | 0.13GB, 넘침 없음 | 레몬 모자와 반쪽 레몬은 나옴. 모자가 단순한 레몬 모양이고 챙의 레몬 단면 무늬가 없음 |
| **B. LoRA + 글 + 참조** | A + 같은 감정의 레몬 이미지 | **12.95s** | 4.01GB | 0.08GB, 넘침 없음 | **원본과 가장 비슷함.** 챙 무늬, 잎, 반쪽 레몬, 감정별 볼 색까지 따라감. 장면 구도는 A와 같음 |
| C. 참조만 (LoRA 없음) | 안내문 + 긴 프롬프트 + 레몬 문구 + 참조 | 11.66s | 3.97GB | 0.08GB, 넘침 없음 | 모자는 잘 나오지만 **동행에게도 레몬 모자나 레몬이 옮겨 감**(val_004, val_002). 그림 가장자리에 종이 테두리 |

- 텍스트 인코딩: 로드 12.6초, 프롬프트당 7.48초 (10개, 캐시 없음)
- 위치: `outputs/variant_test/20261026_lemon/` (`grid.png`, `summary.json`, `log.jsonl`, `config.json`)

**발견**
- 참조 이미지를 넣어도 **q4와 768 참조 조합이면 장당 약 13초**이고 6GB 안에 들어간다.
- 10/23 `klein_ref`(fp8, anchor 원본 크기 그대로 첨부)는 장당 69초였다. 정밀도와 참조 크기가 달라서 직접 비교는 아니다.

**결론:** 특색 캐릭터는 **LoRA + 참조 이미지(B)** 방식으로 재학습 없이 서비스할 수 있다.

### 2. 수박 모찌 시험 (같은 설정)

- 참조 이미지: `mochi data/모찌/과일_수박/mozzi_epic_016~020.png` (행복·평온·기본·우울·화남 순)
- 문구: `prompt_rules.yaml` `variants.watermelon`
  - caption: `wearing a green striped watermelon rind hood with a curly stem on top and a red watermelon cape with black seeds, holding a watermelon slice`

| 조건 | 장당 (중앙값) | VRAM torch | 공유 메모리 | 결과 |
|---|---|---|---|---|
| A. LoRA + 글 | 7.50s | 4.01GB | 0.13GB, 넘침 없음 | 수박 모찌로 알아볼 수 있고 덩굴 꼭지도 나옴. 하지만 **후드가 통수박처럼 커서 몸을 덮고**, 줄무늬가 지그재그가 아니라 실제 수박 무늬임. 망토는 앞쪽 판초가 아니라 등 뒤 망토이고, 조각은 작은 삼각형이 아니라 큰 반달 모양 |
| **B. LoRA + 글 + 참조** | **12.89s** | 4.01GB | 0.08GB, 넘침 없음 | **원본과 가장 비슷함.** 지그재그 후드, 앞쪽 빨간 판초에 씨 단추, 삼각 조각, 감정별 볼 색(평온=초록, 우울=파랑+눈물)까지 따라감. 장면 구도는 A와 같음 |
| C. 참조만 (LoRA 없음) | 11.70s | 3.97GB | 0.08GB, 넘침 없음 | 캐릭터는 원본에 가깝지만 **동행이 수박 옷을 따라 입음**(val_005, val_004, val_002). **장면도 프롬프트에서 벗어남**(val_004는 눈 오는 공원이 봄 공원으로, val_001은 컴퓨터가 빠짐). 종이 테두리가 있음 |

- 텍스트 인코딩: 로드 12.1초, 프롬프트당 8.27초 (10개, 캐시 없음)
- 위치: `outputs/variant_test/20261026_watermelon/`

**발견**
- 레몬과 같은 경향이다. B가 가장 정확하고, A는 알아볼 수는 있지만 세부 디자인(무늬 모양, 옷 위치, 크기)을 놓치고, C는 동행에게 옮겨 간다.
- A에서 놓친 부분은 **모양·위치·크기**였다. 문구에 이 세 가지를 직접 쓰면 개선될 여지가 있다 (예: zigzag stripes, poncho worn in front, small triangular slice).

### 3. D 조건: LoRA + 참조, 캐릭터 문구 없음 (레몬·수박)

- 입력: 기본 캡션 + 화풍 문구 + 같은 감정의 참조 이미지. 캐릭터 문구는 넣지 않음
- 같은 폴더에 조건을 추가해 실행했다. `grid.png`는 참조 | A | B | C | D 5열이다.

| 캐릭터 | 장당 (중앙값) | VRAM torch | 공유 메모리 | 결과 |
|---|---|---|---|---|
| 레몬 | 12.85s | 4.01GB | 0.08GB, 넘침 없음 | 4/5장은 모찌에게 챙 무늬 모자가 나옴. 하지만 **val_004는 모찌가 맨몸이고 동행이 모자를 씀**, val_005도 동행이 모자를 씀. 반쪽 레몬은 대부분 빠짐 |
| 수박 | 12.88s | 4.01GB | 0.08GB, 넘침 없음 | **불안정함.** val_005·val_004·val_002는 모찌가 맨몸이고, val_005와 val_004는 동행이 수박 옷을 입음. val_001·val_003은 후드만 있고 판초가 없음 |

**발견**
- 글이 없으면 참조 이미지의 소품이 **누구 것인지 모델이 모른다.** 그래서 동행에게 가거나 빠진다. 캐릭터 문구가 소품을 `mochi_char`에 묶어 주는 역할을 한다.
- 반대로 D는 **원래 장면의 소품을 더 잘 지켰다** (val_002 파스타). A·B는 문구의 `holding half a lemon / a watermelon slice`가 일기 활동의 소품을 밀어냈다 (val_002에서 파스타 대신 레몬·수박을 듦).
- 텍스트 인코딩은 기본 캡션이 이미 캐시돼 있어서 새로 계산하지 않았다 (5개 모두 캐시).

**정리 (A~D)**
- 글은 꼭 필요하다. 참조 이미지는 글 위에 얹는 보조 수단이다.
- 캐릭터 문구에서 `holding ...`은 빼고 **입는 것만** 쓰는 편이 일기 장면을 덜 해친다 (다음 시험 후보).

### 4. 우비 모찌: 참조 1장만 (`날씨/mozzi_legendary_005.png`)

- 이 캐릭터는 감정별 이미지가 없고 **우울한 표정 1장**만 있다. 5개 감정 모두 이 한 장을 참조로 썼다 (`variant_test.py`가 `--ref-dir`에 파일 하나를 받으면 그렇게 한다).
- 문구 `variants.rain`: `wearing a soft grey hooded raincoat tied with a light blue ribbon bow and a teardrop charm, with a clear iridescent umbrella` (표정은 넣지 않음)

| 조건 | 장당 (중앙값) | VRAM torch | 공유 메모리 | 결과 |
|---|---|---|---|---|
| A. LoRA + 글 | 7.50s | 4.01GB | 0.13GB, 넘침 없음 | 회색 후드 우비, 하늘색 리본, 투명 무지개빛 우산이 다 나옴. 우비가 주머니·단추 달린 코트 모양으로 원본과 다름 |
| **B. LoRA + 글 + 참조** | 12.87s | 4.01GB | 0.08GB, 넘침 없음 | **원본과 가장 비슷함** (망토형 우비, 물방울 장식). 볼 색이 참조를 따라 **파란색 쪽으로 기우는 장면이 있음** (평온·기본·화남) |
| C. 참조만 | 11.62s | 3.97GB | 0.08GB, 넘침 없음 | 캐릭터는 비슷하지만 **동행도 우비를 입음**(val_001, val_004, val_002). val_004는 눈 장면이 봄 공원이 됨. 종이 테두리 |
| D. LoRA + 참조 (글 없음) | 12.85s | 4.01GB | 0.08GB, 넘침 없음 | **거의 실패.** val_005에서 하늘색 리본 칼라만 나오고 나머지 4장은 맨몸 |

- 텍스트 인코딩: 로드 10.6초, 프롬프트당 7.63초 (새로 10개, 기본 캡션 5개는 캐시)
- 위치: `outputs/variant_test/20261026_rain/`

**발견**
- **참조 1장이어도 된다 (B 기준).** 참조가 우는 얼굴이어도 A·B·C 모두 장면의 감정(웃음, 화남 등)을 따랐다. 표정은 글과 LoRA가 정하고, 참조는 옷과 소품만 가져온다. 단, 볼 색은 참조 쪽으로 조금 끌려간다.
- 참조의 **비, 무지개는 장면으로 옮겨 오지 않았다.**
- **우산이 실내에도 나온다.** 방, 카페, 부엌에서 우산을 펴고 있고, 요리하면서 들고 있기도 하다 (A·B·C). 레몬·수박의 `holding` 문제와 같다. 들고 다니는 소품은 장소가 실외일 때만 붙이는 규칙이 필요해 보인다.

### 자동 기록
