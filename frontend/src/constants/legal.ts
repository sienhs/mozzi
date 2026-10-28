import terms from '../../assets/legal/terms.json';
import privacy from '../../assets/legal/privacy.json';

export const legalDocuments = { TERMS: terms, PRIVACY: privacy };
export type LegalType = keyof typeof legalDocuments;
