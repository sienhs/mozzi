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
- 닉네임 필수 수집, 그림·영상 생성과 기기 저장 제공, 결과물은 비상업적 개인 소장·SNS 공유만 허용
- 시행일 2026-10-30, Atlas 법인 ATLAS CLOUD AI INC.(미국), 생성 요청 내용 최대 7일 보관
- 앱 밖 삭제 요청은 이메일로 받고 3영업일 내 접수 회신, 본인 확인 후 7일 내 삭제
- 탈퇴 시 계정 관련 실제 데이터 삭제. 개인을 알아볼 수 없는 합계 통계만 유지
- Spring에서 로그인 없이 열리는 HTTPS HTML 페이지로 정책 제공

## 공개 전에 확정할 사항

1. 개인정보 처리방침의 접속·보안 기록 항목(Ingress 접근 로그 포함)
2. 접속 기록과 문의의 보유 기간
3. 백업 최장 기간 1일 검증(수동 스냅샷, S3 버전 관리 여부)
4. 계정 삭제 안내 페이지 URL
5. 다운로드한 결과물에 AI 생성 표시가 들어가는지, 앱 안 결과물 신고 기능이 있는지

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
