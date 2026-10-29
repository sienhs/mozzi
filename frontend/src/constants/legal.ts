import terms from '../../assets/legal/terms.json';
import privacy from '../../assets/legal/privacy.json';

// 본문과 버전은 같은 파일에 둔다. 본문을 고치면 version도 함께 올려야 서버(GET /meta)와 비교할 수 있다.
export const legalDocuments = { TERMS: terms, PRIVACY: privacy };
export type LegalType = keyof typeof legalDocuments;
export const legalTypes: LegalType[] = ['TERMS', 'PRIVACY'];
