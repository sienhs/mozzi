# GPU 서버 실행 명령 모음

GPU 서버(Jupyter Hub 터미널)에서 이미지 생성 워커를 올리고, 띄우고, 확인하는 명령을 모았다.

- 계정: `j-k15d102`, 배정 GPU: **0번**, 폴더: `~/ai_server`, conda 환경: `mochi`
- 설계와 동작 원리는 [WORKER_DESIGN.md](WORKER_DESIGN.md), 처음 환경 세팅은 [README.md](README.md) 1장

---

## 매일 할 일

Jupyter 세션은 24시간이 지나면 끝나고, 그때 워커도 같이 종료된다 (서버 규정). 매일 로그인해서 아래 한 줄을 실행한다.

```bash
cd ~/ai_server && bash start_worker.sh 0
```

이미 떠 있으면 "이미 실행 중이다"라고만 나오고 아무것도 바꾸지 않는다.

---

## 1. 처음 한 번

### 1-1. 패키지

```bash
conda activate mochi
pip install setproctitle        # 프로세스 이름에 계정명을 넣는다 (없어도 워커는 돈다)
```

### 1-2. `.env` 만들기

Jupyter 화면에서는 `.`으로 시작하는 파일을 올리거나 만들 수 없다. `env.txt`로 만든 뒤 터미널에서 이름을 바꾼다.

1. Jupyter에서 `ai_server` 폴더 → **New → Text File**
2. 노트북의 `ai-server/.env` 내용을 붙여 넣고 저장, 이름을 `env.txt`로 바꾼다
3. 터미널에서:

```bash
cd ~/ai_server && mv env.txt .env && chmod 600 .env
ls -la .env                     # -rw------- ... .env 이면 OK
```

**값이 맞는지 확인** (화면에 값은 나오지 않는다)

```bash
awk -F= '/^[A-Z0-9_]+=/{v=substr($0,index($0,"=")+1); gsub(/[ \r]/,"",v); printf "%-22s %s\n", $1, (v==""?"비어 있음":"설정됨")}' .env
grep -c $'\r' .env              # 0 이 아니면: sed -i 's/\r$//' .env
```

- `AWS_ACCESS_KEY_ID`는 **20자, `AKIA`로 시작**하고, `AWS_SECRET_ACCESS_KEY`는 **40자**다. 둘이 바뀌면 `InvalidClientTokenId`가 난다.

**AWS에 실제로 붙는지 확인**

```bash
cd ~/ai_server && python - <<'EOF'
import boto3
from worker.config import load_settings
s = load_settings("check")
print("키 주인:", boto3.client("sts", region_name=s.aws_region).get_caller_identity()["Arn"])
sqs = boto3.client("sqs", region_name=s.aws_region)
for name, url in [("요청 큐", s.request_queue_url), ("결과 큐", s.result_queue_url)]:
    a = sqs.get_queue_attributes(QueueUrl=url, AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]
    print(f"{name} OK (대기 메시지 {a['ApproximateNumberOfMessages']}개)")
EOF
```

`키 주인: arn:aws:iam::...`과 큐 2개 `OK`가 나오면 된다.

---

## 2. 코드 올리기

노트북에서 바뀐 파일을 Jupyter로 `~/ai_server/` 아래 **같은 위치**에 덮어 올린다. 폴더가 없으면 Jupyter에서 **New → Folder**로 먼저 만든다.

```
~/ai_server/
├── config.yaml  run_worker.sh  start_worker.sh  smoke_generate.py  requirements.txt
├── worker/    __init__.py __main__.py config.py engine.py loop.py messages.py
│              prompt.py prompt_rules.yaml refimage.py s3.py sqs.py
├── scripts/   send_test_job.py
├── tests/     __init__.py test_loop.py test_messages.py test_prompt.py
├── weights/   20261023_train_qfloat8_r16.safetensors   ← 건드리지 않음
└── .env                                                ← 건드리지 않음
```

올린 뒤 코드가 맞게 들어갔는지 시험한다 (GPU·AWS를 쓰지 않는다. 1초 안에 끝난다).

```bash
cd ~/ai_server && conda activate mochi
python -m unittest discover tests       # 마지막 줄 OK
```

---

## 3. 워커 띄우기·재시작·끄기

| 할 일 | 명령 |
|---|---|
| **띄우기** | `cd ~/ai_server && bash start_worker.sh 0` |
| 워커 화면 보기 | `tmux attach -t worker` (이미 다른 tmux 세션 안이면 `tmux switch-client -t worker`) |
| 세션 목록에서 고르기 (tmux 안에서) | `Ctrl+B` 눌렀다 떼고 `S` |
| 화면에서 빠져나오기 (워커는 계속 돎) | `Ctrl+B` 눌렀다 떼고 `D` |
| **새 코드로 재시작** | `tmux attach -t worker` → `Ctrl+C` **한 번** → 5초 뒤 새 코드로 다시 뜸 |
| **완전히 끄기** | `tmux attach -t worker` → `Ctrl+C` → 5초 안에 `Ctrl+C` 한 번 더 |
| tmux 밖에 남은 워커 끄기 | `pkill -u $USER -f run_worker.sh; pkill -u $USER -f "python -m worker"` |

- `Ctrl+C`는 처리 중인 1건을 끝낸 뒤 종료한다. 설정(`config.yaml`, `.env`)을 바꾼 뒤에도 재시작해야 반영된다.
- 새로 띄우기 전에 워커가 두 개가 되지 않게 확인한다: `pgrep -u $USER -af "worker|run_worker"`

**정상 시작 로그**

```
CUDA_VISIBLE_DEVICES: 원래 (없음) → 0
프로세스 이름: j-k15d102-mochi-worker-gpu0
모델 로드 (CPU 메모리) 0.8s ...
모델을 GPU 로 올림 2.9s: NVIDIA H200 NVL, VRAM 15.0GB ...
워밍업 1장 5.2s
요청 대기 시작 (...mozzi-dev-ai-request)
```

`요청 대기 시작` 다음에 `받기 실패`가 계속 찍히지 않으면 AWS 연결도 정상이다.

---

## 4. 상태 확인

| 확인 | 명령 |
|---|---|
| 워커가 살아 있나 | `tmux ls` (`worker`가 있으면 실행 중) |
| 우리 프로세스 (규정 방식) | `ps -ef \| grep k15d102` → `j-k15d102-mochi-worker-gpu0` 줄 |
| 계정 이름 잘림 없이 보기 | `ps -eo user:20,pid,etime,cmd \| grep k15d102` |
| GPU 사용 | `nvidia-smi` |
| 로그 실시간 | `tail -f ~/ai_server/logs/worker_gpu0.log` (나오기 `Ctrl+C`, 워커는 그대로) |

**GPU 프로세스마다 주인 보기** (규정 3-d: GPU 0에서 도는 게 우리 것인지)

```bash
nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader | while IFS=, read pid mem; do
  echo "$(ps -o user:20= -p $pid 2>/dev/null || echo '(다른 사용자)') $pid $mem $(ps -o cmd= -p $pid 2>/dev/null | cut -c1-50)"
done
```

- `ps -ef`는 8자가 넘는 계정 이름을 `j-k15d1+`로 자른다. `ps -ef | grep k15d102`에 워커가 걸리는 건 프로세스 이름에 계정명을 넣었기 때문이다.
- GPU 0의 우리 프로세스는 그리는 동안 약 15GB, 요청 없이 5분이 지나면 약 0.5GB다 (모델을 CPU로 내림).

---

## 5. 시험 요청 보내기

`send_test_job.py`는 Java 대신 요청 큐에 요청을 넣고 결과 큐에서 결과를 기다린다. 요청에 `"test": true`를 넣어서 그림은 S3 `test-diary/`에 저장된다.

```bash
cd ~/ai_server && conda activate mochi
python scripts/send_test_job.py                                    # 기본: 요리, 집, 엄마, 비, 저녁
python scripts/send_test_job.py --what reading --where "at a cafe" --who "with a friend" --emotion CALM
python scripts/send_test_job.py --what "eating spicy red rice cakes" --who "with a friend and a parrot" --time "at night" --weather ""
python scripts/send_test_job.py --bad                              # what 이 빈 요청 → INVALID_INPUT
python scripts/send_test_job.py -n 3                               # 3건
```

| 볼 것 | 정상 |
|---|---|
| 출력 | `"status": "SUCCEEDED"`와 `imageUrl` |
| `imageUrl` 브라우저로 열기 | 그림이 보인다 (403이면 버킷 공개 설정 문제) |
| 워커 로그 | `[완료] diary-9xxxxxxxx (test) ...` 다음 줄 `결과 전송 → mozzi-dev-ai-response (메시지 ID ...)` |

Java dev 서버가 결과 큐를 듣고 있으면 결과를 먼저 가져가서 스크립트는 시간 초과로 끝난다. 이때는 워커 로그의 `[완료]`, `결과 전송` 줄로 확인한다.

---

## 6. 로그에서 찾기

```bash
cd ~/ai_server/logs
grep -E "\[완료\]|\[실패\]|\[처리 실패\]" worker_gpu0.log | tail -20    # 최근 처리 결과
grep -A15 "\[실패\]" worker_gpu0.log | tail -40                         # 실패 원인 (요청·프롬프트·traceback)
grep '"diaryId": 102,' jobs_gpu0.jsonl                                  # 일기 102번의 기록 (프롬프트·seed·시간)
grep a975248635b0 jobs_gpu0.jsonl                                       # S3 파일 이름으로
```

| 로그 | 뜻 |
|---|---|
| `[완료]` + `결과 전송 → ...` | 그림 저장, 결과 큐 전송, 요청 삭제까지 끝남 |
| `[실패] ... INVALID_INPUT` | 요청 값이 잘못됨. 아래 `요청:` 줄에 들어온 요청 전체 |
| `[실패] ... GENERATION_FAILED` / `UPLOAD_FAILED` | 생성·S3 오류. 아래에 traceback |
| `[처리 실패] 결과를 보내지 못해 ...` | 결과 큐 전송 실패. 요청은 큐에 남아 2분 뒤 다시 처리됨 |
| `보정: ...` | 워커가 입력을 고쳐서 그림 (예: 모르는 날씨) |

---

## 7. 자주 나는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `받기 실패 ... InvalidClientTokenId` | AWS 키 ID가 틀림. 키 ID와 시크릿이 바뀐 경우가 많다 | `.env`의 두 값 확인 (1-2) → 워커 재시작 |
| `SignatureDoesNotMatch` | 시크릿 키가 틀림 | 같음 |
| `NonExistentQueue` | 큐 주소가 틀림 | `.env`의 큐 주소 확인 |
| `UPLOAD_FAILED ... AccessDenied` | IAM에 S3 쓰기 권한 없음 (`diary/*`, `test-diary/*`) | 인프라 담당에게 `s3:PutObject` 요청 |
| `.env 에 S3_BUCKET 가 없다` | `.env`에 그 항목이 비었거나 파일이 없음 | `ls -la ~/ai_server/.env`, 1-2 |
| `can't find session: worker` | 워커가 꺼져 있음 (24시간 세션 종료 등) | `pgrep`로 남은 워커 확인 후 `bash start_worker.sh 0` |
| `tmux ls`에 `setup` 같은 다른 세션만 `(attached)` | 지금 그 세션 안에 있음. `worker` 세션은 없음 | 위와 같음. 들어갈 때는 `tmux switch-client -t worker` |
| `sessions should be nested with care` | tmux 안에서 `tmux attach`를 함 | `tmux switch-client -t worker` |
| `GPU 빈 메모리 ...GB < 24GB` | 다른 팀이 GPU 0을 많이 쓰는 중 | `nvidia-smi` 확인. 비면 다음 요청부터 정상 |
| `ps -ef \| grep k15d102`에 워커가 안 보임 | 예전 코드이거나 `setproctitle` 미설치 | 1-1, 새 코드로 재시작 |
| `grep "worker --gpu` 후 `>`만 나옴 | 닫는 따옴표 빠짐 | `Ctrl+C` 후 따옴표 양쪽 다 |
| nano에서 안 나가짐 | `Ctrl+X` 후 아래 질문에 답해야 함 | `Ctrl+X` → `Y` → `Enter` (vi면 `Esc` → `:wq` → `Enter`) |
| `ls`에 `.env`가 안 보임 | 숨김 파일 | `ls -la` |

---

## 8. 공용 서버 규정 (요약)

- 실행할 때 배정 GPU 번호(0)를 반드시 지정한다. `start_worker.sh 0`, `smoke_generate.py --gpu 0`. 번호 없이는 실행되지 않게 해 두었다.
- 실행 후 `nvidia-smi`의 PID → `ps`로 우리 계정인지 확인한다 (4장).
- Jupyter를 닫은 뒤 남은 우리 프로세스는 정리한다: `ps -ef | grep k15d102` → `kill PID` (안 꺼지면 `kill -9 PID`)
- 세션은 24시간이면 끝난다. 매일 다시 띄운다.
