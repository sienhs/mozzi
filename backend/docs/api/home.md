# 홈 · 앱 메타

## `GET /home` — 홈 (H-01, H-02, H-03, E-01)

홈의 상태와 화면에 그릴 일기를 한 번에 내려준다.

Response `200`

```json
{
  "today": "2026-10-22",
  "todayStatus": "IMAGE_FAILED",
  "todayDiary": { /* DiaryDetail */ },
  "canRequestImage": true,
  "recentDiary": { /* DiaryDetail */ }
}
```

| 필드 | 설명 |
|---|---|
| `today` | 서버 날짜 (Asia/Seoul). 지금 일기를 쓰면 저장될 날짜. 헤더의 "10월 22일 목요일"도 이걸로 만든다 |
| `todayStatus` | 아래 표 |
| `todayDiary` | 오늘 일기. 아직 안 썼으면 `null` |
| `canRequestImage` | E-01 버튼 노출 여부. 홈을 조회한 시점에 `POST /diaries/{id}/image`가 받아들여질 상태였는지 |
| `recentDiary` | 오늘 이전 가장 최근 일기 1건 (H-01 "지난 기록"). 없으면 `null` |

| `todayStatus` | 화면 | 상황 |
|---|---|---|
| `NOT_RECORDED` | H-01 | 오늘 일기 없음 |
| `IMAGE_NOT_REQUESTED` | E-01 | 일기는 있는데 그림 요청이 아직 없음 |
| `IMAGE_PENDING` | H-03 | 그림 생성 중 |
| `COMPLETED` | H-02 | 그림 완성 |
| `IMAGE_FAILED` | E-01 | 그림 실패 |

- 앱은 일기를 저장하자마자 그림을 요청하므로 `IMAGE_NOT_REQUESTED`는 저장과 그림 요청 사이의 잠깐, 또는 그 요청이 유실됐을 때(저장 직후 앱 종료 등) 생긴다. E-01 레이아웃에 가운데 "다시 보내기" 버튼을 두고, 버튼은 같은 `POST /diaries/{id}/image`를 보낸다. 실패 횟수에는 세지 않는다.
- `canRequestImage`는 아래를 모두 만족할 때 `true`다.
  - 그림이 없거나(`IMAGE_NOT_REQUESTED`), 실패했고 실패가 3번 미만(`IMAGE_FAILED`)
  - 일기에 남은 `WHAT` 아이콘이 있음. 그림 요청에 `whatMyIconId`가 필수인데, 삭제한 아이콘은 일기에서 빠진다
- `canRequestImage`는 조회 시점의 판단이다. 그 사이 자정이 지나면 `400 IMAGE_ONLY_TODAY`, 다른 기기가 먼저 요청하면 `409 IMAGE_ALREADY_REQUESTED`가 올 수 있다. 이 오류를 받거나 날짜가 바뀌면 홈을 다시 조회한다.
- H-03의 진행 바는 앱이 연출한다. 서버는 진행률을 모른다.
- "지난 기록"·H-02의 활동 칩 자리("업무", "휴식 · 가족")는 일기의 아이콘(`myIcons`)으로 그린다.
- [DiaryDetail](diary.md#get-diariesdaily--하루-일기)

## `GET /meta` — 앱 메타

인증: 없음. 앱 시작 시 1회 호출한다.

Response `200`

```json
{
  "termsVersions": { "TERMS": "1.0", "PRIVACY": "1.0" },
  "termsPaths": { "TERMS": "/legal/terms", "PRIVACY": "/legal/privacy" },
  "minSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0"
}
```

| 필드 | 설명 |
|---|---|
| `termsVersions` | 문서별 현재 버전. 회원가입 때 아래처럼 바꿔서 보낸다 |
| `termsPaths` | 문서별 HTML 페이지 경로. 서버 주소 뒤에 붙여 브라우저로 연다(`/api/v1` 아래가 아니다). 인증 없음. 앱이 직접 그릴 때는 [`GET /legal/terms` · `GET /legal/privacy`](#get-legalterms--get-legalprivacy--약관-본문)의 JSON을 쓴다 |
| `minSupportedVersion` | 앱 버전이 이보다 낮으면 업데이트 안내 화면으로 막고 스토어로 보낸다 (강제 업데이트) |
| `latestVersion` | 앱 버전이 이보다 낮으면 업데이트를 권하되 계속 쓸 수 있다 |

`POST /auth/signup`의 `agreedTerms`는 객체가 아니라 배열이다.

```json
{
  "agreedTerms": [
    { "type": "TERMS", "version": "1.0" },
    { "type": "PRIVACY", "version": "1.0" }
  ]
}
```

- 버전은 `major.minor.patch` 형식이고 앞자리 0은 쓰지 않는다(`01.0.0` 불가). 세 자리를 각각 숫자로 비교한다(`1.10.0` > `1.9.0`). 강제 업데이트 확인을 먼저 한다.
- 서버 설정 `mozzi.app.*`(환경변수 `MOZZI_APP_MIN_SUPPORTED_VERSION`, `MOZZI_APP_LATEST_VERSION`)으로 바꾼다. 최소 버전이 최신 버전보다 높으면 서버가 뜨지 않는다.
- 강제 업데이트는 이 확인 로직을 넣고 출시한 앱에만 효과가 있다.

## `GET /legal/terms` · `GET /legal/privacy` — 약관 본문

인증: 없음. 가입 전에도 읽는다. 앱 내장본(`assets/legal/*.json`)과 같은 모양에 `type`, `version`을 더했다.

Response `200`

```json
{
  "type": "TERMS",
  "version": "1.0",
  "title": "이용약관",
  "body": "# 이용약관\n\n이 이용약관은 ..."
}
```

| 필드 | 설명 |
|---|---|
| `type` | `TERMS` 이용약관 · `PRIVACY` 개인정보 처리방침 |
| `version` | 가입 때 `agreedTerms`로 보낼 버전. `GET /meta`의 `termsVersions`와 같다 |
| `title` | 문서 제목 |
| `body` | 마크다운 원문. 제목(`# `)부터 들어 있고, 개인정보 처리방침에는 표가 있다 |

- 원본은 `docs/legal/TERMS.md`, `PRIVACY.md`다. 서버가 시작할 때 읽으므로 문구를 고치면 배포해야 바뀐다.
- `Cache-Control: public, max-age=3600`. 배포 후 최대 1시간은 이전 문구가 보일 수 있다.
- 같은 본문을 브라우저용 HTML 페이지로도 연다: `/legal/terms`, `/legal/privacy` (`/api/v1` 없이). Google Play의 개인정보 처리방침 URL로 쓴다.
