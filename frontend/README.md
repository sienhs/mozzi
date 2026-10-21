# 오늘의 모찌 프론트엔드

오늘의 모찌 모바일 앱의 Expo + React Native + TypeScript 프로젝트입니다. 현재는 개발 환경과 라이브러리 기본 연결까지 구성되어 있으며, 초기 경로 `/`는 앱 이름만 표시합니다. 로그인, 일기, 캘린더 등 제품 기능은 아직 구현하지 않았습니다. 지원 플랫폼은 Android와 iOS입니다.

## 개발 환경

- 팀 기준: Node.js **24.18.0** (`.node-version`), npm **11.16.0**.
- `package.json`의 허용 Node.js 범위는 `^22.13.0 || ^24.3.0 || >=26.0.0`입니다. 재현성을 위해 팀 기준 버전을 사용합니다.
- 아래 명령은 저장소의 `frontend` 폴더에서 실행합니다. 저장소 루트에서 시작할 때는 먼저 `cd frontend`를 실행합니다.
- Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 `npm.cmd`, `npx.cmd`를 사용합니다. 실행 정책을 변경할 필요는 없습니다.
- Android 에뮬레이터는 Android Studio가 필요합니다. iOS 시뮬레이터는 macOS와 Xcode가 필요하므로 Windows에서는 사용할 수 없습니다.

```sh
node --version
npm --version
npm ci
```

`npm ci`는 `package-lock.json`을 기준으로 설치합니다. 잠금 파일을 함께 관리하며, 초기 설치를 위해 삭제하거나 `--force`, `--legacy-peer-deps`를 사용하지 않습니다. 설치 중 스크립트 승인 경고가 나오면 해당 패키지와 실행 내용을 검토합니다. 일괄 승인은 기본 설정에 포함하지 않습니다.

## 기술 스택 및 설치 버전

아래는 초기 세팅의 잠금 파일에 기록된 직접 의존성 버전입니다. 실제 설치 기준은 `package-lock.json`이며 `npm ls --depth=0`으로 확인할 수 있습니다.

| 용도                           | 패키지                                                | 설치 버전                  |
| ------------------------------ | ----------------------------------------------------- | -------------------------- |
| 앱 프레임워크                  | expo                                                  | 58.0.16                    |
| UI 런타임                      | react / react-dom                                     | 19.3.0 / 19.3.0            |
| 네이티브 런타임                | react-native                                          | 0.88.0                     |
| 라우팅                         | expo-router                                           | 58.0.24                    |
| Expo 설정 / 링크 / 상태 표시줄 | expo-constants / expo-linking / expo-status-bar       | 58.0.12 / 58.0.13 / 58.0.3 |
| 안전 영역 / 네이티브 화면      | react-native-safe-area-context / react-native-screens | 5.10.1 / 4.30.0            |
| 스타일링                       | nativewind / tailwindcss                              | 4.2.7 / 3.4.17             |
| 애니메이션 지원                | react-native-reanimated / react-native-worklets       | 4.7.1 / 0.13.0             |
| 아이콘 / SVG                   | lucide-react-native / react-native-svg                | 1.59.0 / 15.16.0           |
| HTTP 클라이언트                | axios                                                 | 1.20.0                     |
| 서버 상태 기반 환경            | @tanstack/react-query                                 | 5.104.5                    |
| 전역 상태 라이브러리           | zustand                                               | 5.0.15                     |
| 언어 / React 타입              | typescript / @types/react                             | 6.0.3 / 19.3.0             |
| Babel                          | babel-preset-expo                                     | 58.0.18                    |
| 린트                           | eslint / eslint-config-expo                           | 9.39.5 / 58.0.4            |
| 포맷 / 충돌 방지               | prettier / eslint-config-prettier                     | 3.9.10 / 10.1.8            |
| 린트 환경 전역 변수            | globals                                               | 17.13.0                    |
| 테스트                         | jest / jest-expo / @types/jest                        | 30.5.2 / 58.0.11 / 30.0.0  |
| 컴포넌트 테스트                | @testing-library/react-native / test-renderer         | 14.1.0 / 1.3.1             |
| Expo 진단                      | expo-doctor                                           | 1.21.5                     |

## 디렉터리 구조

```text
frontend/
├── README.md
├── assets/                         # 기존 아이콘 및 정적 파일
├── src/
│   ├── app/
│   │   ├── _layout.tsx             # CSS, QueryClientProvider, 루트 Slot
│   │   └── index.tsx               # 최소 초기 화면
│   ├── components/.gitkeep         # 공통 컴포넌트 준비
│   ├── features/home/HomeScreen.tsx # 기존 서버 연결 점검 화면 (라우트 미연결)
│   ├── hooks/.gitkeep
│   ├── services/
│   │   ├── api.ts                  # 공통 Axios 인스턴스
│   │   └── queryClient.ts          # 공용 QueryClient
│   ├── shared/                     # 초기 저장소의 서버 점검 코드 보존
│   │   ├── api/health.ts
│   │   └── config/appConfig.ts
│   ├── stores/.gitkeep             # Store 구현 없음
│   ├── types/.gitkeep
│   ├── constants/.gitkeep
│   └── utils/.gitkeep
├── __tests__/                      # 라우트, Provider, 스타일, 아이콘, 기존 점검 테스트
├── .env.example
├── .gitignore
├── .node-version
├── .prettierrc.js
├── .prettierignore
├── AGENTS.md
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── nativewind-env.d.ts
├── tsconfig.json
├── eslint.config.js
├── jest.setup.js
├── jest.style-mock.js
├── package.json
└── package-lock.json
```

`node_modules/`, `.expo/`, `expo-env.d.ts`, `android/`, `ios/`는 설치·실행·네이티브 생성 과정의 산출물로 Git에서 제외합니다. 루트 `.gitignore`와 `.editorconfig`, `.gitattributes`도 함께 적용됩니다.

## 환경변수

API 통신 준비가 필요할 때 `.env.example`을 `.env.local`로 복사합니다. 기본 앱 실행에는 환경 파일이나 백엔드 서버가 필요하지 않습니다.

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux에서는 `cp .env.example .env.local`을 사용할 수 있습니다.

```dotenv
EXPO_PUBLIC_API_URL=
```

`src/services/api.ts`가 `process.env.EXPO_PUBLIC_API_URL`을 읽습니다. 서버 주소가 결정되기 전에는 빈 값으로 둡니다. 기본 서버 주소를 자동 지정하지 않으며, 인스턴스 생성만으로 요청을 보내지 않습니다. 값 변경 후 앱을 전체 새로고침하고, 필요하면 개발 서버를 재시작합니다.

`EXPO_PUBLIC_*` 값은 앱 번들에 포함되어 사용자가 볼 수 있습니다. API 비밀키, JWT 서명키, 데이터베이스 비밀번호 등은 넣지 않습니다. `.env*`는 Git에서 제외하고 빈 `.env.example`만 추적합니다.

`src/shared/config/appConfig.ts`의 `EXPO_PUBLIC_API_BASE_URL`과 개발 PC 주소 추론은 기존 서버 점검 코드에만 남아 있습니다. 현재 라우트와 신규 Axios 인스턴스는 이 코드를 사용하지 않습니다. 새 API 코드의 변수명은 `EXPO_PUBLIC_API_URL`입니다.

## 개발 서버 및 Expo Go

```sh
npm start
```

캐시를 초기화해야 할 때는 `npm start -- --clear`를 실행합니다. 종료는 `Ctrl+C`입니다.

1. [공식 설치 페이지](https://expo.dev/go?device=true&platform=android&sdkVersion=58)에서 **SDK 58을 지원하는 Expo Go** 배포 여부를 확인하고 설치합니다. 일반 스토어 앱의 버전이 프로젝트 SDK와 같다고 가정하지 않습니다.
2. 개발 PC와 휴대폰을 같은 Wi-Fi에 연결하고 `npm start`를 실행합니다.
3. Android에서는 Expo Go의 QR 스캔 기능으로 터미널의 QR 코드를 엽니다. iOS에서는 카메라로 QR을 열며, Expo CLI와 Expo Go에서 동일한 Expo 계정 로그인이 필요합니다 (`npx expo login`).
4. 초기 화면에 `오늘의 모찌`가 보이는지 확인합니다. 이 단계에서 서버 연결이나 로그인은 수행하지 않습니다.
5. 연결이 안 되면 SDK 버전, Wi-Fi, 방화벽의 Node.js 로컬 네트워크 접근 허용 여부를 확인합니다.

2026-10-20 확인 기준 [SDK 58 출시 공지](https://expo.dev/changelog/sdk-58#expo-go)는 스토어용 Expo Go 배포 지연을 안내합니다. Android는 SDK 선택 설치 페이지를, iOS는 [공식 실기기 환경 안내](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&platform=ios)를 확인합니다. SDK 58용 Expo Go를 사용할 수 없는 경우 별도의 개발 빌드가 필요할 수 있으며, 이 저장소에는 개발 빌드 환경을 추가하지 않았습니다. 실제 모바일 실행은 이번 자동 검증에 포함되지 않았습니다.

에뮬레이터가 준비된 환경에서는 `npm run android`, macOS의 iOS 시뮬레이터에서는 `npm run ios`를 사용할 수 있습니다. 이 두 환경의 실행도 별도 확인이 필요합니다.

## 코드 검사

| 명령                       | 동작                                  |
| -------------------------- | ------------------------------------- |
| `npm run lint`             | Expo 기반 ESLint 검사                 |
| `npm run format`           | Prettier 포맷 적용 (파일 변경)        |
| `npm run format:check`     | 포맷 검사 (파일 변경 없음)            |
| `npm run typecheck`        | TypeScript strict 타입 검사           |
| `npm test -- --runInBand`  | Jest 테스트                           |
| `npm run check`            | 린트 → 포맷 검사 → 타입 검사 → 테스트 |
| `npm run doctor`           | Expo Doctor 진단 (네트워크 필요)      |
| `npx expo install --check` | Expo SDK 의존성 버전 확인             |
| `npm ls --all`             | 전체 의존성 트리 확인                 |

## GitLab CI

루트 `.gitlab-ci.yml`이 `frontend/ci.yml`을 포함하며, `frontend:check` 작업에서 Node.js 24.18.0으로 `npm ci` 후 `npm run check`를 실행합니다. npm 다운로드 캐시는 잠금 파일과 `.node-version`을 기준으로 재사용합니다.

- MR에서는 `frontend/` 또는 루트 `.gitlab-ci.yml`, `.editorconfig`, `.gitattributes`가 변경되면 실행합니다.
- 브랜치를 선택해 **Run pipeline**으로 직접 실행하면 변경 파일과 관계없이 실행합니다.
- 머지 후 push에서는 파이프라인을 실행하지 않습니다.
- 검사 순서는 린트 → 포맷 검사 → 타입 검사 → Jest 테스트이며, 실패하면 해당 작업이 실패합니다.
- 백엔드 서버나 에뮬레이터는 필요하지 않습니다. Android/iOS 앱 빌드 및 배포는 포함하지 않습니다.

## 설정 연결

- Router: `package.json`의 `main`은 `expo-router/entry`, 라우트는 `src/app/`입니다. `app.json`의 Router 플러그인과 `typedRoutes`가 활성화되어 있습니다.
- TypeScript: `expo/tsconfig.base` 확장, `strict: true`, `@/* → ./src/*`. 별도 Babel 경로 별칭 플러그인은 사용하지 않습니다.
- NativeWind: **v4 + Tailwind v3** 조합입니다. `babel.config.js`의 NativeWind JSX/preset, `metro.config.js`의 `withNativeWind`, `global.css`의 Tailwind 지시문, 루트 레이아웃 CSS import, `nativewind-env.d.ts`가 연결되어 있습니다. v5/Tailwind v4 설정을 섞지 않습니다. 테마 확장은 비어 있습니다.
- 코드 품질: Expo ESLint flat config와 마지막의 `eslint-config-prettier`로 포맷 규칙 충돌을 방지합니다. `.prettierignore`는 산출물·환경 파일·잠금 파일 등을 제외합니다.
- API/상태: Axios 인스턴스와 QueryClientProvider만 연결되어 있습니다. 실제 Query/Mutation, 인증 인터셉터, Zustand Store는 없습니다.
- 테스트: Jest에서 CSS는 빈 모듈로 처리하며 Lucide는 패키지가 제공하는 CommonJS 빌드를 사용합니다. 실제 앱의 Metro 번들은 React Native용 진입점을 사용합니다.

기존 서버 점검 화면·테스트와 설정에서 참조하는 이미지 자산은 보존했습니다. 미참조 템플릿 이미지 `assets/splash-icon.png`는 제거했습니다. 현재 라우트에는 템플릿 탭·예제 이동 화면이 없습니다. 중복 Babel/Metro/ESLint/Prettier 설정 파일은 생성하지 않습니다.

## 최종 검증 기록 (2026-10-20)

검증 환경은 Windows, Node.js 24.18.0, npm 11.16.0입니다.

| 검증                                             | 결과                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`                    | 성공, 잠금 파일 기준 재설치                                                      |
| `package.json`과 lockfile 루트 의존성 메타데이터 | 일치                                                                             |
| `npm ls --all`                                   | 성공, 의존성 트리 오류 없음                                                      |
| `npm run lint`                                   | 통과                                                                             |
| `npm run format:check`                           | 통과                                                                             |
| `npm run typecheck`                              | 통과                                                                             |
| `npm test -- --runInBand`                        | 4개 테스트 묶음, 9개 테스트 통과                                                 |
| `npm run doctor`                                 | 20/20 통과                                                                       |
| `npx expo install --check`                       | 통과                                                                             |
| Router / QueryClientProvider                     | 초기 경로 렌더링, 공용 클라이언트 전달, 빈 Query 캐시 테스트 통과                |
| NativeWind / Lucide                              | 유틸리티의 네이티브 스타일 적용, SVG 렌더링 테스트 통과                          |
| Axios / TanStack Query / Zustand / Lucide 설치   | 직접 의존성 및 버전 확인                                                         |
| 개발 서버                                        | `npm start -- --localhost --port 8081` 실행, Metro 상태 응답 확인                |
| Android / iOS 번들                               | 양쪽 HTTP 200, 루트 레이아웃·초기 화면 포함 확인. 실기기 실행과는 별도 검증      |
| Git 제외 / 환경 파일                             | 산출물·로컬 환경 파일 제외, 제외 대상의 추적 파일 없음, 빈 `.env.example`만 존재 |
| 일반적인 비밀키 패턴 검사                        | 프론트엔드 소스에서 일치 없음. 모든 비밀정보 유형을 보장하는 검사는 아님         |

테스트 실행 과정에서 React Native의 `ImageBackground` 사용 중단 경고가 NativeWind 테스트 지원 코드에서 나올 수 있습니다. 테스트 실패로 처리되지는 않습니다.

### 미해결 및 미검증 항목

- `npm audit` 결과 **62건 (moderate 29, high 33, critical 0)**이 남아 있습니다. 직접·간접 의존성을 포함한 npm 집계이며, 정상 설정과 버전을 임의로 바꾸지 않기 위해 자동 수정이나 강제 업그레이드는 하지 않았습니다. 보안 수정은 별도 검토가 필요합니다.
- npm 11이 `@parcel/watcher`, `unrs-resolver`의 설치 스크립트 승인 경고를 표시했습니다. 이번 설치·검사·테스트는 성공했지만, 스크립트는 별도 승인하지 않았습니다.
- Expo Go 실기기 화면, Android 에뮬레이터, iOS 시뮬레이터 실행은 미검증입니다. SDK 58에 맞는 Expo Go의 플랫폼별 배포 여부도 설치 시점에 확인해야 합니다.
- 백엔드 연결, 인증, 실제 API 요청, 서버 Query, Zustand Store는 이번 검증 범위에 없으며 구현하지 않았습니다.

## 공식 참고 문서

- [Expo SDK 58 호환표](https://docs.expo.dev/versions/v58.0.0/)
- [Expo Router 설치](https://docs.expo.dev/router/installation/)
- [NativeWind v4 설치](https://www.nativewind.dev/docs/getting-started/installation)
- [Expo 환경변수](https://docs.expo.dev/guides/environment-variables/)
- [Expo 개발 서버 및 기기 연결](https://docs.expo.dev/get-started/start-developing/)
