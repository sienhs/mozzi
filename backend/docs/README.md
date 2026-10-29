# 오늘의 모찌 API

기준 화면: Figma `목업_모찌의 기록실` (A·H·R·G·C·D·S·SET·E·P 시리즈)

| 문서 | 내용 |
|---|---|
| [api/common.md](api/common.md) | Base URL, 인증 헤더, 응답·오류 형식, 공통 오류 코드, Enum |
| [api/auth.md](api/auth.md) | 인증, 회원, 설정, 푸시 토큰 |
| [api/diary.md](api/diary.md) | 이모티콘, 아이콘, 일기, 그림 생성 |
| [api/home.md](api/home.md) | 홈, 앱 메타 |
| [api/emotion-search.md](api/emotion-search.md) | 감정 검색 |
| [api/gacha.md](api/gacha.md) | 모찌 뽑기, 도감, 별조각 교환, 뽑기권 지급 |

테이블 구조는 [erd.md](erd.md)에 있다.

로컬 확인은 Swagger UI(`http://localhost:8080/swagger-ui.html`, prod 비활성)나 `backend/http/*.http` 파일을 쓴다.

## 진행 현황

구현을 마치면 체크하고, 명세와 달라진 점은 해당 상세 문서에 반영한다.

### 인증 · 회원

- [x] `POST /auth/google` Google 로그인 — `maskedEmail` 미구현
- [x] `POST /auth/signup` 회원 가입 — 닉네임 2~10자 미반영 (현재 2~12자)
- [x] `POST /auth/refresh` 토큰 재발급
- [x] `POST /auth/logout` 로그아웃
- [x] `GET /members/me` 내 정보
- [x] ~~`PATCH /members/me` 닉네임 변경~~ — 제공하지 않음. 닉네임은 가입 후 바꿀 수 없다
- [x] `DELETE /members/me` 회원 탈퇴
- [x] ~~`GET · PATCH /members/me/settings` 알림 설정~~ — 기록 알림을 제공하지 않아 V10에서 `member_setting` 삭제
- [x] `PUT /members/me/push-tokens` 푸시 토큰 등록
- [x] `GET /legal/terms` · `GET /legal/privacy` 약관 본문 JSON(마크다운) — 인증 없음
- [x] `/legal/terms` · `/legal/privacy` 약관 HTML 페이지 — `/api/v1` 밖, 인증 없음. 스토어 등록용

### 일기 · 아이콘 (S15P31D102-110에서 재설계)

- [x] `GET /emoticons` 이모티콘 목록 — 이모티콘 데이터는 서버가 따로 등록 (마이그레이션에 없음)
- [x] ~~`GET /icons` 기본 이미지 목록~~ — V9에서 삭제. 아이콘은 글자만 쓴다
- [x] `POST /my-icons` 아이콘 만들기
- [x] `GET /my-icons` 내 아이콘 목록
- [x] `DELETE /my-icons/{myIconId}` 아이콘 삭제
- [x] `POST /diaries` 일기 쓰기
- [x] `PATCH /diaries/{diaryId}/content` 한 줄 일기 추가 — 비어 있는 일기에 한 번만
- [x] `GET /diaries/daily` 하루 일기
- [x] `GET /diaries/monthly` 한 달 감정 (캘린더)
- [x] `GET /diaries` 일기 목록

일기 수정·삭제는 없다 (재설계에서 제외).

### 그림 생성

- [x] `POST /diaries/{diaryId}/image` 그림 만들기 — 당일 일기만. 캐릭터 테이블 전까지 기본 캐릭터 사용
- [x] `POST /diaries/{diaryId}/image/test` [테스트·임시] 제한 없이 그림 만들기 — 테스트 후 삭제
- [x] GMS 번역 → SQS `ai-request` 발행, `ai-response` 수신 — 실제 AWS 큐로는 아직 검증 안 함 (테스트는 큐 없이 실행)
- [x] 그림 결과 FCM 푸시 (성공·실패) — SSE는 제거. 실제 Firebase 키로는 아직 검증 안 함

### 홈 · 메타

- [x] `GET /home` 홈 — 지난 기록은 1건, 뽑기권은 홈에 없음
- [x] `GET /meta` 앱 메타 — 약관 버전, 강제·권장 업데이트 버전

월간 캘린더(`GET /calendar`)는 `GET /diaries/monthly`로 대체했다.

### 감정 검색

- [x] `GET /emotion-search/suggestions` 추천 질문
- [x] `POST /emotion-search` 질문하기

### 모찌 뽑기

- [x] `GET /gacha/status` 뽑기 홈
- [x] `GET /gacha/rates` 등급별 확률
- [x] `POST /gacha/draws` 뽑기 (1~10장)
- [x] `GET /gacha/collection` 도감
- [x] `POST /gacha/collection/seen` NEW 표시 지우기
- [x] `POST /gacha/exchanges` 별조각으로 교환
- [x] `POST /rewards/daily-login` 매일 접속 보상 (뽑기권 10)
- [x] 가입 보상 (`POST /auth/signup`, 뽑기권 20), 일기 작성 보상 (`POST /diaries`의 `reward`, 뽑기권 10)
- [x] 회원 탈퇴 시 뽑기 데이터 파기

시즌제는 없다. 뽑기 API에 `seasonId` 파라미터와 `season` 응답 필드가 없다.

### 공통

- [x] `Idempotency-Key` 재전송 시 첫 응답 재사용 — 일기 작성, 다시 그리기, 뽑기, 교환. 지난 기록은 매일 04:50 삭제
- [x] 호출 제한 — 그림 만들기는 당일 일기만(회원당 하루 1장), 실패 시 3번까지 재시도 (`429 RETRY_LIMIT_EXCEEDED`). 감정 검색은 분당 10회 (`429 RATE_LIMITED`). 그 밖의 API에는 걸지 않는다

## 화면별 API

| 화면 | API |
|---|---|
| A-01 시작, E-06 로그인 실패 | `POST /auth/google` |
| A-02 Google 첫 로그인 | `POST /auth/google` 응답의 `maskedEmail`, `POST /auth/signup` |
| H-01 · H-02 · H-03 홈, E-01 홈 생성 실패 | `GET /home` |
| R-01 기분 선택 | `GET /emoticons` |
| R-02 아이콘·한 줄 일기 | `GET /my-icons?category=`, `POST /my-icons`, `DELETE /my-icons/{id}` |
| R-03 저장 중, E-02 저장 실패 | `POST /diaries` |
| G-01 그림 생성 중, E-01 · E-03 생성 실패 | `POST /diaries/{id}/image` 후 FCM 푸시로 결과 수신. 실패 후 다시 그리기도 같은 POST |
| G-02 생성 완료, D-01 기록 상세 | `GET /diaries/daily?date=` |
| C-01 캘린더, C-02 빈 날짜 | `GET /diaries/monthly?yearMonth=` |
| 지난 일기 모아 보기 | `GET /diaries` (감정·기간 필터) |
| S-01 감정 검색 시작 | `GET /emotion-search/suggestions` |
| S-02 답변, E-04 빈 결과, E-05 실패 | `POST /emotion-search` |
| SET-01 설정 | `GET /members/me`, `GET /legal/terms` · `GET /legal/privacy` |
| SET-02 로그아웃 확인 | `POST /auth/logout` |
| 회원 탈퇴 | `DELETE /members/me` |
| P-01 뽑기 홈 | `GET /gacha/status` |
| P-05 확률 정보 | `GET /gacha/rates` |
| P-02 · P-03 · P-04 개봉 · 결과, P-12 중복, P-11 실패 | `POST /gacha/draws` |
| P-06 도감, P-07 모찌 상세 | `GET /gacha/collection`, `POST /gacha/collection/seen` |
| P-08 · P-09 · P-13 별조각 교환 | `GET /gacha/collection`, `POST /gacha/exchanges` |
| 앱 실행 · 포그라운드 진입 (매일 접속 보상 얼럿) | `POST /rewards/daily-login` |

## 결정이 필요한 항목

명세는 Figma를 기준으로 한다. 아래는 Figma만으로 정할 수 없는 것들이다.

| # | 항목 | 현재 상태 |
|---|---|---|
| 1 | 조각 이름 | 확정: "별조각". API 필드는 `shard` |
| 2 | 뽑기권 지급량 | 확정: 가입 20, 매일 접속 10, 일기 작성 10 (날짜당 1번). [gacha.md](api/gacha.md#뽑기권-지급) |
| 3 | 닉네임 변경 화면 | A-02는 "설정에서 바꿀 수 있어요"라고 안내하지만 목업에 변경 화면이 없음. SET-01 프로필 행에서 진입하는 화면 필요 |
| 4 | 캐릭터 | 캐릭터 테이블(이미지 URL, 프롬프트)과 보유 확인. 지금은 설정값의 기본 캐릭터 하나 |
| 5 | 감정 검색 질문 보관 기간 | 90일로 구현(`ExpiredEmotionSearchCleaner`, 매일 04:40). 처리방침 7조에 아직 없음 |
| 6 | 만 14세 미만 가입 | 받지 않는다면 약관에 명시 |
