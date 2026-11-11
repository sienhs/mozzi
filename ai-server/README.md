# ai-server — 모찌 일기 이미지 생성 워커

GPU 서버에서 돌아가는 이미지 생성 워커다. SQS에서 요청을 읽고, 그림을 그려 S3에 저장한 뒤, 결과를 SQS로 보낸다.

- 학습과 비교 실험은 [`ai/`](../ai)에서 한다. 이 폴더는 **서비스용 코드만** 둔다.
- 워커 설계 (요청·결과 메시지, 프롬프트 조립, 실패 처리, 실행 방법): [WORKER_DESIGN.md](WORKER_DESIGN.md)
- GPU 서버에서 쓰는 명령 모음 (올리기, 띄우기, 확인, 문제 해결): [SERVER_RUNBOOK.md](SERVER_RUNBOOK.md)
- Java가 태그를 번역할 때 GMS에 넣는 프롬프트: [TAG_TRANSLATION_RULES.md](TAG_TRANSLATION_RULES.md)
- 특색 캐릭터 문구(`characterPrompt`) 만드는 규칙: [CHARACTER_PROMPT_RULES.md](CHARACTER_PROMPT_RULES.md) (백엔드용), [CHARACTER_PROMPT_GUIDE.md](CHARACTER_PROMPT_GUIDE.md) (원본 프롬프트를 변환하는 사람용)
- 상태: **워커 구현** (Java `ai-request` 형식 + 프롬프트 조립). 서버에서 실제 생성·SQS 시험 전

```
Spring ──► SQS (요청) ──► ai-server 워커 (GPU 서버) ──► S3 (이미지)
                                   │
                                   └──► SQS (결과) ──► Spring
```

GPU 서버는 VPN 안에 있어서 바깥에서 들어오는 연결을 받을 수 없다. 그래서 워커가 **먼저 SQS와 S3로 나가서** 일을 가져오고 결과를 올린다.

## 서버 환경

| 항목 | 값 |
|---|---|
| GPU | NVIDIA H200 NVL (각 141GB), 드라이버 570, CUDA 12.8. **여러 팀이 같이 쓰는 학습용 서버**이고, 우리 팀에 배정된 GPU 1장만 쓴다 |
| 접속 | VPN → Jupyter Hub 터미널 |
| 상시 실행 | `tmux`. 단 **Jupyter 세션 24시간이 지나면 tmux 안의 프로세스도 종료된다** (서버 규정) |
| 외부 연결 | HuggingFace, PyPI, AWS(SQS) 확인 |
| Python | conda 환경 `mochi` (Python 3.12) |

## 1. 환경 세팅 (처음 한 번)

```bash
# (선택) 모델 캐시를 큰 디스크로: 약 20GB
echo 'export HF_HOME=~/hf_cache' >> ~/.bashrc && source ~/.bashrc

cd ai-server
bash setup_server.sh                 # conda 환경 생성 → torch(cu128) → 패키지 → 점검
conda activate mochi
python check_env.py --download       # 추론 모델 받기 (FLUX.2 klein 4B)
```

- torch는 **2.11.0+cu128**을 쓴다. 노트북(`ai/`)의 2.13.0+cu130은 드라이버 580 이상이 필요하고, cu128 빌드는 2.11.0까지만 나와 있다 (10/27 확인). transformers(torch>=2.4)·diffusers(torch>=2.6) 요구 조건은 만족한다.
- 나머지 패키지는 `ai/`와 같은 버전이다 (diffusers는 ai-toolkit이 고정한 커밋).
- `check_env.py` 마지막 줄이 `OK`면 세팅이 끝난 것이다.

## 공용 서버 규정 (요약)

- 프로그램을 실행할 때 **배정된 GPU 번호를 반드시 지정한다.** 이 폴더의 스크립트는 모두 `--gpu 번호`(또는 `run_worker.sh 번호`)를 받고, 지정하지 않으면 실행되지 않는다. 번호는 `nvidia-smi`와 같은 순서(`CUDA_DEVICE_ORDER=PCI_BUS_ID`)로 센다.
- 실행 후 확인: `nvidia-smi` 하단 Processes의 PID → `ps -ef | grep PID`로 우리 계정인지 본다.
- Jupyter를 닫은 뒤에도 남은 우리 팀 프로세스는 `ps -ef | grep 계정명` → `kill -9 PID`로 정리한다.

## 2. 생성 확인

LoRA 파일(`ai/`에서 학습한 `20261023_train_qfloat8_r16.safetensors`)을 `weights/`에 올린 뒤:

```bash
python smoke_generate.py --gpu 0 --lora weights/20261023_train_qfloat8_r16.safetensors   # 0: 배정받은 GPU 번호
```

val 5장을 bf16으로 그려 `outputs/smoke/`에 저장하고, 장당 시간과 VRAM을 `summary.json`에 남긴다.

## 3. 워커 실행

```bash
cp .env.example .env && vi .env     # 처음 한 번: AWS 키, 큐 주소, 버킷

bash start_worker.sh 0              # 0: 배정받은 GPU 번호. tmux 세션 "worker" 안에 워커 1개를 띄운다
tmux attach -t worker               # 들어가서 보기 (빠져나오기: Ctrl+B, D)
```

- GPU 0은 다른 팀과 같이 쓴다. 모델(약 16GB)은 요청이 오면 GPU로 올려 그리고(장당 약 0.36초, 10/28 smoke), **요청 없이 5분이 지나면 CPU 메모리로 내려 GPU 메모리를 돌려준다** (`config.yaml` `generate.idle_release_sec`). 내린 뒤에도 `nvidia-smi`에는 우리 프로세스가 약 0.5GB로 남는다 (CUDA 기본 메모리). 쉬고 난 뒤 첫 그림은 GPU로 올리는 몇 초가 더 걸린다.
- **매일 할 일:** 24시간 세션 제한 때문에 워커가 하루 안에 종료된다. 매일 Jupyter에 로그인해서 `bash start_worker.sh 0`을 한 번 실행한다. 이미 떠 있으면 그대로 두고 알려 준다.
- 워커가 꺼져 있던 동안 들어온 요청은 큐에 남아 있다가, 워커가 다시 뜨면 처리된다. 10분(`expire_sec`)이 지난 요청은 그리지 않고 `EXPIRED`로 돌려준다.

| 할 일 | 방법 |
|---|---|
| 시험 요청 보내기 | `python scripts/send_test_job.py` (결과까지 기다림, `--what reading --where "at a cafe"`, `-n 4`, `--bad`) |
| 살아 있는지 | `tmux ls` 에 `worker` 가 있는지, `tail -f logs/worker_gpu0.log` |
| 로그 | `tail -f logs/worker_gpu0.log`, 작업별 기록은 `logs/jobs_gpu0.jsonl` |
| 코드 바꾸기 | 새 파일을 올리고 워커 창에서 `Ctrl+C` → 처리 중인 1건을 끝내고 5초 뒤 새 코드로 다시 뜸 |
| 완전히 멈추기 | `Ctrl+C` 후, 다시 뜨기 전 5초 안에 한 번 더 `Ctrl+C` |
| GPU 없이 흐름만 시험 | `python -m worker --fake-engine` (노트북에서도 됨. `.env`는 필요) |
| 단위 시험 | `python -m unittest discover tests` (GPU·AWS 없이 돈다) |

처리 흐름과 실패 처리 규칙은 [WORKER_DESIGN.md](WORKER_DESIGN.md) 5장에 있다.

## 정할 것

- 서비스 프롬프트 규칙은 `worker/prompt_rules.yaml`에 있다. 학습 캡션과 같아야 하는 값은 `ai/configs/prompt_rules.yaml`에서 옮겨 왔으니, 한쪽을 바꾸면 다른 쪽도 바꾼다.
- AWS 인증: GPU 서버가 AWS 밖에 있어서 IAM 사용자 키(SQS 읽기·쓰기, S3 쓰기만)를 `.env`에 둔다. 키는 커밋하지 않는다.
