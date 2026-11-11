# ai/ — 모찌 캐릭터 LoRA 학습·추론·비교 실험

> 파일·폴더별 역할 설명은 [GUIDE.md](GUIDE.md)에 있다.

'오늘의 모찌' 감정일기 앱의 그림 생성 모델을 실험하는 Python 작업 공간이다. **서비스 서버가 아니다.**
가장 중요한 산출물은 **비교 실험 결과**(발표·포트폴리오용)다. 그래서 모든 실행은 같은 규약으로 측정하고,
같은 형식으로 기록하며, `make_report.py`로 표·그래프를 다시 뽑을 수 있게 되어 있다.

| 항목 | 값 |
|---|---|
| 학습 모델 | FLUX.2 [klein] 4B **Base** (`black-forest-labs/FLUX.2-klein-base-4B`, Apache 2.0) |
| 추론 모델 | FLUX.2 [klein] 4B **distilled** 4-step (`black-forest-labs/FLUX.2-klein-4B`, Apache 2.0) |
| 학습 도구 | ostris ai-toolkit v0.13.34 (commit `2d4c89d`), `arch: flux2_klein_4b` |
| 환경 | Windows 11, RTX 4050 Laptop 6GB, Core Ultra 7 155H, RAM 32GB |
| 트리거 단어 | `mochi_char` |

---

## 1. 설치

```powershell
cd ai
.\setup.ps1            # ai-toolkit 클론(고정 커밋) + .venv(Python 3.12) + torch 2.13 cu130 + 의존성
.\.venv\Scripts\Activate.ps1
```

- 모델 가중치는 처음 실행할 때 Hugging Face 캐시(`%USERPROFILE%\.cache\huggingface`)로 자동으로 받아진다.
  모두 gated가 아니어서 토큰이나 라이선스 동의가 필요 없다.
  - 추론: FLUX.2-klein-4B (트랜스포머 7.75GB + Qwen3-4B 텍스트 인코더 8GB + VAE)
  - 학습: `flux-2-klein-base-4b.safetensors` 7.75GB, `Qwen/Qwen3-4B` 8GB, `ai-toolkit/flux2_vae`
  - GGUF: `unsloth/FLUX.2-klein-4B-GGUF`의 Q8_0(4.3GB), Q4_K_M
  - 평가: `facebook/dinov2-base`, `openai/clip-vit-large-patch14`, `google/owlv2-base-patch16-ensemble`
- `.env.example`을 `.env`로 복사한 뒤 값을 채운다. API 키는 `.env`에만 두고, `.env`는 커밋하지 않는다.

## 2. 폴더 구조

```
ai/
├── README.md / experiments.md / .env.example / requirements.txt / setup.ps1
├── cloud/                         # TODO: 클라우드 학습 (지금은 사용 안 함)
├── configs/
│   ├── prompt_rules.yaml          # 프롬프트 조립 규칙 (학습·서비스 공통, 단일 진실 원천)
│   ├── experiment_matrix.yaml     # 비교 실험 조합 + 우선순위
│   ├── train_local_smoke.yaml     # 50 step 스모크 (s/it 측정)
│   └── train_local.yaml           # 본 학습 2000 step
├── dataset/
│   ├── manifest.csv               # 61 슬롯 (anchor 5 / main_sheet 10 / companion_sheet 6 / scene 40)
│   ├── manifest_report.md         # 할당량 충족표 + pairwise 커버리지
│   ├── excluded_combos.csv        # 제외 규칙으로 빠진 조합
│   ├── captions/                  # 학습 캡션 .txt (manifest 와 중복 → gitignore, 로컬 생성)
│   └── prompts/ val.txt, val.csv, test.csv, seeds.txt
├── scripts/
│   ├── prompt_builder.py          # 앱 입력(JSON) → 캡션/프롬프트
│   ├── make_manifest.py           # manifest + 홀드아웃 프롬프트 생성
│   ├── generate_candidates.py     # 슬롯당 후보 3장 생성 (provider 교체 가능)
│   ├── export_prompts.py          # 웹 UI 수동 생성용 프롬프트 목록 (generation_prompts.md/.csv)
│   ├── klein_slots.py             # 슬롯 몇 개를 로컬 klein 으로 생성 (API 결과와 비교용, --no-ref)
│   ├── providers.py               # 이미지 생성 provider 인터페이스
│   ├── curate_app.py              # 후보 선택 웹 UI (Gradio)
│   ├── build_dataset.py           # 선택 이미지 → outputs/datasets/v{N}
│   ├── train.py                   # ai-toolkit 래퍼 + 학습 측정
│   ├── klein_runtime.py           # klein 로딩/인코딩 공통 (precision별)
│   ├── infer.py                   # 추론 + 측정
│   ├── eval.py                    # 품질 지표
│   ├── run_matrix.py              # 조합 실행
│   ├── make_report.py             # 비교표/그래프
│   └── common.py                  # 경로, 환경 기록, 리소스 모니터, CSV
├── results/                       # git 커밋 (텍스트 + report/*.png)
│   ├── inference_summary.csv / training_summary.csv
│   └── report/
├── outputs/                       # gitignore: runs/, candidates/, datasets/, anchors/, cache/
└── third_party/ai-toolkit/        # gitignore: setup.ps1 이 고정 커밋으로 클론
```

## 3. 실행 순서 (PowerShell, `ai/`에서 venv 활성화 후)

```powershell
# 1) manifest·홀드아웃 프롬프트 생성 (고정 seed → 재현 가능)
python scripts\make_manifest.py

# 2) 후보 생성 — anchor 먼저 만들고 고른 뒤 나머지를 생성 (anchor가 레퍼런스가 됨)
python scripts\generate_candidates.py --provider dry_run --limit 3        # 프롬프트만 확인
python scripts\generate_candidates.py --splits anchor
python scripts\curate_app.py                                              # anchor 5장 선택
python scripts\generate_candidates.py --splits main_sheet,companion_sheet,scene

# 3) 큐레이션 (http://127.0.0.1:7860)
python scripts\curate_app.py

# 4) 데이터셋 빌드 → outputs\datasets\v1
python scripts\build_dataset.py

# 5) 스모크 학습 (50 step, s/it·VRAM 측정)
python scripts\train.py --config configs\train_local_smoke.yaml

# 6) 본 학습 (2000 step, 250 step마다 체크포인트) — 중단되면 --resume 으로 이어서
python scripts\train.py --config configs\train_local.yaml
python scripts\train.py --config configs\train_local.yaml --resume <run_id>

# 7) 매트릭스 추론·평가
python scripts\run_matrix.py --list
python scripts\run_matrix.py --priority 1

# 8) 리포트
python scripts\make_report.py
```

외부 API(`{{IMAGE_API_PROVIDER}}`)가 정해지기 전에는 `--provider klein_local`로 로컬 klein distilled를
써서 후보를 만들 수 있다(API 비용 없음, 레퍼런스 편집 모드).

## 4. 프롬프트 조립 규칙 (Java 백엔드 이식용)

규칙 데이터는 [configs/prompt_rules.yaml](configs/prompt_rules.yaml)에 있고, 조립 로직은
[scripts/prompt_builder.py](scripts/prompt_builder.py)의 `build_caption()` 하나뿐이다. 백엔드는 YAML을
그대로 읽어서 아래 표의 순서대로 문자열을 이어 붙이면 된다.

### 4-1. 캡션 조립 순서 (학습 캡션 / 서비스 LoRA 프롬프트)

```
학습 캡션:   mochi_char, {mood}, {main_activity}, {place}, [with {companion phrase}], {weather light}, [{props}], [{diary detail}], {shot}
서비스 입력: {학습 캡션}, {inference_style}      ← build_lora_prompt()
```

- `inference_style` = `warm children's picture-book illustration, crayon and watercolor textures` (`prompt_rules.yaml`).
  추론 때만 맨 뒤에 붙이고, 학습 캡션에는 붙이지 않는다.
- 10/23 시험 결과 (s2000, val 12장): dino_crop 0.460 → 0.551. close-up 장면이 실사풍으로 나오던 문제가 해결됐다.
- `infer.py`의 `klein_lora`는 기본으로 붙인다. 끄려면 `--no-inference-style`.

| # | 조각 | 출처 (prompt_rules.yaml) | 규칙 |
|---|---|---|---|
| 1 | `mochi_char` | `trigger` | 항상 맨 앞 |
| 2 | mood | 입력값 그대로 | happy / calm / neutral / sad / angry |
| 3 | main_activity | `activities.<main>.caption` | ⭐ 메인 1개. 미지정이면 `activities[0]` |
| 4 | place | `places.<place>.by_activity.<main>` → 없으면 `places.<place>.caption` | 장소 미선택이면 `default_place`(home) |
| 5 | companion | `companions.<kind>.one` / `.two` | 앞에 `with `를 붙임. 같은 종류 2마리 또는 `family:2`면 `two`, 서로 다른 2종이면 `A and B`. 동행 없음(alone)이면 생략 |
| 6 | weather light | `weather.<weather>.indoor` 또는 `.outdoor` | `places.<place>.indoor`로 고름 |
| 7 | props | `activities.<sub>.prop` + `" "` + `prop_placement.indoor/outdoor` | 서브 활동마다 1개, 최대 `max_props`(3) |
| 8 | diary detail | 입력 영어 디테일 1개 | LLM 단계에서 만든 영어 구절. 장면 의미를 바꾸지 않는 디테일 하나 |
| 9 | shot | `shots.<shot>.caption` | 미지정이면 `default_shot`(medium) |

구분자는 `", "`이다. 학습 캡션에는 주인공의 생김새나 화풍을 쓰지 않는다(LoRA가 트리거 단어로 학습한다).

### 4-2. 입력 형식과 검증 (`validate()`)

```json
{"mood":"happy","activities":["cooking","reading"],"main_activity":"cooking","place":"home",
 "companions":["family"],"weather":"sunny","diary_detail":"a small birthday cake with candles","shot":"medium"}
```

- `companions` 값: `friend | family | family:2 | partner | coworker | pet:puppy | pet:kitten` (최대 2마리. `family:2`는 2마리로 센다)
- 오류(제외 규칙 위반)가 있으면 생성하지 않고 오류를 돌려준다.
  - 메인 활동 × 장소: `activities.<main>.places` 화이트리스트
  - 서브 소품 × 장소: `activities.<sub>.prop_where`(indoor/outdoor 전용)
  - 동행 × 장소: `exclusions.companion_places`
  - 동행 × 구도: `exclusions.companion_shots`(close_up, small_in_scene 금지)

### 4-3. 생성용 프롬프트 (후보 이미지, LoRA가 없는 비교 방법)

`style + character(외곽선 변수 포함) + scene_rules + 장면 문장들(같은 순서) + mood_color_modes[mood_color_mode] + scene_detail`.
`scene_detail`(풍성한 배경 디테일 허용)은 장면에만 붙고 단색 배경 시트에는 안 붙는다. 배경 소품 개수는 제한하지 않으며,
`max_props`(3)는 캡션에 적히는 서브 활동 소품에만 적용된다 (2026-10-22 변경, 이전: "At most three small props").
확인용 CLI: `python scripts\prompt_builder.py --json "{...}"`

## 5. 데이터셋 사양

구축 과정(생성·검수·빌드), 검증·테스트 세트 기준, 알려진 한계는 [DATASET.md](DATASET.md)에 정리했다.

- **anchors 5장**: 감정별 정면, 단색 배경. 생성할 때 레퍼런스로 쓰고 평가 기준이 된다. **학습에는 넣지 않는다.**
- **학습 56장**: main_sheet 10 + companion_sheet 6 + scene 40
- **scene 할당량**: 활동 13종 × 3 + eating 1, 기분 각 8, home 12 / cafe·office_school·park 6 / restaurant·travel_spot 5,
  alone 20 / 동행 5종 × 4, sunny 13 / cloudy·rainy·snowy 9, 서브 소품 15장, close-up 8 / medium 20 / full 6 / small-in-scene 6
- `make_manifest.py`는 각 축의 값 목록을 할당량대로 정확히 만든 뒤, 열 내부 swap만 하는 simulated annealing으로
  두 축 조합의 중복(sum count²)을 최소화한다. 제외 규칙 위반은 0, 모든 활동이 2가지 이상 기분으로 나온다. seed는 20261019다.
- **홀드아웃(프롬프트)**: val 12, test_combo 24, test_diary 6, test_multi 6, test_two_companions 4 → test 합계 40
  - val·test는 학습 scene과 (활동, 기분, 장소, 동행, 날씨)가 겹치지 않는다. test 세트는 (활동, 기분, 장소) 3축 조합까지 학습에 없던 것이다.

## 6. 비교 실험

조합을 왜 나눴는지, 전체 조합 목록, 지금까지 결과는 [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md)에 정리했다.

### 6-1. 추론 비교 축

| method | 입력 | 설명 |
|---|---|---|
| `klein_base` | test.csv `prompt` (긴 생성 프롬프트) | klein distilled, 프롬프트만 (하한선) |
| `klein_ref` | `prompt` + `outputs/anchors/{mood}.png` | klein distilled 레퍼런스 편집, 학습 없음 |
| `klein_lora` | test.csv `caption` (트리거 단어 캡션) + `inference_style` | klein distilled + 모찌 LoRA |
| `api_ref` | `prompt` + anchor | 외부 API (`{{IMAGE_API_PROVIDER}}`), 호출 시간을 측정 |

LoRA가 없는 방법은 `mochi_char`를 모르기 때문에, 같은 앱 입력에서 만든 긴 프롬프트를 쓴다(공정성: 입력은 같은 앱 입력,
seed·step·해상도도 같다). `--prompt-field`로 바꿔 실험할 수 있다.

| precision | 구현 | 트랜스포머 가중치 크기 |
|---|---|---|
| `bf16` | `Flux2Transformer2DModel.from_pretrained(..., torch_dtype=bfloat16)` | 7.75GB (6GB 초과 → 공유 메모리 사용) |
| `fp8` | 같은 가중치 + `enable_layerwise_casting(storage=float8_e4m3fn, compute=bf16)` | 약 3.9GB |
| `gguf_q8` | `from_single_file(Q8_0.gguf, GGUFQuantizationConfig(compute_dtype=bf16))` | 약 4.3GB |
| `gguf_q4` | `from_single_file(Q4_K_M.gguf, ...)` | 약 2.6GB |

precision은 **트랜스포머에만** 적용한다. 텍스트 인코더(Qwen3-4B)는 모든 비교에서 bf16으로 고정한다.

### 6-2. 측정 규약

- 같은 프롬프트(test.csv 40개), 같은 seed(seeds.txt 앞에서부터, CPU generator), distilled 4-step, guidance 1.0, 같은 해상도
- 실행 전에 "무거운 프로그램 종료, 전원 연결" 안내를 출력하고, 전원 상태는 env.json에 기록한다.
- **6GB 2단계 추론**: ① 텍스트 인코더로 임베딩을 계산하고(`outputs/cache/te`에 캐시) 언로드 → ② 트랜스포머+VAE 로드 후 생성
  - `model_load_sec` = 트랜스포머(+LoRA)+VAE를 GPU에 올리는 시간 (텍스트 인코더 제외. 디스크 캐시 상태에 따라 달라짐)
  - `latency_sec` = 디노이즈 4-step + VAE 디코드. 첫 1장은 warmup으로 제외. 중앙값 / p90 / 평균
  - `te_encode_sec_mean`은 따로 기록하고, `latency_e2e_median_sec` = latency + 텍스트 인코딩
- `vram_peak_gb_torch`(max_memory_allocated), `vram_peak_gb_smi`(NVML 디바이스 사용량 피크), `shared_peak_gb`
  (Windows 성능 카운터 `GPU Process Memory\Shared Usage`), `sysmem_fallback`(전용 VRAM 초과 + 공유 메모리 증가로 판정),
  `ram_peak_gb`, `gpu_temp_max`
- 학습: `sec_per_it`(진행 표시줄 step 시각으로 직접 측정), 첫 50 step 기준 예상 시간, `status`(success / OOM / too_slow / error)
- 품질: `dino_sim`, `clip_i`(같은 기분의 anchor 대비), `clip_t`(장면 캡션 대비), `dino_sim_crop`(OWLv2로 흰 모찌를
  검출해 가장 큰 박스를 잘라 비교), `human_score`(빈 컬럼, 팀원 1~5점)
- **측정값은 실제 실행으로만 기록한다.** 실행하지 못한 조합은 빈칸으로 두고 status/error에 이유를 남긴다.

### 6-3. 기록 형식

```
outputs/runs/{run_id}/   config.snapshot.yaml, env.json, metrics.json, per_prompt.csv, images/, log.txt (+ aitk/ 체크포인트)
results/inference_summary.csv   추론 1회 = 1행
results/training_summary.csv    학습 1회 = 1행
experiments.md                  실행마다 한 줄 자동 append (+ 사람이 비고 추가)
```

run_id 규칙은 `{날짜}_{method}_{precision}_{res}[_s{step}]`, `{날짜}_train_{precision}_r{rank}[_smoke]`이다. 같은 이름이 이미 있으면 `-2`, `-3`을 붙인다.

### 6-4. 권장 1차 우선순위 (`--priority 1`)

1. `train_smoke`: 동작 확인 + s/it
2. `train_q8_r16`: 본 학습 (qfloat8 양자화, rank 16)
3. `train_bf16_r16`: 60 step만. 6GB에서 OOM/too_slow인지를 결과로 기록
4. 768px 추론: `base_fp8`, `ref_fp8`, `lora_fp8` → LoRA 유무 비교
5. 768px `lora_{bf16,gguf_q8,gguf_q4}` → 양자화 비교
6. 2차: 1024px 전체, `train_q8_r8`, 체크포인트 스윕(step별 품질 곡선)

## 7. 6GB 환경 메모

- 학습은 `quantize: true`(qfloat8) + `low_vram` + gradient checkpointing + adamw8bit + latent·텍스트 임베딩 캐싱
  (캐싱 후 텍스트 인코더 언로드) 조합으로 돌린다. 해상도는 768 (스모크 실측 10/22: 512 3.67 / 768 7.08 /
  1024 12.35 s/it, 1024는 공유 메모리 사용). 배경 디테일을 살리려고 512 대신 768을 쓴다.
- bf16 학습은 트랜스포머만 7.75GB라 전용 VRAM 6GB를 넘는다. Windows 드라이버의 sysmem fallback으로 공유 메모리를 쓰면
  매우 느려진다. 이것도 결과(`too_slow` 또는 `OOM`)로 기록한다.
- ai-toolkit이 6GB에서 안 돌 때의 대안: DiffSynth-Studio의 CPU offload 학습(제안만 하고, 임의로 바꾸지 않는다. 결정 필요).
- 자세한 측정값과 지원/미지원 목록은 `experiments.md`와 `results/report/`를 본다.

## 8. 클라우드 학습

TODO: 지금은 사용하지 않는다. (`cloud/`)

## 9. 팀이 정할 변수

| 변수 | 위치 | 현재 값 |
|---|---|---|
| `{{OUTLINE_COLOR}}` | `configs/prompt_rules.yaml` → `variables.outline_color` | `null` (외곽선 문구 생략) |
| `{{MOOD_COLOR_MODE}}` | `variables.mood_color_mode` | `environment` (권장값을 임시로 적용) |
| `{{IMAGE_API_PROVIDER}}` | `.env` `IMAGE_API_PROVIDER` + `scripts/providers.py` `ExternalApiProvider` | 미정 (구현 TODO) |
| `{{MAX_TRAIN_HOURS}}` | `configs/train_local*.yaml` → `mochi.max_train_hours` | 12 |
