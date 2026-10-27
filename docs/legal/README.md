# 모찌 배포용 정책 문서

작성일: 2026-10-27 / 상태: 공개 전 검토 초안

사용자와 확정한 운영 방향을 바탕으로 작성한 저장소 문서입니다. 실제 앱 기능을 구현하거나 웹에 게시한 결과물은 아닙니다. `[공개 전 확정: ...]`이 남아 있는 문서는 그대로 게시하거나 동의를 받는 데 사용하지 않습니다.

| 문서 | 용도 | Spring 공개 경로 |
| --- | --- | --- |
| [이용약관](TERMS.md) | 서비스 이용 규칙 | `/legal/terms` |
| [개인정보 처리방침](PRIVACY.md) | 수집·이용·외부 처리·삭제 안내 | `/legal/privacy` |
| [가입 및 AI 이용 안내](CONSENT.md) | 화면 문구와 동의 설계 | 가입 화면 및 생성 화면 |
| [계정 삭제 안내](ACCOUNT_DELETION.md) | 앱 밖에서도 삭제 요청 | `/support/account-deletion` |
| [배포 전 확인표](RELEASE_CHECKLIST.md) | 내부 검토 및 Play Console 작성 | 공개하지 않는 내부 문서 |

## 확정한 사항

- 서비스명: 오늘의 모찌 / 운영자: 조영진
- 공개 문의처 및 개인정보 담당 연락처: haybarn474@gmail.com
- 한국 서비스, 만 14세 이상 가입, 무료, 광고·마케팅·푸시 알림 없음
- 감정·활동을 선택하고 1~2줄의 짧은 일기를 작성. 본인만 기록 열람
- Atlas Cloud를 통해 그림은 GPT Image 2.5 Sunburst, 영상은 Veo 3.1 사용 예정
- 일기 전체를 AI에 전송. 별도의 AI 글 생성은 현재 제공하지 않음
- AWS S3와 관계형 DB는 서울 지역 사용 예정
- 탈퇴 시 계정 관련 실제 데이터 삭제. 개인을 알아볼 수 없는 합계 통계만 유지
- Spring에서 로그인 없이 열리는 HTTPS HTML 페이지로 정책 제공

## 공개 전에 확정할 사항

1. 도메인·시행일·정책 버전 및 실제 출시 기능 범위
2. 나이 확인에 사용하는 정보, 선택 닉네임의 실제 수집 여부
3. Atlas의 정확한 API 모델 ID, 처리 업체·국가·연락처, 모델별 보관·학습·삭제 조건과 14~18세 콘텐츠 처리 허용 범위
4. 국외 이전의 적법한 근거와 공개 또는 별도 동의 방식
5. 실제 삭제 일정, 백업·수동 스냅샷·로그·AI 요청문 복사본의 정리 방식과 기간
6. Google OAuth 범위, 실제 수신 항목, 서버·SDK가 수집하는 접속·기기 정보
7. 생성 결과물의 이용 범위와 관련 모델의 계약 조건

정보가 미정이라는 사실과 사용자 동의는 다릅니다. 빈 항목에 동의받아 외부 전송을 시작하지 않습니다. 기존 코드의 닉네임·푸시 테이블은 실제 수집 여부를 뜻하지 않으며 출시 동작을 기준으로 문서를 확정합니다.

## 참고한 공식 자료

- [Google Play 사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311?hl=ko)
- [Google Play 계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google Play AI 생성 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)
- [개인정보 보호법](https://www.law.go.kr/lsInfoP.do?lsiSeq=289415)
- [Atlas 데이터 보관 정책](https://www.atlascloud.ai/data-retention)
- [Atlas 삭제 정책](https://www.atlascloud.ai/data-deletion-policy)
- [Atlas 약관](https://www.atlascloud.ai/privacy)

Atlas의 일반 서비스는 별도 조건이 없으면 콘텐츠를 최대 7일 보관할 수 있고, 제3자 모델 제공업체의 정책도 적용될 수 있습니다. 모든 요청이 무보관·학습 미사용이라고 단정하지 않습니다. 실제 계약과 서비스별 조건을 확인합니다.
