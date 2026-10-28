# 오늘의 모찌 API

기준 화면: Figma `목업_모찌의 기록실` (A·H·R·G·C·D·S·SET·E·P 시리즈)

| 문서 | 내용 |
|---|---|
| [api/common.md](api/common.md) | Base URL, 인증 헤더, 응답·오류 형식, 공통 오류 코드, Enum |
| [api/auth.md](api/auth.md) | 인증, 회원, 설정, 푸시 토큰 |
| [api/diary.md](api/diary.md) | 일기 CRUD, 그림 생성 |
| [api/home.md](api/home.md) | 홈, 캘린더, 앱 메타 |
| [api/emotion-search.md](api/emotion-search.md) | 감정 검색 |
| [api/gacha.md](api/gacha.md) | 모찌 뽑기, 도감, 조각 교환 |

테이블 구조는 [erd.md](erd.md)에 있다.

로컬 확인은 Swagger UI(`http://localhost:8080/swagger-ui.html`, prod 비활성)나 `backend/http/*.http` 파일을 쓴다.

## 진행 현황

구현을 마치면 체크하고, 명세와 달라진 점은 해당 상세 문서에 반영한다.

### 인증 · 회원

- [x] `POST /auth/google` Google 로그인 — `maskedEmail` 미구현
- [x] `POST /auth/signup` 회원 가입 — 닉네임 2~10자 미반영 (현재 2~12자)
- [x] `POST /auth/refresh` 토큰 재발급
- [x] `POST /auth/logout` 로그아웃
- [x] `GET /members/me` 내 정보 — `provider` 미구현
- [ ] `PATCH /members/me` 닉네임 변경
- [x] `DELETE /members/me` 회원 탈퇴
- [ ] `GET /members/me/settings` 알림 설정 조회
- [ ] `PATCH /members/me/settings` 알림 설정 변경
- [ ] `PUT /members/me/push-tokens` 푸시 토큰 등록

### 일기

- [x] `POST /diaries` 일기 작성 — 멱등 재전송 응답, `reward` 미구현
- [x] `GET /diaries/{diaryId}` 일기 상세
- [x] `GET /diaries` 일기 목록
- [x] `PATCH /diaries/{diaryId}` 일기 수정 — 목업 화면 없음 (와이어프레임 v2 C-03)
- [x] `DELETE /diaries/{diaryId}` 일기 삭제 — 목업 화면 없음 (와이어프레임 v2 C-04)

### 그림 생성

- [ ] 생성 워커 연동 (큐 미정, 현재 `PENDING`에서 진행되지 않음)
- [ ] S3 presigned URL 발급 (현재 `imageUrl`은 항상 `null`)
- [ ] `GET /diaries/{diaryId}/image` 생성 상태 조회
- [ ] `POST /diaries/{diaryId}/image/retry` 다시 그리기

### 홈 · 캘린더 · 메타

- [ ] `GET /home` 홈
- [ ] `GET /calendar` 월간 캘린더
- [ ] `GET /meta` 앱 메타

### 감정 검색

- [x] `GET /emotion-search/suggestions` 추천 질문
- [x] `POST /emotion-search` 질문하기

### 모찌 뽑기

- [ ] `GET /gacha/status` 뽑기 홈
- [ ] `GET /gacha/rates` 등급별 확률
- [ ] `POST /gacha/draws` 뽑기 (1장 / 10장)
- [ ] `GET /gacha/collection` 도감
- [ ] `POST /gacha/collection/seen` NEW 표시 지우기
- [ ] `POST /gacha/exchanges` 조각으로 교환

### 공통

- [ ] `Idempotency-Key` 재전송 시 첫 응답 재사용 (현재는 헤더 검증만)
- [ ] 호출 제한 (`429 RATE_LIMITED`)

## 화면별 API

| 화면 | API |
|---|---|
| A-01 시작, E-06 로그인 실패 | `POST /auth/google` |
| A-02 Google 첫 로그인 | `POST /auth/google` 응답의 `maskedEmail`, `POST /auth/signup` |
| H-01 · H-02 · H-03 홈, E-01 생성 실패 | `GET /home`, 생성 중이면 `GET /diaries/{id}/image` 폴링 |
| R-01 기분 선택, R-02 활동·메모 | `GET /meta` (칩 목록) |
| R-03 저장 중, E-02 저장 실패 | `POST /diaries` |
| G-01 그림 생성 중 | `GET /diaries/{id}/image` 폴링 |
| G-02 생성 완료, D-01 기록 상세 | `GET /diaries/{id}` |
| E-03 그림 생성 실패 | `POST /diaries/{id}/image/retry` |
| C-01 캘린더, C-02 빈 날짜 | `GET /calendar` |
| S-01 감정 검색 시작 | `GET /emotion-search/suggestions` |
| S-02 답변, E-04 빈 결과, E-05 실패 | `POST /emotion-search` |
| SET-01 설정 | `GET /members/me`, `PATCH /members/me`, `GET · PATCH /members/me/settings` |
| SET-02 로그아웃 확인 | `POST /auth/logout` |
| 회원 탈퇴 | `DELETE /members/me` |
| P-01 뽑기 홈 | `GET /gacha/status` |
| P-05 확률 정보 | `GET /gacha/rates` |
| P-02 · P-03 · P-04 개봉 · 결과, P-12 중복, P-11 실패 | `POST /gacha/draws` |
| P-06 도감, P-07 모찌 상세 | `GET /gacha/collection`, `POST /gacha/collection/seen` |
| P-08 · P-09 · P-13 조각 교환 | `GET /gacha/collection`, `POST /gacha/exchanges` |

## 결정이 필요한 항목

명세는 Figma를 기준으로 한다. 아래는 Figma만으로 정할 수 없는 것들이다.

| # | 항목 | 현재 상태 |
|---|---|---|
| 1 | 조각 이름 | Figma에 "별조각"과 "빛조각"이 섞여 있음. API 필드는 `shard`로 두고 문구만 정하면 됨 |
| 2 | 뽑기권 지급량 | 초안은 기록 1건에 1장. 10장 뽑기(뽑기권 10장)가 있으니 지급량 재검토 필요. 날짜당 1번만 지급(삭제 후 재작성 시 미지급)은 확정 |
| 3 | 닉네임 변경 화면 | A-02는 "설정에서 바꿀 수 있어요"라고 안내하지만 목업에 변경 화면이 없음. SET-01 프로필 행에서 진입하는 화면 필요 |
| 4 | 그림 재시도 횟수 | 초안은 실패 시 하루 3회 |
| 5 | 감정 검색 질문 보관 기간 | 90일로 구현(`ExpiredEmotionSearchCleaner`, 매일 04:40). 처리방침 7조에 아직 없음 |
| 6 | 만 14세 미만 가입 | 받지 않는다면 약관에 명시 |
