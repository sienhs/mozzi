# 인증 · 회원

## 로그인 흐름

```
앱: Google Credential Manager로 ID 토큰 받기
 └─ POST /auth/google
      ├─ LOGIN_SUCCESS   → 토큰 저장 → 홈
      └─ SIGNUP_REQUIRED → A-02 닉네임 입력
                            └─ POST /auth/signup → 토큰 저장 → 홈
```

회원당 로그인 세션은 하나다. 다른 기기에서 로그인하면 기존 기기는 다음 요청에서 `401 SESSION_REVOKED`를 받는다.

## 닉네임 규칙

- 2~10자, 완성형 한글·영문·숫자만. 공백·기호·자모·이모지는 거절한다 (지우지 않고 400).
- 영문 대소문자는 구분하지 않고 중복 검사한다 (`Alice`와 `alice`는 중복).
- 가입할 때 정하고, 이후 설정에서 바꿀 수 있다 (`PATCH /members/me`).
- 탈퇴한 회원의 닉네임은 다른 사람이 쓸 수 있다.

A-02 입력칸 아래 문구: "2~10자, 나중에 설정에서 바꿀 수 있어요"

## 토큰

| 토큰 | 유효기간 | 비고 |
|---|---|---|
| Access | 30분 | JWT. `Authorization` 헤더로 보낸다 |
| Refresh | 30일 | 재발급할 때마다 새 값으로 바뀌고 기간이 다시 30일로 늘어난다. 이전 값은 즉시 무효 |
| 가입 티켓 | 10분 | `POST /auth/signup`에 한 번만 쓸 수 있다 |

토큰이 담긴 응답에는 `Cache-Control: no-store`가 붙는다.

---

## `POST /auth/google` — Google 로그인

인증: 없음 (Google ID 토큰을 서버가 검증)

ID 토큰은 서버의 Web Client ID를 대상으로 요청해야 한다.

Request

```json
{ "idToken": "eyJhbGciOiJSUzI1NiIs..." }
```

Response `200` — 기존 회원

```json
{
  "status": "LOGIN_SUCCESS",
  "accessToken": "eyJ...",
  "refreshToken": "8c1d2f3e-5b6a-4c7d-9e8f-0a1b2c3d4e5f.Qm9...",
  "accessExpiresAt": "2026-10-27T13:00:00+09:00",
  "refreshExpiresAt": "2026-11-26T12:30:00+09:00"
}
```

Response `200` — 신규 회원. 회원은 아직 만들어지지 않는다.

```json
{
  "status": "SIGNUP_REQUIRED",
  "signupToken": "Yp3k...",
  "signupExpiresAt": "2026-10-27T12:40:00+09:00",
  "maskedEmail": "ha***@gmail.com"
}
```

`maskedEmail`은 A-02 "Google 계정 연결됨" 아래에 그대로 보여 준다. 앞 2자만 남기고 `***`로 가린다.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `GOOGLE_EMAIL_UNAVAILABLE` | 이메일이 확인된 Google 계정으로 다시 로그인 |
| 401 | `GOOGLE_TOKEN_INVALID` | E-06. Google 로그인 재시도 |

## `POST /auth/signup` — 회원 가입 (A-02 "시작하기")

인증: 없음 (가입 티켓 검증)

Request

```json
{
  "signupToken": "Yp3k...",
  "nickname": "하루",
  "agreedTerms": [
    { "type": "TERMS", "version": "1.0" },
    { "type": "PRIVACY", "version": "1.0" }
  ]
}
```

- `nickname`: [닉네임 규칙](#닉네임-규칙)을 따른다.
- `agreedTerms`: `TERMS`, `PRIVACY`를 서버의 현재 버전(`1.0`)으로 모두 보낸다.
- 닉네임 오류로 실패하면 티켓은 그대로 남는다. 같은 티켓으로 다른 닉네임을 보내면 된다.

Response `201` — 토큰 묶음 (`POST /auth/refresh` 응답과 같은 형태)

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 닉네임 형식 오류 (`fieldErrors`) |
| 400 | `TERMS_AGREEMENT_REQUIRED` | 약관 동의 다시 표시 |
| 401 | `SIGNUP_TOKEN_INVALID`, `SIGNUP_TOKEN_EXPIRED` | Google 로그인부터 다시 |
| 409 | `NICKNAME_DUPLICATED` | 닉네임 재입력 (티켓 유지) |
| 409 | `ACCOUNT_ALREADY_REGISTERED` | Google 로그인으로 전환 |

## `POST /auth/refresh` — 토큰 재발급

인증: 없음 (Refresh 토큰 검증). 만료된 Access 토큰은 보내지 않아도 된다.

Request

```json
{ "refreshToken": "8c1d....Qm9..." }
```

Response `200`

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "8c1d....Zx7...",
  "accessExpiresAt": "2026-10-27T13:30:00+09:00",
  "refreshExpiresAt": "2026-11-26T13:00:00+09:00"
}
```

같은 Refresh 토큰으로 동시에 요청하면 하나만 성공한다. 앱은 재발급 요청을 한 번에 하나만 보내야 한다.

| HTTP | code | 처리 |
|---|---|---|
| 401 | `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_EXPIRED` | 토큰 삭제 후 로그인 화면 |

## `POST /auth/logout` — 로그아웃 (SET-02)

본문 없음. Response `204`.
요청한 Access 토큰의 세션만 종료한다. 기록은 그대로 남는다.

## `GET /members/me` — 내 정보 (SET-01 프로필)

Response `200`

```json
{ "memberId": 1, "email": "haru@gmail.com", "nickname": "하루", "provider": "GOOGLE" }
```

SET-01 "haru@gmail.com · Google"은 `email`과 `provider`로 그린다.

## `PATCH /members/me` — 닉네임 변경

Request

```json
{ "nickname": "모찌랑" }
```

Response `200` — `GET /members/me`와 같은 본문.

| HTTP | code | 처리 |
|---|---|---|
| 400 | `INVALID_INPUT` | 닉네임 형식 오류 (`fieldErrors`) |
| 409 | `NICKNAME_DUPLICATED` | 닉네임 재입력 |

## `DELETE /members/me` — 회원 탈퇴

본문 없음. Response `204`.

- 세션을 종료하고 회원을 소프트 삭제한다.
- 같은 Google 계정으로 바로 다시 가입할 수 있다. 새 회원 ID가 부여되고 이전 데이터는 연결되지 않는다.

---

## `GET /members/me/settings` · `PATCH /members/me/settings` — 기록 알림 (SET-01)

Response `200` / PATCH Request (바꿀 필드만)

```json
{ "reminderEnabled": true, "reminderTime": "21:00" }
```

PATCH Response `200` — 변경 후 전체 설정.
"그림 저장 위치(앨범)"는 기기 설정이라 서버에 두지 않는다.

## `PUT /members/me/push-tokens` — 푸시 토큰 등록

앱 시작·로그인 때마다 호출한다. 같은 `deviceId`면 덮어쓴다.

```json
{ "token": "fcm-token...", "platform": "ANDROID", "deviceId": "uuid" }
```

| 필드 | 설명 |
|---|---|
| `token` | FCM 등록 토큰. 최대 512자 |
| `platform` | `ANDROID`, `IOS` |
| `deviceId` | 앱이 처음 실행될 때 만들어 계속 쓰는 UUID. 최대 64자 |

Response `204`. 기록 알림과 "그림 완성" 알림에 쓴다.

- 푸시는 **마지막으로 등록한 기기 하나**에만 간다. 회원당 세션이 하나라서 다른 기기는 이미 로그아웃된 상태이기 때문이다. 다른 기기의 토큰은 등록할 때 비활성화된다.
- 다른 회원이 같은 토큰으로 등록하면(한 폰에서 계정을 바꾼 경우) 이전 회원 쪽 토큰은 비활성화된다.
- 로그아웃하면 토큰이 비활성화되고, 탈퇴하면 삭제된다.
- 앱은 Expo push token이 아니라 FCM 토큰(`getDevicePushTokenAsync`)을 보내야 한다.

---

## 서버 설정

| 환경 변수 | 설명 |
|---|---|
| `AUTH_JWT_SECRET` | Access 토큰 서명 키. 32바이트 이상 (`openssl rand -base64 48`). prod 필수 |
| `GOOGLE_CLIENT_IDS` | Google Cloud Console의 Web 애플리케이션 OAuth Client ID. 여러 개면 쉼표로 구분. prod 필수 |

local 프로파일은 기본값이 있어 설정 없이 뜬다. 실제 Google 로그인을 로컬에서 하려면 `GOOGLE_CLIENT_IDS`만 실제 값으로 넣는다.
