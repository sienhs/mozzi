# 모찌 문서 공개·스토어 제출 확인표

내부용 / 2026-10-27

이 확인표는 개인정보·계정·AI 관련 제출 준비를 중심으로 합니다. 스토어의 모든 기술·콘텐츠 요건을 대신하지 않습니다.

## 문서를 공개하기 전

- [ ] 모든 `[공개 전 확정]` 항목을 해결한다. 사용자에게 내부 검토 문구를 게시하지 않는다.
- [ ] 운영자·공개 문의처·실제 접수 담당을 확인한다.
- [ ] Google OAuth 범위와 실제 수집 항목을 확인한다. 이메일·sub 외 불필요한 프로필을 요청하지 않는다.
- [ ] 닉네임 수집 여부를 확정한다. 실명 수집으로 잘못 기재하지 않는다.
- [ ] 나이 확인 방식과 저장 항목·기간을 정하고 앱과 서버에 구현한다.
- [ ] 일기·AI 요청문·이미지·영상·생성 기록·접속 로그·문의 이력을 모두 데이터 목록에 포함한다.
- [ ] 개인정보 처리의 목적별 법적 근거와 필요한 동의만 구분한다.
- [ ] 일기 자유 입력에 건강 등 민감한 내용이 들어갈 수 있는 상황에 대한 처리 방침을 검토한다. 감정 선택을 무조건 의료 정보로 간주하지도, 모든 일기에 민감정보가 없다고 가정하지도 않는다.
- [ ] 개인정보 보호 조치를 실제 구현과 맞춘다.
- [ ] 시행일·버전·이전 버전 공개 방법을 정한다.

## Atlas 확인 항목

알려진 모델: GPT Image 2.5 Sunburst / Veo 3.1. 별도 글 생성 AI 없음.

- [ ] 정확한 API 모델 ID와 텍스트→이미지, 이미지→영상 등 실제 호출 경로
- [ ] 각 단계에서 전달되는 일기·요약·이미지·메타데이터 목록
- [ ] Atlas 외 실제 처리업체와 처리·보관·접근 국가, 연락처
- [ ] 14~18세 사용자의 일기를 모찌 서버에서 처리하는 계약 구조의 허용 여부
- [ ] 입력·결과의 보관 기간, 로그·백업, 학습·평가 사용 여부
- [ ] 사용자별 삭제 요청을 전달·추적하는 방법
- [ ] 계약·처리위탁·재위탁 및 국외 이전 근거를 확정
- [ ] 생성 결과 이용권과 회원에게 허용할 다운로드·재사용 범위를 확인

Atlas에 보낼 문의 예시 — 실제 발송은 하지 않았습니다.

```text
We operate a free, private diary app for users aged 14 and above in South Korea.
Our backend will send users' short diary text to Atlas Cloud to generate images
with GPT Image 2.5 Sunburst and animations with Veo 3.1.
Users do not create Atlas accounts. We do not provide a separate AI text feature.

Please confirm for these exact API routes:
1. Whether processing diary content of users aged 14–18 is permitted.
2. The contracting entity, subprocessors/model providers, processing countries,
   and applicable data-processing terms.
3. Retention and deletion of prompts, images, videos, logs and backups,
   including use for training/evaluation and provider-specific exceptions.
4. How we can fulfill deletion requests for one end user.
5. Applicable rights and restrictions for generated outputs in our app.
```

## 삭제 구현과 검증

- [ ] 탈퇴 즉시 접근 차단 및 토큰 무효화
- [ ] 소프트 삭제 후 실제 파기 작업, 실패 재시도·완료 추적
- [ ] 원본 일기뿐 아니라 AI 요청문·이전 생성 시도·중복 요청 응답·저장 파일도 삭제
- [ ] S3 이전 버전 및 캐시·임시 결과가 있다면 정리
- [ ] 외부 AI 업체 관련 삭제 절차
- [ ] DB 자동 백업·수동/최종 스냅샷·서버 로그의 항목별 기간과 근거
- [ ] 백업 복원 시 삭제 요청 재적용
- [ ] 개인과 다시 연결되지 않는 합계 통계. 소수 집단의 재식별 위험도 점검
- [ ] 정책에 적은 예상 일정과 실제 작업 일치

## Spring 공개 페이지

- [ ] `/legal/terms`, `/legal/privacy`, `/support/account-deletion`을 실제 HTTPS 도메인에 제공
- [ ] 앱·Google 로그인 없이 모바일 브라우저에서 본문 열람 가능
- [ ] HTML 본문에 앱명·운영자·연락처·시행일 표시. JSON API만 제공하지 않음
- [ ] 삭제 페이지에 실제 접수 이메일 또는 양식 제공
- [ ] 웹페이지의 쿠키·외부 리소스·접속 로그 확인
- [ ] 앱 가입·설정 및 Play Console에서 올바른 URL 연결

## AI 생성물 표시 (인공지능기본법 제31조)

- [ ] 첫 생성 전 안내 등으로 생성형 AI 사용 사실을 사전 고지
- [ ] 그림·영상이 보이는 모든 화면에 "AI로 생성된 그림/영상" 표시
- [ ] 다운로드·외부 공유를 제공한다면 파일 자체의 표시(문구·워터마크·메타데이터) 방식 확정

## Google 로그인 (OAuth 동의 화면)

- [ ] Google Cloud Console의 OAuth 동의 화면에 앱 이름·지원 이메일·개발자 연락처 입력
- [ ] 앱 홈페이지·개인정보처리방침 URL과 승인된 도메인 입력. 스토어·공개 페이지와 같은 도메인 사용
- [ ] 게시 상태를 "프로덕션"으로 전환. "테스트" 상태에서는 등록한 테스트 사용자만 로그인 가능
- [ ] 요청 범위를 `openid`·`email` 등 실제 필요한 기본 범위로 한정 (민감 범위가 없으면 별도 앱 인증 심사 불필요)
- [ ] Android OAuth 클라이언트를 Play 앱 서명 키의 SHA-1로 등록. 업로드·디버그 키만 등록하면 스토어 설치본에서 로그인 실패

## Play Console 입력 준비

| 항목 | 현재 기준 및 남은 작업 |
| --- | --- |
| 앱명 | 오늘의 모찌. 설명·아이콘·스크린샷·스토어 그래픽 준비 |
| 비용·광고 | 무료 / 광고 없음 |
| 국가·언어 | 한국 / 한국어 |
| 대상 연령 | 만 14세 이상 운영과 실제 앱·스토어 소개를 일치. 콘텐츠 등급과 별도로 작성 |
| 개인정보 정책 | 최종 도메인 + `/legal/privacy` |
| 삭제 URL | 최종 도메인 + `/support/account-deletion` |
| 앱 접근 | Google 로그인 뒤 주요 기능을 심사할 수 있는 실제 접근 방법 제공 |
| 데이터 보안 | 이메일·사용자 식별자·일기 등 실제 항목, AI 외부 전송, SDK·로그까지 확인하여 설문 작성. 처리업체 전송을 모두 정책상 ‘공유’로 임의 판정하지 않음 |
| AI 콘텐츠 | 앱 내 생성 결과 신고 및 접수·처리, 금지 콘텐츠 생성 방지 |
| 개발자 계정 | 개인/조직 계정 확인, 본인 확인과 계정별 테스트·배포 요건 충족 |

추가 참고: [Google 데이터 보안 설문](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [심사 준비](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en), [신규 개인 계정 테스트](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
