# TODO

마지막 갱신: 2026-10-19

## ✅ 완료 (2026-10-19)
- [x] `ai/` 폴더 구조, README, CLAUDE.md, .env.example, requirements.txt, setup.ps1, .gitignore
- [x] `.venv` 설치 (torch 2.13.0+cu130, ai-toolkit 의존성, CUDA 동작 확인)
- [x] ai-toolkit 클론 (commit `2d4c89d`) + `flux2_klein_4b` 설정 키 소스 확인
- [x] `prompt_rules.yaml` + `prompt_builder.py` (캡션/프롬프트 조립, 제외 규칙 검증)
- [x] `make_manifest.py` 실행 → manifest 61슬롯, 할당량 전부 충족, pairwise 커버리지 75%, 홀드아웃 52개, 제외 조합 60건
- [x] 스크립트 작성: generate_candidates / providers / curate_app / build_dataset / train / klein_runtime / infer / eval / run_matrix / make_report
- [x] 학습 설정 2종 (smoke 50 step, 본 학습 2000 step), experiment_matrix.yaml (우선순위 1~3)
- [x] 모델 다운로드: klein-4B distilled, klein-base-4B, Qwen3-4B, flux2_vae, GGUF Q8/Q4 (평가 모델인 DINOv2/CLIP/OWLv2는 eval 첫 실행 때 자동으로 받음)

## 🔜 내일 할 일 (순서대로)
1. [x] 다운로드 완료 (2026-10-19 17:56): distilled, base, Qwen3-4B, flux2_vae, GGUF Q8_0·Q4_K_M 전부.
   캐시가 지워졌을 때만 아래 명령으로 다시 받는다 (PowerShell, ai/에서):
   ```powershell
   $env:HF_HUB_DISABLE_SYMLINKS="1"; $env:HF_XET_HIGH_PERFORMANCE="1"
   .venv\Scripts\python.exe -c "from huggingface_hub import hf_hub_download as d; [print(d('unsloth/FLUX.2-klein-4B-GGUF', f)) for f in ['flux-2-klein-4b-Q8_0.gguf','flux-2-klein-4b-Q4_K_M.gguf']]"
   ```
2. [x] **추론 동작 확인** (10/20, klein_base 768px, 동작 확인용. fp8은 배터리 상태라 본 측정 아님)
   - fp8 ✅ 9.0s/장 · gguf_q8 ✅ 10.1s · gguf_q4 ✅ 7.9s (6GB 안에 들어가는 유일한 버전) · bf16 ❌ too_slow (warmup 5분+)
   - fp8·q8도 768px에서 전용 6GB를 0.4~0.7GB 넘음 (sysmem_fallback=true)
   - `--max-image-sec` 추가 (매트릭스 기본 120s) → 느린 조합은 자동으로 too_slow 처리하고 다음으로 넘어감
3. [x] **스모크용 임시 데이터셋** (10/20): klein_local로 12장 생성 → `outputs\datasets\smoke` (main_sheet 10 + scene 2, 품질 무관)
4. [x] **스모크 학습** (10/20) → `20261020_train_qfloat8_r8_smoke-2`
   - qfloat8 / rank 8 / 512px: **3.67 s/it**, 전용 VRAM 5.76GB(96%) + 공유 0.99GB → fallback 판정 False지만 경계선, RAM 19GB
   - **2000 step 예상 약 2.0시간** (+ 첫 실행 때 캡션 임베딩 캐싱 약 17s/개, val 샘플링 시간은 미측정)
   - 1차 실행(`..._smoke`)은 모니터 버그(자식 프로세스 미추적)로 dedicated/shared 값을 무효 처리함 → common.py 수정
5. [x] **LoRA 호환성** (10/20): ai-toolkit LoRA(`diffusion_model.*` 키) → diffusers `load_lora_weights` 정상 로딩. fp8·gguf_q4 모두 동작
   - 버그 수정: fp8 casting을 LoRA를 붙인 **뒤에** 켜야 함 (`klein_runtime.enable_fp8_storage`)
   - LoRA scale 0 vs 1 비교로 실제 적용을 확인함 (픽셀 차이 평균 16~28). 50 step이라 효과는 약함
   - ⚠️ 발견: 짧은 캡션만 넣으면 그림이 **실사 인형 사진**처럼 나옴 (scale 0도 같음). 캡션에 화풍을 안 쓰므로
     본 학습 LoRA가 화풍까지 학습해야 함 → 본 학습 후 확인하고, 부족하면 서비스 프롬프트에 화풍 접미사를 붙일지 팀 논의
6. [x] `eval.py` (10/20): DINOv2·CLIP-L·OWLv2 다운로드, `klein_base_fp8_768`에 clip_t=33.83 기록 (anchor가 없어서 dino/clip_i는 빈칸)
   - 임시 anchor(스모크 시트)로 기능 테스트 (scratchpad, 결과 CSV에는 미반영): dino/clip_i/crop 전부 동작
   - OWLv2 크롭이 동행이 아니라 주인공 흰 모찌를 잡는 것을 육안으로 확인. 동행 장면 dino 0.53 → crop 0.68
   - 수정: transformers 5.x API `post_process_grounded_object_detection`, 진단용 `--no-summary` 추가
7. [x] `make_report.py` (10/20): md 표 4종 + 이미지 그리드 생성 확인. 산점도와 step 곡선은 데이터가 생기면 자동으로 그려짐 (dino_sim, 체크포인트 스윕 필요)
   - 학습 표에 "2000step 환산(h)" 열 추가
   - ⚠️ 지금 `results/report/`에 있는 건 동작 확인용 실행 결과다. 본 측정 후 다시 생성하고, 커밋은 그때 할 것
   - 관찰: klein_base는 fp8/q8/q4 그림이 거의 같음. klein_lora(스모크 LoRA + 짧은 캡션)는 실사·사람·간판 글자가 나와 규칙 위반

## ✅ 2026-10-22
- [x] 생성 프롬프트에서 "At most three small props" 제거 → 장면 프롬프트에만 `scene_detail`(풍성한 배경) 추가. 캡션은 그대로, manifest 재생성 (prompt 열만 변경)
- [x] **768 스모크 학습** → `20261022_train_qfloat8_r8_smoke`: **7.08 s/it** (512의 약 1.9배), 전용 5.76GB + 공유 0.93GB, fallback False (512와 같은 수준), RAM 14GB, 61°C
  - **2000 step 예상 약 3.9시간** (512는 약 2.0시간). 6GB에서 768 학습 가능
- [x] **1024 스모크 학습** → `20261022_train_qfloat8_r8_smoke-2`: **12.35 s/it**, 전용 5.75GB + 공유 1.56GB, **fallback True** (시스템 메모리로 넘침), RAM 17GB, 64°C
  - **2000 step 예상 약 6.9시간**. 돌아가긴 하지만 공유 메모리를 써서 느림
  - ✅ 본 학습 설정(`train_local.yaml`) `resolution: [768]`로 변경 (val 샘플은 시간 절약을 위해 512 유지)
- [ ] 학습 이미지: Atlas Cloud `openai/gpt-image-2.5-flare-developer/edit` (레퍼런스 최대 16장, $0.03/장)
  - 프롬프트: `dataset/prompts/generation_prompts.md` (anchor → 시험 5개 → 나머지)

## ⏳ 2026-10-23
- [x] **본 학습** `20261023_train_qfloat8_r16` (768, rank 16, 2000 step, 데이터셋 v1 56장) → success
  - 재개 구간 1500→2000: 6.04 s/it, 51.8분, 전용 5.77GB + 공유 0.96GB, fallback False, 78°C
  - 학습 합계 약 204.6분 (1~1500 152.8분 + 재개 51.8분, 첫 구간 로딩·캐싱 약 17분 제외)
  - training_summary.csv 행은 재개 구간 값만 담고 있음. notes에 전체 구간을 적어 둠
- [x] **체크포인트 스윕** (fp8/768, val 12) → `results/report/20261023_sweep/checkpoint_sweep.md`
  - dino_crop: 250 0.379 → 750 0.445 → 1750 **0.483** (최고) → 2000 0.460. clip_t 33.4~34.8 (과적합 신호 없음)
  - 모든 step 공통 문제: coworker 동행이 사람으로 그려짐(val_002), close-up 실사풍(val_006, 012), 와이드인데 모찌가 큼(003, 010), 칠판 글자(011)
- [x] **추론 프롬프트 수정 시험** (s2000, val 12)

  | 버전 | dino_crop | clip_i | clip_t |
  |---|---|---|---|
  | 원래 | 0.460 | 0.745 | 34.31 |
  | A: + `inference_style` | 0.551 | 0.752 | 33.72 |
  | B: A + coworker 새 표현 | 0.559 | 0.761 | 34.19 |

  - A: 실사풍 해결 (val_012 0.32 → 0.66), 그림 전체에 크레용 질감
  - B: coworker가 작은 하늘색 모찌로 나옴 (A는 모찌 머리에 사람 옷)
  - B의 val_002·011 clip_t는 캡션 문구가 달라서 엄밀한 비교는 아님
  - 아직 남은 문제: 와이드 샷, 칠판 글자
- [x] `inference_style` 기본 적용 결정 → `infer.py` klein_lora 기본 ON (`--no-inference-style`로 끔). run_matrix도 그대로 따름
- [x] 1차 비교 실험 `run_matrix --kind inference --priority 1` (test 40, 768, s2000) → `results/report/20261023/`
  - q4 7.49s/장, VRAM 4.01GB, 넘침 없음 → 서비스 정밀도 후보. bf16 too_slow, api_ref는 공급자 미정으로 미실행
  - LoRA vs base(Q1)는 지표 차이가 작아 그리드·사람 평가로 확인 필요
- [x] 특색 캐릭터 재현 시험 (레몬·수박·우비, `variant_test.py`) → LoRA + 글 + 참조 1장이 가장 정확, 장당 12.9s ([experiments.md](experiments.md) 10/26)
- [ ] 특색 캐릭터 문구를 입는 것(항상)과 드는 것(실외만)으로 나누기
- [ ] 1차 비교 그리드로 Q1(LoRA 효과) 사람 평가 (human_score)
- [ ] v2 데이터셋에서 새 coworker 표현으로 학습 캡션 맞추기 (v1 LoRA는 옛 표현으로 학습됨)
- [ ] v2: 와이드 샷·close-up 장면 데이터 늘리기 (프롬프트로 안 고쳐짐)
- 상세 결과(학습 속도 저하·재개, 스윕, 프롬프트 시험)는 [experiments.md](experiments.md) 10/23 항목

## ⏳ 팀 결정 대기 (막히면 여기 먼저)
- [ ] `{{OUTLINE_COLOR}}`: 외곽선 색 (`prompt_rules.yaml` → `variables.outline_color`, 현재 null)
- [ ] `{{MOOD_COLOR_MODE}}`: environment(권장, 임시 적용) / body_tint
- [ ] `{{IMAGE_API_PROVIDER}}`: 외부 이미지 API → `providers.py`의 `ExternalApiProvider.generate()` 구현 + `.env`
- [ ] `{{MAX_TRAIN_HOURS}}`: 기본 12시간
- [ ] test 세트 수 확인: 사양 문서는 "34개", 현재 구성은 24+6+6+4 = 40개

## 📋 그 다음 (데이터셋 확정 후)
- [ ] anchors 5장 생성 → curate_app에서 선택 (`outputs/anchors/{mood}.png`로 자동 복사)
- [ ] 나머지 56슬롯 × 3장 후보 생성 → 큐레이션 → `build_dataset.py` (v1)
- [ ] 본 학습 `train_q8_r16` (2000 step) → 체크포인트 스윕
- [ ] `run_matrix.py --priority 1` → 2차(1024px, rank 8) → `make_report.py`
- [ ] 팀원 human_score 채우기 (per_prompt.csv)
- [ ] eval 주인공 크롭(OWLv2) 결과를 육안으로 검증하고, 부정확하면 SAM 세그멘테이션 검토
