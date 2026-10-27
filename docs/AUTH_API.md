# 인증 · 회원 API 명세 (S15P31D102-88)

Google 소셜 로그인 구현 기준. 모든 경로의 앞에는 `/api/v1` 이 붙는다.
성공 응답은 공통 래퍼 없이 리소스를 그대로 반환하고, 에러는 `{code, message, fieldErrors, traceId}` 형식이다.

## 1. API 목록

| 메서드 | URL | 기능 | 인증 |
|---|---|---|---|
| POST | `/api/v1/auth/google` | Google 로그인. 기존 회원은 토큰 발급, 신규 회원은 가입 티켓 발급 | 없음 (Google ID 토큰 검증) |
| POST | `/api/v1/auth/signup` | 닉네임과 약관 동의를 받아 회원 가입 후 토큰 발급 | 없음 (가입 티켓 검증) |
| POST | `/api/v1/auth/refresh` | Refresh 토큰으로 Access/Refresh 토큰 재발급 | 없음 (Refresh 토큰 검증) |
| POST | `/api/v1/auth/logout` | 로그아웃 (현재 세션 종료) | Access 토큰 |
| GET | `/api/v1/members/me` | 내 정보 조회 (회원 ID, 이메일, 닉네임) | Access 토큰 |
| DELETE | `/api/v1/members/me` | 회원 탈퇴 (세션 종료 후 소프트 삭제) | Access 토큰 |

- 인증이 필요한 API는 `Authorization: Bearer <accessToken>` 헤더를 보낸다.
- 인증 없이 호출되는 경로는 위 3개 POST 와 헬스 체크(`GET /actuator/health`, `/liveness`, `/readiness`)뿐이다. 나머지 API(일기 포함)는 모두 Access 토큰이 필요하다.
- 토큰이 담긴 응답에는 `Cache-Control: no-store` 가 붙는다.

## 2. 상세

### 2.1 Google 로그인 — `POST /auth/google`

Android Credential Manager 로 받은 Google ID 토큰(서버용 Web Client ID 대상)을 보낸다.

```json
{ "idToken": "eyJhbGciOiJSUzI1NiIs..." }
```

**기존 회원 (200)** — 기존 세션은 교체되어 다른 기기는 다음 요청에서 `SESSION_REVOKED` 를 받는다.

```json
{
  "status": "LOGIN_SUCCESS",
  "accessToken": "eyJ...",
  "refreshToken": "8c1d2f3e-5b6a-4c7d-9e8f-0a1b2c3d4e5f.Qm9...",
  "accessExpiresAt": "2026-10-27T13:00:00+09:00",
  "refreshExpiresAt": "2026-11-26T12:30:00+09:00"
}
```

**신규 회원 (200)** — 회원은 아직 생성되지 않는다. 앱은 닉네임 입력 화면으로 이동한다.

```json
{
  "status": "SIGNUP_REQUIRED",
  "signupToken": "Yp3k...",
  "signupExpiresAt": "2026-10-27T12:40:00+09:00"
}
```

### 2.2 회원 가입 — `POST /auth/signup` (201)

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

- 닉네임: 2~12자, 완성형 한글·영문·숫자만 허용. 영문 대소문자를 구분하지 않고 중복을 검사한다(`Alice` 와 `alice` 는 중복). 가입 후 변경할 수 없다.
- 약관: `TERMS`, `PRIVACY` 를 서버의 현재 버전(`mozzi.terms.current-versions`, 현재 `1.0`)으로 모두 보내야 한다.
- 가입 티켓은 10분 동안 유효하고 한 번만 쓸 수 있다. 닉네임 중복·형식 오류로 실패하면 티켓은 그대로 남아 다른 닉네임으로 다시 시도할 수 있다.
- 응답은 2.3 의 토큰 응답과 같다.

### 2.3 토큰 재발급 — `POST /auth/refresh` (200)

```json
{ "refreshToken": "8c1d....Qm9..." }
```

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "8c1d....Zx7...",
  "accessExpiresAt": "2026-10-27T13:30:00+09:00",
  "refreshExpiresAt": "2026-11-26T13:00:00+09:00"
}
```

- 만료된 Access 토큰은 필요 없다. Refresh 토큰만 본문으로 보낸다.
- 성공할 때마다 Refresh 토큰이 새 값으로 바뀌고 만료가 그 시점부터 30일로 연장된다. 이전 Refresh 토큰은 즉시 무효다.
- 같은 Refresh 토큰으로 동시에 요청하면 하나만 성공한다. 앱은 재발급을 한 번만(single flight) 호출해야 한다.

### 2.4 로그아웃 — `POST /auth/logout` (204)

본문 없음. 요청한 Access 토큰의 세션만 종료한다(이미 다른 기기에서 로그인했다면 새 세션은 건드리지 않는다).

### 2.5 내 정보 — `GET /members/me` (200)

```json
{ "memberId": 1, "email": "haru@gmail.com", "nickname": "하루" }
```

### 2.6 회원 탈퇴 — `DELETE /members/me` (204)

세션을 종료하고 회원을 소프트 삭제한다. 같은 Google 계정으로 바로 다시 가입할 수 있으며 새 회원 ID 가 부여된다(이전 데이터는 연결되지 않는다). 탈퇴한 회원의 닉네임은 다른 사람이 쓸 수 있다.

## 3. 토큰 정책

| 토큰 | 형식 | 유효기간 | 비고 |
|---|---|---|---|
| Access | JWT (HS256) | 30분 | 클레임: `sub`(회원 ID), `sid`(세션 ID), `iss`, `aud`, `iat`, `exp`, `jti`, `token_use` |
| Refresh | `<sessionId>.<난수>` | 30일 (재발급 시 연장) | 서버는 SHA-256 해시만 저장 |
| 가입 티켓 | 난수 | 10분 | 1회용, 서버는 해시만 저장 |

회원당 로그인 세션은 하나다. 모든 인증 요청에서 서버가 현재 세션인지 DB 로 확인한다.

## 4. 에러 코드

| HTTP | code | 발생 위치 | 앱 처리 |
|---|---|---|---|
| 400 | `INVALID_INPUT` | 전체 | 입력 오류 표시 (`fieldErrors` 참고) |
| 400 | `GOOGLE_EMAIL_UNAVAILABLE` | `/auth/google` | 이메일이 확인된 Google 계정으로 다시 로그인 |
| 400 | `TERMS_AGREEMENT_REQUIRED` | `/auth/signup` | 약관 동의 화면 다시 표시 |
| 401 | `GOOGLE_TOKEN_INVALID` | `/auth/google` | Google 로그인 재시도 |
| 401 | `ACCESS_TOKEN_MISSING` | 인증 API | 로그인 필요 |
| 401 | `ACCESS_TOKEN_INVALID` | 인증 API | 로그인 필요. 재발급하지 않음 |
| 401 | `ACCESS_TOKEN_EXPIRED` | 인증 API | **이 코드일 때만** 재발급 후 원 요청 1회 재시도 |
| 401 | `SESSION_REVOKED` | 인증 API | 토큰 삭제 후 로그인 화면 ("다른 곳에서 로그인되어 로그아웃되었어요.") |
| 401 | `REFRESH_TOKEN_INVALID` / `REFRESH_TOKEN_EXPIRED` | `/auth/refresh` | 토큰 삭제 후 로그인 화면 |
| 401 | `SIGNUP_TOKEN_INVALID` / `SIGNUP_TOKEN_EXPIRED` | `/auth/signup` | Google 로그인부터 다시 |
| 409 | `NICKNAME_DUPLICATED` | `/auth/signup` | 닉네임 재입력 (티켓 유지) |
| 409 | `ACCOUNT_ALREADY_REGISTERED` | `/auth/signup` | Google 로그인으로 전환 |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | 전체 | 일시 장애 안내. **토큰을 삭제하지 않는다** |

## 5. 환경 변수

| 변수 | 필수 | 설명 | 예시 / 생성 방법 |
|---|---|---|---|
| `AUTH_JWT_SECRET` | prod 필수 | Access 토큰 서명 키 (HS256). **32바이트 이상**, 저장소에 커밋 금지 | `openssl rand -base64 48` |
| `GOOGLE_CLIENT_IDS` | prod 필수 | Google Cloud Console 의 **Web 애플리케이션** OAuth Client ID. 앱이 이 ID 를 대상으로 ID 토큰을 요청해야 한다. 여러 개면 쉼표로 구분 | `1234-abc.apps.googleusercontent.com` |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | prod 필수 | 기존 값. 변경 없음 | |
| `SPRING_PROFILES_ACTIVE` | jar 실행 시 필수 | 기존 값. `local` 또는 `prod` | |

- **local 프로파일**은 두 값 모두 기본값이 있어 설정 없이 서버가 뜬다. 단, 실제 Google 로그인을 로컬에서 하려면 `GOOGLE_CLIENT_IDS` 에 실제 Web Client ID 를 넣어야 한다.
- **prod 프로파일**은 기본값이 없어 값이 없으면 기동이 실패한다. k8s Secret 으로 주입한다.
- 설정 파일에 고정된 값(필요 시 `application.yml` 에서 변경): Access 30분, Refresh 30일, 가입 티켓 10분, JWT `iss=mozzi`, `aud=mozzi-app`, 약관 버전 `TERMS=1.0`, `PRIVACY=1.0`.

## 6. DB 변경 (Flyway)

- `V4__apply_signup_policy_to_member.sql`: 닉네임 12자·NOT NULL, 활성 회원 기준 `lower(nickname)` 와 Google 계정 부분 유니크 인덱스. 규칙에 맞지 않는 기존 데이터(닉네임 없는 회원 등)가 있으면 데이터를 고치지 않고 마이그레이션을 중단한다.
- `V5__replace_refresh_token_with_member_session.sql`: `refresh_token` 테이블 삭제(기존 로그인 무효화), `member_session`·`signup_ticket` 생성.
