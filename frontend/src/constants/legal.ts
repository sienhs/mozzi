// 약관 본문은 서버(GET /legal/*)에서 받는다. 원본은 docs/legal이고 문구를 고치면 서버 배포로 바뀐다.
export type LegalType = 'TERMS' | 'PRIVACY';
export const legalTypes: LegalType[] = ['TERMS', 'PRIVACY'];
export const legalLabels: Record<LegalType, string> = {
  TERMS: '이용약관',
  PRIVACY: '개인정보 처리방침',
};
