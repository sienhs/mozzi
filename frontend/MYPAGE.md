# 마이페이지 · 모찌 장착

## 구현 화면과 진입

- 기존 하단 탭바의 다섯 번째 `마이페이지` → `/mypage`
- 마이페이지의 닉네임·인사말 프로필 카드 → 기존 `/settings`
- 마이페이지의 `내 모찌 변경하기` → `/mypage/owned`
- 보유 카드 선택 → `/mypage/mochi/[id]`
- `이 모찌 장착하기` 성공 → 마이페이지, 3초간 `장착 완료!`

기존 인증 보호 안에서 마이페이지는 탭으로, 보유 목록과 상세는 스택 화면으로 연결했다. 기존 탭바에 항목 하나를 추가했으며 별도 탭바는 만들지 않았다. 홈 사용자 아이콘은 제거했다. 설정 진입은 프로필 카드에서 제공하고, 마이페이지에 별도 설정·계정 메뉴 목록은 넣지 않았다. 최근 모찌 미리보기에는 클릭 동작이나 별도 이동 버튼이 없다.

## 데이터와 기능

기존 `useGachaStore.owned`와 `constants/gacha.ts`의 캐릭터·등급·이미지를 재사용한다. 기본 모찌는 별도로 항상 보유하며, 보유 개수는 기본 모찌를 포함한 고유 캐릭터 수다. 기본 데모 상태는 기본 1종과 기존 보유 5종이다.

- 이름 검색 + 카테고리 8개 + 등급 5개를 함께 적용한다. `기타` 카테고리는 없다.
- 실제 이미지가 있는 8종은 기존 과일 카탈로그를 사용한다. 기본 모찌의 카테고리는 `null`이며 전체 목록에서 볼 수 있다.
- 보유 목록은 공통 Screen의 `scrollable={false}` 안에 단독 `FlatList numColumns={3}`로 렌더링한다. 로컬 이미지 require와 메모이제이션을 사용한다. 서버 페이지네이션은 현재 없다.
- 신규 뽑기·교환의 성공 시점에만 `acquiredAt`을 기록한다. 중복 획득은 최초 시각을 덮어쓰지 않는다. 뽑기·교환은 자동 장착하지 않는다.
- 최근/오래된 획득순은 알려진 실제 시각으로 정렬한다. 기존 데모 보유분에는 획득일이 없어 임의 날짜를 채우지 않으며, 이름순으로 목록 뒤에 표시한다. 최근 미리보기도 같은 순서를 사용하고 해당 제한을 안내한다.
- 장착 요청 중 연타, 현재 모찌 중복 장착, 미보유 모찌 장착을 막는다. 실패하면 기존 장착을 유지하고 재시도할 수 있다. 로그아웃하면 장착을 기본으로 돌리고 지연된 장착 응답을 무시한다.

## 기존 일기와의 연동

감정 선택의 5개 항목은 기존 로직을 유지하며 장착 모찌의 이미지 매핑을 사용한다. 저장 시작 시점의 장착 ID를 새 일기의 로컬 `companionId`에 보관한다. 저장 도중 장착이 바뀌어도 해당 일기의 캐릭터는 바뀌지 않는다.

뽑기 홈의 유리병 속 캐릭터는 장착 상태와 관계없이 기본 모찌를 표시한다. 중복 획득 연출에서는 기존처럼 획득 결과 캐릭터를 잠시 표시하며, 개봉 영상은 기존 파일을 유지한다.

캘린더·일기 행·생성 대기 이미지는 각 기록의 `companionId`를 읽는다. 필드가 없는 기존 일기는 기본 모찌를 사용한다. 이미 생성된 그림은 수정하거나 재생성하지 않는다. 재시도 시에도 그 기록의 저장된 ID를 Mock 생성 컨텍스트로 전달한다. 장착 자체는 이미지 생성을 호출하지 않는다.

## Mock과 실제 API의 경계 / 백엔드 TODO

로그인은 develop의 실제 Google 인증·세션 복원·로그아웃 처리를 사용하고, 마이페이지 사용자 정보는 `useAuthStore.member`를 읽는다. 일기·뽑기·장착은 기존 로컬 Mock이다. `mockEquipmentService`를 기존 실패 제어에 연결했으며 `failNext('equip')`로 실패를 재현할 수 있다. 화면에도 개발용 미리보기임을 표시한다. 앱 새로고침·재실행 이후 서버에 장착이 보존되는 기능은 아직 없다. 로그인/로그아웃의 세션 초기화는 진행 중인 장착 응답도 무효화한다.

develop의 `MemberController`에는 내 정보 조회/탈퇴가 있고, `DiaryCreateRequestDto`는 `emoticonId`, `content`, `myIconIds`를 받는다. 아이콘/내 아이콘 API도 추가됐으나 이 화면의 과일 캐릭터 카탈로그 ID와 직접 대응하는 장착 계약은 아직 없다. 이 작업에서 임의의 원격 엔드포인트나 요청 필드를 추가하지 않았다. 일기·뽑기·장착의 실제 API 연동은 별도 작업이다.

백엔드에서 필요한 계약:

1. 보유 목록: 캐릭터 ID·이름·카테고리·등급·이미지 URL·감정별 URL·실제 최초 획득 시각·페이지네이션.
2. 현재 장착 조회와 보유 검증을 포함한 장착 변경. 계정별 저장과 실패 응답 계약.
3. 일기 생성 시 서버에서 장착 캐릭터를 스냅샷하고, 일기 상세·달력 응답에 당시 ID를 제공.
4. AI 작업이 해당 일기의 캐릭터 스냅샷을 읽는 계약. 기존 그림은 유지.

TanStack Query와 Axios는 기존 구성을 유지했다. 서버 계약이 생기면 현재 Mock 장착 경계를 mutation으로 교체하고 보유·장착 조회 캐시를 갱신해야 한다.

## 필요한 추가 이미지

`constants/companions.ts`의 `emotionSources`가 추후 연결 지점이다. 기본 모찌의 기존 감정 5종은 재사용한다. 과일 8종에는 행복·평온·보통·우울·화남의 전용 감정 이미지가 필요하다. 현재는 선택한 캐릭터의 기본 그림을 공통으로 표시하고, 상세 화면에서 표정 준비 중임을 안내한다. 새 이미지는 생성하지 않았다.

## 파일

새 파일:

- `src/types/companion.ts`, `src/constants/companions.ts`
- `src/features/mypage/{MyPageScreen,OwnedCompanionsScreen,EquipCompanionScreen}.tsx`
- `src/features/mypage/ownedCompanions.ts`
- `src/components/mypage/CompanionUI.tsx`
- `src/app/(tabs)/mypage.tsx`, `src/app/mypage/owned.tsx`, `src/app/mypage/mochi/[id].tsx`
- `__tests__/companions.test.ts`, `__tests__/mypage-flow.test.tsx`

수정 파일:

- 라우팅·진입: `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/components/ui/TabBar.tsx`, `src/features/home/DiaryHomeScreen.tsx`, `src/components/ui/Icon.tsx`
- 공통 목록 프레임: `src/components/ui/Screen.tsx`
- 상태/Mock: `src/stores/useGachaStore.ts`, `useAppStore.ts`, `src/mocks/services.ts`, `controls.ts`, `src/types/diary.ts`
- 감정/과거 기록: `src/components/emotion/Emotion.tsx`, `src/components/ui/DiaryCard.tsx`, `Feedback.tsx`, `src/features/calendar/CalendarScreen.tsx`, `src/features/diary/DiaryDetailScreen.tsx`, `RecordScreens.tsx`

## 검증 범위

자동 테스트: 장착 성공·실패·재시도·중복/동시 요청 차단·기본 모찌 재장착·로그아웃 중 응답 무시·뽑기/교환 획득 시각·검색/필터/정렬·기록 스냅샷·과거 기록 유지·인증 보호·전체 화면 이동.

로컬 Chrome에서 360×800, 390×844, 393×852, 430×932의 마이페이지와 3열 목록을 확인했다. 360×800에서 긴 카테고리 이름, 바텀시트 적용 버튼, 장착 화면 하단 버튼도 확인했다. 브라우저에서 실제 카드 선택과 장착 완료 복귀를 확인했다.

실제 Android/iOS 기기, 시스템 내비게이션·노치, 모바일 소프트 키보드, 실제 서버 연동과 영구 저장은 검증하지 않았다. 실기기 검증은 다음 단계의 TODO다.
