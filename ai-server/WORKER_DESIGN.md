# 이미지 생성 워커 설계 (GPU 서버)

GPU 서버에서 SQS 요청을 읽어 모찌 그림을 그리고, S3에 올린 뒤 결과를 SQS로 Java에 돌려주는 워커의 설계다.

- 상태: **초안 (2026-10-28)**. 전부 구현했다. 요청은 backend(Java)가 정한 "그림 일기 메시지 큐" 형식(10/28)을 따른다 (4장).
- [ai/IMAGE_GENERATION_API.md](../ai/IMAGE_GENERATION_API.md) (v0.1)는 이전 제안이다. 메시지 형식은 이 문서 4장이 맞다.
- 서버 환경과 설치 방법은 [README.md](README.md)에 있다.

---

## 1. 전제

| 항목 | 내용 |
|---|---|
| 서버 | 여러 팀이 같이 쓰는 학습용 GPU 서버 (H200 NVL, 141GB). **배정된 GPU 1장만** 쓴다. VPN 안이라 밖에서 들어오는 연결을 받을 수 없다. Jupyter 세션은 24시간이면 끝나고, 그때 우리 프로세스도 종료된다 |
| 전달 방식 | SQS. 워커가 먼저 SQS·S3로 나가서 일을 가져오고 결과를 올린다 |
| 한국어 처리 | **Java가 번역해서 보낸다.** 워커는 영어 값만 받는다 (`"at home"`, `"with mom"`, `"cooking"`) |
| 모델 | FLUX.2 klein 4B (distilled) + 모찌 LoRA (`20261023_train_qfloat8_r16`), bf16, 768×768, 4 step |
| 프롬프트 | 학습 캡션 형식 + 화풍 문구(`inference_style`). 규칙 데이터는 `worker/prompt_rules.yaml` (5-4) |

## 2. 전체 흐름

```
Java ──► SQS 요청 큐 ──► 워커 (배정 GPU) ─┐
                                       │ 1. 메시지 받기 (long polling 20초, 1건)
                                       │ 2. 검사 → 프롬프트 조립 (위반은 자동 보정)
                                       │ 3. 생성 (모델은 GPU에 상주)
                                       │ 4. S3 업로드
                                       │ 5. 결과 큐로 전송
                                       │ 6. 요청 메시지 삭제   ← 반드시 마지막
Java ◄── SQS 결과 큐 ◄─────────────────┘
```

- **배정된 GPU 1장에 워커 프로세스 1개**를 띄운다. 나중에 GPU를 더 받으면 워커를 더 띄우면 된다 (같은 큐를 읽어도 SQS가 메시지를 나눠 준다).
- 한 번에 1건씩 처리한다. H200에서는 장당 몇 초로 예상되므로 묶음 처리는 필요해지면 추가한다.
- 배정받은 GPU 0은 **다른 팀과 같이 쓴다.** 모델(bf16 전체 약 16GB)은 시작할 때 CPU 메모리에 올리고, 요청이 오면 GPU로 옮겨 그린다 (장당 약 0.36초, 10/28 smoke). 요청 없이 5분(`idle_release_sec: 300`)이 지나면 다시 CPU로 내려 GPU 메모리를 돌려준다.
- 내린 뒤에도 프로세스는 살아 있어서 `nvidia-smi`에 CUDA 기본 메모리(약 0.5GB)로 남는다. 이것까지 비우려면 프로세스를 끝내야 해서 하지 않는다.
- 쉬고 난 뒤 첫 그림은 GPU로 옮기는 시간(몇 초, 로그 "모델을 GPU 로 올림")이 더 걸린다. GPU를 우리만 쓰게 되면 `idle_release_sec: 0`으로 계속 올려 둔다.
- GPU로 옮기기 전에 빈 메모리가 24GB보다 적으면 그리지 않고 `GENERATION_FAILED`로 돌려준다 (다른 팀이 쓰는 중).

## 3. 폴더 구조

```
ai-server/
├── README.md, requirements.txt, setup_server.sh, check_env.py   (지금 있음)
├── WORKER_DESIGN.md      # 이 문서
├── .env.example          # AWS 키, 큐 URL, 버킷 (실제 값은 .env, 커밋하지 않음)
├── config.yaml           # 모델·생성·작업 설정 (6-2)
├── start_worker.sh       # 매일 로그인 후: tmux 세션 worker 안에 run_worker.sh 를 띄움 (이미 있으면 그대로)
├── run_worker.sh         # GPU 번호를 받아 워커 실행, 죽으면 5초 뒤 재시작
├── worker/
│   ├── __main__.py       # 진입점: python -m worker --gpu 0
│   ├── config.py         # .env + config.yaml → Settings
│   ├── messages.py       # 요청·결과 dataclass, 파싱, 에러 코드
│   ├── prompt.py         # 요청 값 → 프롬프트, 기본값, 자동 보정, 영어 문구 정리
│   ├── prompt_rules.yaml # 감정·활동·장소·동행·시간대 → 학습 캡션 문구, 별칭, 금지어
│   ├── engine.py         # 모델 로드·상주, generate(prompt, seed, ref) → 이미지. 가짜 엔진도 여기
│   ├── refimage.py       # 특색 캐릭터 참조 이미지 받기
│   ├── sqs.py            # 받기, 결과 보내기, 삭제, visibility 연장
│   ├── s3.py             # S3 키 정하기, PNG 업로드, imageUrl
│   └── loop.py           # 한 건 처리(handle) + 반복 + 종료 신호
├── smoke_generate.py     # 생성 시험 (val 5장, 장당 시간)
├── scripts/
│   └── send_test_job.py  # 가짜 Java: 요청 큐에 메시지를 넣고 결과를 기다림
├── tests/                # GPU·AWS 없이 도는 시험: messages, prompt, loop (python -m unittest discover tests)
├── weights/              # LoRA 파일 (gitignore)
└── logs/                 # 워커 로그, 작업 기록 (gitignore)
```

### 3-1. 모듈 책임

| 모듈 | 하는 일 | 모르는 것 |
|---|---|---|
| `messages.py` | JSON ↔ dataclass, 필수 값 검사 | SQS, 모델 |
| `prompt.py` | 규칙 검사, 자동 보정, 캡션 조립 | SQS, 모델 |
| `engine.py` | 이미지 생성 | SQS, S3, 메시지 형식 |
| `sqs.py`, `s3.py` | AWS 호출 | 모델, 프롬프트 |
| `loop.py` | 위 모듈을 순서대로 부르고 실패를 처리 | – |

**이렇게 나누는 이유:** `engine`을 가짜(흰 이미지 반환)로 바꾸면 GPU 없이 노트북에서 SQS → S3 → SQS 전체 흐름을 시험할 수 있다. 전달 방식이 바뀌어도 `sqs.py`만 고친다.

### 3-2. 프롬프트 규칙을 `ai/`와 따로 두는 이유

서버에는 `ai-server/`만 올라가므로 서비스에 필요한 규칙을 `worker/prompt_rules.yaml`에 옮겨 두었다. 학습 캡션과 글자까지 같아야 하는 값(트리거, 화풍 문구, 활동·장소 caption, 동행 문구)은 `ai/configs/prompt_rules.yaml` (version 1)에서 그대로 가져왔다. **한쪽을 바꾸면 다른 쪽도 바꾼다.** 서비스에만 있는 것(Java 값의 별칭, 시간대 빛, 금지어)은 이 파일에만 있다.

## 4. 메시지

Java(backend)가 정한 형식이다. 필드 이름은 camelCase다.

### 4-1. 요청 (`ai-request`)

```json
{
  "diaryId": 102,
  "userId": 12,
  "test": false,
  "date": "2026-10-28",
  "emotion": "CALM",
  "characterImageUrl": "DEFAULT",
  "characterPrompt": "",
  "timeOfDay": "in the evening",
  "weather": "on a rainy day",
  "where": "at home",
  "who": "with mom",
  "what": "cooking"
}
```

| 필드 | Java 규격 | 워커가 하는 일 | 문제가 있으면 |
|---|---|---|---|
| `diaryId` | number, 필수 | 결과·S3 키에 씀 | 결과를 보낼 곳이 없어 **버림** (로그만) |
| `userId` | number, 필수 | 결과·S3 키에 씀 | `INVALID_INPUT` |
| `test` | `true` / `false` | `true`면 S3 **`test-diary/`** 폴더에 저장 (`config.yaml` `output.test_prefix`). 로그에 `(test)` 표시 | 없으면 `false`. 불리언이 아니면 `INVALID_INPUT` |
| `date` | `YYYY-MM-DD`, 필수 (항상 오늘) | 형식만 검사. 기록용 | `INVALID_INPUT` |
| `emotion` | `HAPPY` `CALM` `NEUTRAL` `SAD` `ANGRY` | 소문자로 바꿔 감정 토큰으로 | 모르는 값·빈 값이면 `neutral` |
| `characterImageUrl` | URL 또는 `"DEFAULT"` | URL이면 내려받아 참조 이미지로. 표정은 `emotion`을 따른다 (10/26 레몬 시험) | 받기 실패 → `REF_IMAGE_FAILED` |
| `characterPrompt` | 영어, 필수 | `"DEFAULT"` 캐릭터면 **쓰지 않는다** (기본 모찌 설명은 학습한 트리거가 이미 맡음). 특색 캐릭터면 [CHARACTER_PROMPT_RULES.md](CHARACTER_PROMPT_RULES.md) 형식 검사 후 트리거 뒤에 붙임 | 형식이 안 맞으면 빼고 그림 |
| `timeOfDay` | `""` 가능 (`in the evening`) | 전치사·관사를 떼고 빛 문구로 | 빈 값이면 기본 빛 |
| `weather` | `""` 가능 (`on a rainy day`) | 전치사·관사·`day`를 떼고 학습한 날씨 빛 문구로 (5-4) | 빈 값이면 시간대로만 |
| `where` | `""` 가능 (`at home`) | 아는 장소면 학습 캡션 문구, 모르면 영어 문구 그대로 | 빈 값이면 `home` |
| `who` | `""` 가능 (`with mom`) | **사람 단어를 모찌로 바꾼다** (`with mom` → 가족 모찌). 최대 2마리 | 빈 값이면 혼자 |
| `what` | 필수 (`cooking`, `eating fried chicken and beer`) | 아는 활동이면 학습 캡션 문구, 모르면 영어 문구를 정리해서 그대로 | `INVALID_INPUT` |

- 모든 문자열은 앞뒤 공백을 지우고, `""`는 값이 없는 것으로 본다.
- 요청 시각 필드가 없으므로 만료 검사는 SQS가 붙이는 `SentTimestamp`로 한다.

### 4-2. 결과 (`ai-response`)

```json
{
  "diaryId": 102,
  "userId": 12,
  "status": "SUCCEEDED",
  "imageUrl": "https://{bucket}.s3.ap-northeast-2.amazonaws.com/diary/12/102/6f1c2a9e1b2c.png",
  "errorCode": null,
  "errorMessage": null
}
```

| 필드 | 내용 |
|---|---|
| `diaryId`, `status`, `imageUrl` | Java가 정한 필드. `status`는 `SUCCEEDED` / `FAILED` |
| `userId` | **추가.** 요청의 `userId`를 그대로 돌려준다 |
| `errorCode`, `errorMessage` | **추가.** 실패일 때만 값이 있다 (5-2). 실패면 `imageUrl`은 `null` |

프롬프트, seed, 보정 내역(fixes), 처리 시간은 결과에 넣지 않고 워커 로그에만 남긴다 (5-1).

`imageUrl`은 presigned URL이 아니라 고정 주소다. 앞부분은 `.env`의 `IMAGE_BASE_URL`(CloudFront 등)이고, 비우면 S3 기본 주소다. 앱에서 이 주소로 바로 열려면 버킷(또는 `diary/` 경로)이 공개 읽기이거나 CloudFront 뒤에 있어야 한다.

## 5. 처리 상세

### 5-1. 한 건 처리 순서

```
handle(message):
  req = parse(message.body)                 # 실패 → INVALID_INPUT 결과, 삭제 (diaryId 를 모르면 버림)
  if now - message.sent_at > 만료 시간:      # → EXPIRED 결과, 삭제
  prompt, fixes = build_prompt(req.scene)   # 빈 값은 기본값, 이상한 값은 보정하고 fixes 에 기록
  ref = download(req.characterImageUrl) if 있으면   # 실패 → REF_IMAGE_FAILED
  key = diary/{userId}/{diaryId}/{요청 ID 12자}.png
  image = engine.generate(prompt, seed(요청 ID), ref)   # 실패 → GENERATION_FAILED
  s3.upload(key, image)                     # 실패 → UPLOAD_FAILED
  sqs.send_result(SUCCEEDED, imageUrl)
  sqs.delete(message)                       # 결과를 보낸 뒤에 삭제
```

**로그** (터미널과 `logs/worker_gpu{N}.log`에 같은 내용)

```
[완료] diary-102 대기 0.4s, 생성 3.12s → https://.../diary/7/102/6f1c2a9e1b2c.png
  보정: who: 'stranger' 모름 → friend
[실패] diary-102 INVALID_INPUT: what: 비어 있으면 안 됨
  요청: {"diaryId": 102, ..., "what": ""}           ← 입력 오류면 들어온 요청 전체
[실패] diary-102 GENERATION_FAILED: RuntimeError: CUDA out of memory ...
  프롬프트: mochi_char, happy, cooking, ...
  Traceback (most recent call last): ...             ← 생성·업로드 오류면 traceback
```

작업마다 `logs/jobs_gpu{N}.jsonl`에도 한 줄씩 남긴다. 결과 메시지 + 요청 ID, 대기·생성 시간, 프롬프트, seed, fixes, (실패면) 요청·traceback. 처리량, 실패율, 어떤 값이 자주 보정되는지는 이 파일로 본다.

| 기록 | 뜻 |
|---|---|
| `seed` | 그림을 정하는 난수 시작값. 같은 프롬프트 + 같은 seed면 같은 그림이 나온다. 이상한 그림을 똑같이 다시 만들어 볼 때 쓴다 |
| `fixes` | 워커가 고친 입력 (5-4). 같은 보정이 자주 보이면 Java 값이나 별칭을 고친다 |
| `queue_wait_sec`, `gen_sec`, `total_sec` | 큐에서 기다린 시간, 생성 시간, 전체 처리 시간 |

### 5-2. 실패 처리

| 상황 | 동작 | 요청 메시지 |
|---|---|---|
| JSON이 깨졌거나 `diaryId`가 없음 | 결과 없이 버림 (로그만) | 삭제 |
| `what`이 없음, 타입이 틀림 | `FAILED` + `INVALID_INPUT` | 삭제 |
| 모르는 값, 사람 단어, 너무 긴 문구 | **보정 후 생성**, `fixes`를 로그에 기록 (5-4) | 정상 처리 |
| SQS에 들어간 지 만료 시간보다 오래됨 | `FAILED` + `EXPIRED` | 삭제 |
| 참조 이미지 다운로드 실패 | `FAILED` + `REF_IMAGE_FAILED` | 삭제 |
| 생성 오류 (메모리 부족 등) | `FAILED` + `GENERATION_FAILED` | 삭제 |
| S3 업로드 오류 | `FAILED` + `UPLOAD_FAILED` | 삭제 |
| CUDA 치명적 오류 (device-side assert 등) | `FAILED` + `GENERATION_FAILED` 후 **프로세스 종료** → `run_worker.sh`가 5초 뒤 재시작 | 삭제 |
| **결과 전송 실패** (결과 큐 오류) | 보낼 수 없음 | **삭제하지 않음** → visibility timeout 뒤 다시 처리 |

- **다시 시도하지 않는다.** 실패하면 바로 Java에 알리고 지운다. 다시 그릴지는 Java(사용자)가 새 요청으로 정한다. 같은 요청을 계속 다시 받아 같은 오류를 반복하는 일이 없다.
- CUDA 치명적 오류는 GPU 상태가 망가진 것이라 그 프로세스로는 더 그릴 수 없다. 그래서 실패를 알린 뒤 종료하고, 재시작 루프가 모델을 새로 올린다.
- 결과 전송이 안 될 때만 지우지 않는다. 지우면 Java가 결과를 영영 못 받기 때문이다.
- SQS 요청 큐에는 DLQ(최대 수신 5회)도 건다. 결과 전송이 계속 실패하는 메시지를 받아 두는 안전망이다.
- 생성이 visibility timeout에 가까워지면 `ChangeMessageVisibility`로 늘린다. H200에서는 거의 일어나지 않지만, 처리 중인 메시지가 다른 워커에게 다시 가는 것을 막는다.

### 5-3. 중복과 seed

- **같은 결과가 드물게 두 번 갈 수 있다.** 예: 결과를 보낸 직후, 삭제하기 전에 프로세스가 죽은 경우. Java는 같은 `diaryId`의 결과가 또 오면 마지막 것을 쓰면 된다.
- 요청 ID는 SQS가 메시지마다 붙이는 `MessageId`다. 요청에 시도 번호가 없어서 이것으로 요청을 구분한다.
- S3 키와 seed를 요청 ID로 정한다. 같은 요청을 다시 처리하면 같은 파일, 같은 그림이 된다. 같은 일기를 다시 그리면 새 요청이라 **새 파일, 다른 그림**이 된다. 파일 이름이 바뀌므로 앱·CDN 캐시에 옛 그림이 남는 문제도 없다. 이전 그림 파일은 S3에 남는다 (지우려면 수명 주기 규칙).

### 5-4. 프롬프트 조립과 자동 보정

조립 순서는 학습 캡션과 같다.

```
mochi_char[ {characterPrompt}], {emotion}, {메인 활동}, {where}, [with {who}], {빛}, [{소품}], medium shot, {화풍}
```

예: `"at home"`, `"with mom"`, `"cooking"`, `"evening"`, `"happy"` →

```
mochi_char, happy, cooking, home kitchen, with a pale yellow family mochi, warm sunset light through the window,
medium shot, warm children's picture-book illustration, crayon and watercolor textures
```

사용자는 이미 일기를 다 썼다. 값이 이상해서 그림이 안 나오면 안 되므로 **거부하지 않고 고쳐서 그린다.** 고친 내용은 로그의 `fixes`에 남긴다 (빈 값에 기본값을 넣은 것은 남기지 않는다).

| 항목 | 아는 값 | 모르는 값 |
|---|---|---|
| `emotion` | 코드 (`CALM` → `calm`) 또는 별칭 | `neutral` |
| `what` | `, `로 나눈다. 첫 번째는 메인 활동(학습 캡션 문구), 나머지는 소품 (`reading` → `an open book on the table`). 최대 3개 | 영어 문구 그대로 (사용자가 추가한 활동·물건) |
| `where` | 학습 캡션 문구. 활동에 따라 세분 (`home` + `cooking` → `home kitchen`) | 영어 문구 그대로. `beach`·`park` 같은 단어가 있으면 바깥 빛을 씀 |
| `who` | 가족·친구·연인·동료·아이·강아지·고양이·토끼·햄스터 모찌. 종류가 여럿이면 종류마다 1마리 | 친구 모찌 |
| `weather` + `timeOfDay` | 아래 빛 규칙 | 없는 것으로 봄 |

**빛 규칙** (학습 캡션의 날씨 빛 자리에 하나만 들어간다)
- 흐림·비·눈: 학습한 날씨 문구를 쓰고, 저녁·밤이면 시간 표시를 덧붙인다: `rain on the window with soft gray light, at night`
- 맑음이거나 날씨 없음: 시간대 문구를 쓴다 (`warm sunset light`). 시간대도 없으면 맑음 문구나 기본 빛
- 맑은 밤에 `bright sunny daylight`가 들어가지 않게 하려고 맑음은 시간대에 양보한다

**사람이 그려지지 않게 하는 규칙**
- `who`의 사람 단어는 모두 모찌로 바꾼다. `mom`, `dad` → 가족 모찌, `boyfriend` → 연인 모찌. 여럿을 뜻하는 단어(`parents`, `friends`)는 2마리로 그린다. 최대 2마리다.
- 사용자가 추가한 `what`·`where` 문구에서 사람 단어를 뺀다: `at grandma's house` → `house`. 빼고 나서 남는 게 없으면 `where`는 `home`으로 바꾸고, `what`은 `INVALID_INPUT`이다.
- 쉼표는 캡션 항목 구분자라서 `where` 문구 안의 쉼표는 `and`로 바꾼다 (`what`은 쉼표로 활동을 나눈다). 문구는 60자까지만 쓴다.
- Java는 태그를 GMS 프롬프트([TAG_TRANSLATION_RULES.md](TAG_TRANSLATION_RULES.md))로 매번 번역해서 보낸다. 프롬프트 용어집의 영어는 `test_default_tags_from_translation_doc`이 모두 알아보는지 확인한다.
- 학습하지 않은 기본 태그(낮잠, 베이킹 등 활동 12개, 도서관·동네·바다·산, 토끼·햄스터, 바람·안개)는 규칙에 넣었지만 그림은 아직 시험하지 않았다.

**지금은 하지 않는 것**
- 활동 × 장소 조합 검사 (예: 여행지에서 요리). 일기에 쓴 대로 그린다.
- 구도 선택. 항상 `medium shot`이다.
- 한줄일기 디테일. 요청에 없다 (내 태그의 물건은 `what` 뒤쪽 소품으로 온다).

### 5-5. 자주 바뀔 값

별칭, 금지어, 시간대 빛은 모두 `worker/prompt_rules.yaml`에 있다. Java가 보내는 값이 늘어나면 (예: 새 장소 라벨) 코드를 고치지 않고 그 파일의 `aliases`에 추가한다.

### 5-6. 종료

`Ctrl+C`(SIGINT)나 SIGTERM을 받으면 **처리 중인 1건을 끝낸 뒤** 종료한다. 받기 대기(long polling) 중이면 바로 종료한다. 코드를 바꿀 때 작업이 중간에 끊기지 않게 하기 위해서다.

## 6. 설정

### 6-1. `.env` (비밀값, 커밋하지 않음)

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
REQUEST_QUEUE_URL=https://sqs.ap-northeast-2.amazonaws.com/.../mochi-image-request
RESULT_QUEUE_URL=https://sqs.ap-northeast-2.amazonaws.com/.../mochi-image-result
S3_BUCKET=...
IMAGE_BASE_URL=                      # 결과 imageUrl 앞부분 (CloudFront 등). 비우면 S3 기본 주소
HF_HUB_OFFLINE=1
```

### 6-2. `config.yaml` (커밋함)

```yaml
model:
  repo: black-forest-labs/FLUX.2-klein-4B
  lora: weights/20261023_train_qfloat8_r16.safetensors
  dtype: bf16
generate:
  size: 768
  steps: 4
  guidance: 1.0
  ref_side: 768            # 참조 이미지를 이 크기 이하로 줄임 (1024 비교 예정)
  idle_release_sec: 300    # 요청 없이 5분이면 모델을 GPU → CPU 로 내림 (0: 계속 올려 둠)
output:
  prefix: diary            # S3 키: diary/{userId}/{diaryId}/{요청 ID 12자}.png
  test_prefix: test-diary  # test: true 요청은 test-diary/{userId}/{diaryId}/... 에 저장
job:
  expire_sec: 600          # 임시값. SQS에 들어간 뒤 이만큼 지나면 EXPIRED (9장)
sqs:
  wait_sec: 20
  visibility_sec: 120
```

## 7. 실행과 운영

```bash
cd ~/ai_server
cp .env.example .env && vi .env      # 처음 한 번

bash start_worker.sh 0                # 0: 배정받은 GPU 번호. 매일 로그인 후 한 번
```

- `start_worker.sh`: tmux 세션 `worker`가 없으면 그 안에 `run_worker.sh 0`을 띄운다. 이미 있으면 그대로 둔다.
- `run_worker.sh`: `python -m worker --gpu 0`을 띄우고, 끝나면 5초 뒤 다시 띄운다.
- 워커는 `CUDA_DEVICE_ORDER=PCI_BUS_ID`, `CUDA_VISIBLE_DEVICES=0`을 torch를 불러오기 전에 정한다. `--gpu`가 없으면 실행되지 않는다.

| 할 일 | 방법 |
|---|---|
| 로그 보기 | `tail -f logs/worker_gpu0.log` |
| 배정 GPU에서 도는지 확인 | `nvidia-smi` 하단 Processes의 PID → `ps -ef \| grep PID`로 우리 계정인지 |
| 코드 바꾸기 | 새 파일을 올린 뒤 워커 창에서 `Ctrl+C` → 재시작 루프가 새 코드로 다시 띄움 |
| 완전히 멈추기 | `Ctrl+C` 두 번 (워커 종료 + 재시작 루프 종료) |
| 다시 붙기 | `tmux attach -t worker` |
| 남은 프로세스 정리 | `ps -ef \| grep 계정명` → `kill -9 PID` |

- **Jupyter 세션은 24시간이 지나면 끝나고, tmux 안의 워커도 같이 종료된다** (서버 규정). **매일 로그인해서 `bash start_worker.sh 0`을 실행한다.** 꺼져 있던 동안의 요청은 큐에 남아 있다가 다시 뜨면 처리되고, 10분(`expire_sec`)이 지난 것은 `EXPIRED`로 돌려준다.
- 서버가 재부팅되어도 직접 다시 띄워야 한다.
- 워커가 살아 있는지는 지금은 로그와 결과 큐로만 확인한다. 외부에서 상태를 봐야 하면 heartbeat(예: 1분마다 결과 큐나 CloudWatch로)를 나중에 추가한다.

## 8. AWS 준비 (인프라 담당과 함께)

| 항목 | 설정 |
|---|---|
| 요청 큐 `mochi-image-request` | 표준 큐, visibility timeout 120초, 메시지 보관 1일, DLQ 연결 (최대 수신 5회) |
| 결과 큐 `mochi-image-result` | 표준 큐 |
| DLQ `mochi-image-request-dlq` | 사람이 확인 |
| GPU 서버용 IAM 사용자 | 요청 큐: `ReceiveMessage`, `DeleteMessage`, `ChangeMessageVisibility`, `GetQueueAttributes` / 결과 큐: `SendMessage` / S3: `PutObject` (`diary/*`, `test-diary/*`만) |

큐 이름은 예시다. 표준 큐는 같은 메시지가 드물게 두 번 올 수 있지만, 5-3의 중복 처리로 충분하므로 FIFO는 쓰지 않는다.

## 9. 정할 것

| # | 항목 | 제안 |
|---|---|---|
| ① | 결과에 `errorCode`, `errorMessage` 추가 | Java와 확인. 실패 이유를 알려 준다 (4-2) |
| ② | 결과에 `userId` 추가 | Java와 확인 (요청에 있는 값을 그대로 돌려줌) |
| ③ | `imageUrl`로 앱에서 바로 열 수 있는지 | 버킷 공개 범위·CloudFront 여부를 인프라 담당과 확인 (4-2) |
| ④ | `who`·`where`를 영어 문장 대신 코드로 받을지 | 지금은 영어 문장(`with mom`)을 별칭으로 맞춘다. 별칭에 없는 표현이 자주 보이면 Java가 코드로 보내는 편이 안전하다 |
| ⑤ | 참조 이미지가 기본 이미지 1장 | 원본의 표정·효과(오라, 반짝이)가 일기 그림으로 번지는지 서버에서 시험 |
| ⑥ | 사용자 추가 활동·장소 | 영어 문구 그대로 넣는다. 아직 시험하지 않았다 |
| ⑦ | 만료 시간 | 사용자가 그림을 기다릴 수 있는 시간 (임시 600초) |
| ⑧ | 24시간 세션 제한 | 운영 쪽에 상시 실행이 가능한지 묻는다. 안 되면 **매일 로그인해서 다시 띄운다** (정함). 담당자를 정한다 |

## 10. 만드는 순서

1. **`engine.py`**: `smoke_generate.py`의 로딩·생성 코드를 옮긴다. smoke 시험에서 장당 시간과 VRAM을 확인한다.
2. **`messages.py`, `prompt.py` + 테스트**: GPU 없이 노트북에서 만든다. `prompt_builder`를 옮기고 자동 보정을 넣는다.
3. **`sqs.py`, `s3.py`, `loop.py` + `send_test_job.py`**: 가짜 engine으로 노트북에서 SQS → S3 → SQS 전체 흐름을 확인한다.
4. **서버 배포**: 진짜 engine으로 배정 GPU 0에서 돌리고, 요청을 넣어 그림·시간을 보고, `nvidia-smi`로 GPU 0에 우리 프로세스가 있는지, 5분 쉰 뒤 약 0.5GB로 줄어드는지 본다.
