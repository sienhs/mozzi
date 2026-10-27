# ai/ 폴더 안내서 — 무엇이 어디에 있고, 왜 있는가

> README.md는 "어떻게 실행하는가"(사양·명령어), 이 문서는 "각 파일이 무엇을 하는가"를 설명한다.

---

## 0. 한눈에 보는 전체 흐름

```
 [1] 무엇을 그릴지 정한다          [2] 그림 후보를 만든다         [3] 사람이 고른다
 make_manifest.py  ───────────▶  generate_candidates.py ───▶  curate_app.py
 (61개 슬롯 + 테스트 프롬프트)       (슬롯당 3장)                   (슬롯당 1장 선택)
                                                                    │
                                                                    ▼
 [6] 결과를 표·그래프로            [5] 모델들을 비교한다          [4] 모찌를 학습시킨다
 make_report.py  ◀──────────────  run_matrix.py  ◀───────────  build_dataset.py → train.py
                                   (infer.py → eval.py 반복)        (56장 + 캡션 → LoRA 파일)
```

한 줄로 줄이면 이렇다. **모찌 그림 56장을 만들어 고르고 → 그걸로 LoRA를 학습하고 → 여러 방식(LoRA 유무, 양자화)으로 그림을 그려 속도·품질을 비교하고 → 발표용 표로 뽑는다.**

---

## 1. 먼저 알아두면 좋은 용어

| 용어 | 뜻 | 이 프로젝트에서 |
|---|---|---|
| **FLUX.2 klein 4B** | 그림 생성 AI 모델 (파라미터 40억 개) | 모찌 그림을 그리는 엔진 |
| **base / distilled** | base는 원본 모델(느리지만 학습용으로 좋음), distilled는 4번만 계산해도 그림이 나오게 압축한 모델 | 학습은 base, 실제 그림 생성은 distilled |
| **LoRA** | 큰 모델은 그대로 두고 작은 "추가 부품"만 학습해서 새 캐릭터를 가르치는 방법 | 모찌 LoRA 파일(수십 MB)을 만들어서 붙인다 |
| **트리거 단어** | LoRA가 반응하는 약속된 단어 | `mochi_char`가 들어가면 "그 모찌를 그려라" |
| **텍스트 인코더 (Qwen3-4B)** | 영어 문장을 모델이 이해하는 숫자로 바꾸는 부품 | 8GB라 6GB GPU에 다른 부품과 같이 못 올림 → 따로 돌린다 |
| **트랜스포머** | 실제로 그림을 그리는 본체 (7.75GB) | 양자화 비교의 대상 |
| **VAE** | 모델 내부 표현을 실제 픽셀 이미지로 바꾸는 부품 | 작음 (0.3GB) |
| **양자화 (precision)** | 숫자를 덜 정밀하게 저장해서 메모리를 줄이는 것 | bf16(원본) → fp8(절반) → gguf_q8 → gguf_q4(약 1/3) |
| **VRAM / sysmem fallback** | GPU 전용 메모리 / 그게 모자라면 Windows가 시스템 RAM을 빌려 쓰는 것 (매우 느려짐) | 6GB를 넘었는지가 중요한 측정 항목 |
| **anchor** | 감정별 "모찌 기준 사진" 5장 | 그림 생성 때 참고 이미지 + 평가할 때 비교 기준. 학습에는 안 씀 |
| **caption / prompt** | caption = 학습용 짧은 설명, prompt = 생김새·화풍까지 다 적은 긴 설명 | LoRA 모델에는 caption, LoRA 없는 모델에는 prompt |
| **pairwise 커버리지** | 두 항목씩 짝지었을 때(예: 기분×장소) 다양한 조합이 나왔는지 | 40장으로 최대한 다양하게 뽑는 기준 |

---

## 2. 폴더별 설명

```
ai/
├── README.md, GUIDE.md, CLAUDE.md, TODO.md, experiments.md   ← 문서
├── .env.example, requirements.txt, setup.ps1                  ← 환경 설정
├── configs/        ← 규칙·실험 설정 (YAML)
├── dataset/        ← 무엇을 그릴지 목록 + 학습 캡션 + 테스트 프롬프트 (텍스트만, git 커밋)
├── scripts/        ← 실행하는 Python 코드
├── results/        ← 실험 결과 요약 (git 커밋, 발표 자료의 원천)
├── outputs/        ← 이미지·체크포인트 같은 큰 파일 (git 제외)
├── cloud/          ← 클라우드 학습 자리 (지금은 비어 있음)
├── third_party/    ← 외부 학습 도구 ai-toolkit 코드 (git 제외)
└── .venv/          ← Python 가상환경 (git 제외)
```

### 📄 문서 파일

| 파일 | 내용 |
|---|---|
| `README.md` | 공식 사양서: 설치, 실행 순서, 프롬프트 규칙(Java 이식용 표), 측정 규약 |
| `GUIDE.md` | 지금 이 문서. 각 파일이 무엇인지 설명 |
| `CLAUDE.md` | Claude(AI 어시스턴트)가 이 폴더에서 일할 때 지킬 규칙과 알려진 함정. 로컬 전용 (git 제외) |
| `TODO.md` | 해야 할 일 목록 (완료 / 내일 / 팀 결정 대기 / 그 다음) |
| `experiments.md` | 실험 일지. 스크립트가 실행마다 한 줄씩 자동으로 추가하고, 사람은 비고를 단다 |

### ⚙️ 환경 설정 파일

| 파일 | 내용 |
|---|---|
| `setup.ps1` | 새 PC에서 한 번 실행하는 설치 스크립트. ai-toolkit을 고정 버전으로 받고, `.venv`를 만들고, 패키지를 설치한다 |
| `requirements.txt` | 추가 Python 패키지 목록 (gguf, psutil 등). 대부분의 패키지는 ai-toolkit 쪽 목록에서 설치된다 |
| `.env.example` | 비밀값 양식. `.env`로 복사해서 API 키 등을 채운다. `.env`는 절대 커밋하지 않는다 |

---

## 3. `configs/` — 규칙과 설정

| 파일 | 무엇을 정하나 | 언제 고치나 |
|---|---|---|
| **`prompt_rules.yaml`** | **프롬프트의 모든 규칙.** 기분별 표정, 활동별 문구, 장소 문구, 동행 고정 표현(`pale peach friend mochi` 등), 날씨 빛 표현, 구도, 화풍·캐릭터 고정 문장, 제외 규칙(예: 여행지에서 요리 금지) | 문구를 바꾸고 싶을 때. 팀이 외곽선 색을 정하면 `outline_color`를 채운다 |
| `labels_ko.yaml` | 캡션 한국어 라벨 (보기용 `dataset/prompts/captions_ko.md` 를 만들 때만 씀, 학습과 무관) | 한국어 표기를 바꿀 때 |
| `experiment_matrix.yaml` | 비교 실험 목록. "klein_lora + fp8 + 768px"처럼 조합마다 이름과 우선순위(1~3)를 붙여 둔다 | 조합을 추가·삭제하거나 우선순위를 바꿀 때 |
| `train_local_smoke.yaml` | 스모크 학습 설정. 50 step만 돌려서 "돌아가는지, 얼마나 빠른지"를 본다 | 거의 안 고침 |
| `train_local.yaml` | 본 학습 설정. 2000 step, rank 16, 6GB 최적화(8bit 양자화, 캐싱 등), 250 step마다 저장 | 해상도·step 수를 바꿀 때 |

> 학습 설정 안의 `{{RUN_NAME}}` 같은 자리는 `train.py`가 실행할 때 자동으로 채운다. 맨 위 `mochi:` 블록은 우리 스크립트만 읽고, ai-toolkit에는 전달하지 않는다.

---

## 4. `dataset/` — 무엇을 그릴지 (텍스트만, `make_manifest.py`가 생성)

| 파일 | 내용 |
|---|---|
| **`manifest.csv`** | **그려야 할 그림 61장의 목록.** 한 줄이 한 장(슬롯). 기분·활동·장소·동행·날씨·구도, 생성용 긴 프롬프트, 학습용 캡션, 파일 이름, 선택된 후보 번호(`selected`), 담당자(`owner`) 컬럼이 있다 |
| `manifest_report.md` | 할당량을 맞췄는지 보여주는 표(활동 13종 × 3장 등)와 pairwise 커버리지 |
| `excluded_combos.csv` | 제외 규칙 때문에 나올 수 없는 조합 60건과 그 이유 |
| `captions/*.txt` | 학습용 캡션 파일 56개 (이미지 파일 이름과 짝). manifest.csv의 caption 열과 같아서 **git에는 올리지 않음** (로컬 생성) |
| `prompts/val.txt` | 검증용 캡션 12줄. 학습 중에 중간 결과 그림을 뽑을 때 쓴다 |
| `prompts/val.csv` | 위 12개의 입력값까지 포함한 표 (평가용) |
| `prompts/test.csv` | 테스트 프롬프트 40개. `set` 컬럼으로 4개 세트를 구분한다: 처음 보는 조합 24 / 한 줄 일기 6 / 서브 활동 2개 6 / 동행 2마리 4 |
| `prompts/seeds.txt` | 고정 랜덤 시드 목록. 모든 비교에서 같은 시드를 써야 공정하다 |

**61장의 구성**: anchor 5 (기준용, 학습 제외) + 주인공 시트 10 (기분 5 × 정면/측면) + 동행 시트 6 + 장면 40

---

## 5. `scripts/` — 실행 코드

### 5-1. 실행 순서대로

| 순서 | 파일 | 하는 일 | 입력 → 출력 |
|---|---|---|---|
| ① | **`make_manifest.py`** | 할당량(활동 13종 × 3, 기분 각 8 …)을 정확히 맞추면서 조합이 최대한 다양해지도록 61개 슬롯을 배정한다. 테스트 프롬프트도 만든다. 같은 seed면 항상 같은 결과가 나온다 | `prompt_rules.yaml` → `dataset/` 전체 |
| ② | **`generate_candidates.py`** | 슬롯마다 후보 그림 3장을 만든다. anchor를 참고 이미지로 첨부한다. 이미 만든 건 건너뛰고(다시 실행해도 안전), 실패하면 재시도하고, 비용을 기록한다 | `manifest.csv` → `outputs/candidates/{슬롯}/1~3.png` |
| ②' | **`export_prompts.py`** | 웹 UI(Atlas Cloud 등)에서 손으로 생성할 때 쓰는 복사용 프롬프트 목록. anchor → 시험 생성 5개 → 나머지 순서, 레퍼런스 안내 문장(`reference_notes`) 포함 | `manifest.csv` → `dataset/prompts/generation_prompts.md/.csv` |
| ③ | **`curate_app.py`** | 웹 화면(http://127.0.0.1:7860)에 후보 3장을 띄운다. 클릭하면 선택되고 `manifest.csv`에 기록된다. 탈락 기준 체크리스트(손가락 있음, 글자 있음 등)도 표시한다 | 후보 이미지 → `manifest.csv`의 `selected` |
| ④ | **`build_dataset.py`** | 선택된 그림을 모아 1024px로 줄이고 캡션 .txt를 옆에 붙인다. 기분·활동별 장수를 세서 부족하면 경고한다 | 선택 결과 → `outputs/datasets/v1/` |
| ⑤ | **`train.py`** | ai-toolkit으로 LoRA를 학습한다. 속도(s/it)·메모리를 재고, 첫 50 step으로 전체 시간을 예상하고, 12시간을 넘으면 계속할지 묻는다. 중간에 끊기면 `--resume`으로 이어서 학습한다 | 데이터셋 → LoRA 파일 + `results/training_summary.csv` |
| ⑥ | **`infer.py`** | 테스트 프롬프트 40개로 그림을 그리면서 로딩 시간·장당 시간·VRAM·온도를 잰다. 4가지 방법 × 4가지 precision × 2가지 해상도를 같은 방식으로 실행한다 | `test.csv` → 이미지 + `results/inference_summary.csv` |
| ⑦ | **`eval.py`** | 그려진 그림의 품질 점수를 계산한다(아래 표 참고). 테스트 세트별로도 따로 집계한다 | 이미지 → 점수 (CSV 갱신) |
| ⑧ | **`run_matrix.py`** | `experiment_matrix.yaml`의 조합을 골라 ⑥→⑦을 자동으로 반복한다. 실패한 조합은 기록만 하고 다음으로 넘어간다 | 설정 → 여러 번의 실행 |
| ⑨ | **`make_report.py`** | 결과 CSV를 발표용 표(.md)와 그래프(.png)로 만든다. 날짜 폴더에 따로 저장해서 이전 리포트가 남는다 | `results/*.csv` → `results/report/{날짜}/` |
| (시험) | `variant_test.py` | 특색(뽑기) 캐릭터를 LoRA + 글 / + 참조 이미지 / 참조만 / LoRA + 참조 조건으로 그려 비교한다. 탐색용이라 CSV에는 기록하지 않는다 | `prompt_rules.yaml` `variants` + 캐릭터 이미지 → `outputs/variant_test/{날짜}_{variant}/` |

### 5-2. 다른 스크립트가 불러 쓰는 부품

| 파일 | 역할 |
|---|---|
| **`prompt_builder.py`** | **앱 입력 → 캡션/프롬프트 변환의 유일한 구현.** 예: `{"mood":"happy","activities":["cooking"],...}` → `mochi_char, happy, cooking, home kitchen, ...`. 제외 규칙도 여기서 검사한다. 나중에 Java 백엔드가 똑같이 옮길 대상이다. 단독 실행해서 결과를 확인할 수도 있다 |
| `klein_runtime.py` | FLUX.2 klein을 6GB에서 돌리는 핵심 코드. ① 텍스트 인코더로 문장을 숫자로 바꿔 캐시하고 내린 뒤 ② 그림 본체를 precision별로 올린다 |
| `providers.py` | 이미지 생성 서비스를 교체할 수 있게 만든 "콘센트". `klein_local`(로컬 무료), `external_api`(외부 API, 팀 결정 후 구현), `dry_run`(프롬프트만 출력) |
| `common.py` | 공통 도구: 폴더 경로, 실행 환경 기록(GPU 드라이버, 버전, git 커밋, 전원 연결), 메모리 모니터, CSV 저장 |

### 5-3. 비교하는 4가지 방법 (`infer.py --method`)

| method | 설명 | 역할 |
|---|---|---|
| `klein_base` | 학습 없이 긴 프롬프트만으로 그림 | 하한선 ("아무것도 안 하면 이 정도") |
| `klein_ref` | 학습 없이 anchor 그림을 참고로 보여주며 그림 | 학습 없는 대안 |
| `klein_lora` | 우리가 학습한 모찌 LoRA를 붙여서 그림 | **본 방법** |
| `api_ref` | 외부 유료 API + anchor 참고 | 상용 서비스와 비교 |

### 5-4. 품질 점수 (`eval.py`)

| 지표 | 뜻 | 높으면 |
|---|---|---|
| `dino_sim` | anchor와 얼마나 같은 캐릭터로 보이는지 (DINOv2 모델로 비교) | 모찌가 일관되게 나옴 |
| `clip_i` | anchor와의 전체적인 그림 유사도 (CLIP 모델) | 비슷한 느낌 |
| `clip_t` | 그림이 프롬프트 내용을 얼마나 따랐는지 | 요리하라면 요리하고 있음 |
| `dino_sim_crop` | 그림에서 흰 모찌만 잘라내서 비교 (동행이 있을 때 배경 영향 제거) | 주인공이 정확함 |
| `human_score` | 팀원 평가 1~5점 (나중에 직접 채움) | — |

---

## 6. `results/` — 실험 결과 (git 커밋)

| 파일 | 내용 |
|---|---|
| `inference_summary.csv` | 추론 실행 1번 = 1줄. 방법·precision·해상도별 속도, 메모리, 품질 점수 |
| `training_summary.csv` | 학습 실행 1번 = 1줄. precision·rank별 속도, 소요 시간, 성공/OOM/too_slow |
| `report/` | `make_report.py`가 만드는 발표 자료: LoRA 유무 비교표, 양자화 비교표, 품질 vs 속도 산점도, step별 품질 곡선, 이미지 비교 그리드 |

아직 실행 전이라 비어 있다.

## 7. `outputs/` — 큰 파일 (git 제외, 각자 PC에만 있음)

| 폴더 | 내용 |
|---|---|
| `candidates/` | 생성한 후보 이미지, 생성 로그(비용 포함), 큐레이션 기록 |
| `anchors/` | 선택한 anchor 5장 (`happy.png` 등). 큐레이션에서 고르면 자동으로 복사된다 |
| `datasets/v1/` | 학습용 이미지 + 캡션 |
| `runs/{run_id}/` | 실행 1번마다 폴더 1개: 설정 사본, 환경 정보, 측정값, 프롬프트별 결과, 이미지, 로그, (학습이면) 체크포인트 |
| `cache/te/` | 텍스트 인코더 결과 캐시 (같은 프롬프트는 다시 계산하지 않음) |

## 8. 그 밖의 폴더

| 폴더 | 내용 |
|---|---|
| `third_party/ai-toolkit/` | LoRA 학습 도구(ostris ai-toolkit) 소스. `train.py`가 내부적으로 호출한다. 버전이 바뀌면 설정 키가 달라질 수 있어서 커밋 `2d4c89d`로 고정했다 |
| `cloud/` | 나중에 클라우드 GPU로 학습할 때 쓸 자리. 지금은 README 한 줄뿐 |
| `.venv/` | Python 3.12 가상환경 (torch 2.13 + CUDA 13.0 등) |
| 모델 가중치 | 레포 밖 `C:\Users\SSAFY\.cache\huggingface\hub`에 있다 (약 37GB) |

---

## 9. 자주 생길 질문

- **"왜 학습은 base, 그림은 distilled로 하나?"** 학습은 원본(base)으로 해야 LoRA가 잘 배운다. 서비스에서는 4번 계산으로 끝나는 distilled가 빠르다. base로 배운 LoRA를 distilled에 붙여 쓰는 방식이다.
- **"왜 프롬프트 규칙을 한 파일에만 두나?"** 학습 때 캡션과 서비스 때 프롬프트가 조금이라도 다르면 LoRA가 제대로 반응하지 않는다. 그래서 Python(`prompt_builder.py`)과 Java 백엔드가 같은 YAML을 읽게 한다.
- **"테스트가 왜 34개가 아니라 40개?"** 사양의 세트를 합치면 24+6+6+4 = 40이다. 사양 문서의 34와 다르므로 팀 확인이 필요하다 (TODO.md).
- **"측정값이 왜 비어 있나?"** 실제로 돌린 값만 기록하는 규칙 때문이다. 못 돌린 조합은 빈칸으로 두고 이유를 적는다.
