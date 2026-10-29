import { invalidResponse } from '@/types/server';
import type { LegalType } from '@/constants/legal';
import { getApiBaseUrl } from './authConfig';
import { authHttp } from './authTransport';

// 약관 본문 (GET /legal/terms · /legal/privacy). 인증이 없어 가입 전에도 읽는다.
// version은 가입 때 agreedTerms로 보낼 값이고 GET /meta의 termsVersions와 같다.
export interface LegalDocumentData {
  type: LegalType;
  version: string;
  title: string;
  // 마크다운 원문. 제목(# )부터 들어 있다.
  body: string;
}
const paths: Record<LegalType, string> = {
  TERMS: '/legal/terms',
  PRIVACY: '/legal/privacy',
};
export const legalKeys = {
  document: (type: LegalType) => ['legal', type] as const,
};
export async function fetchLegal(type: LegalType): Promise<LegalDocumentData> {
  const { data } = await authHttp.get(paths[type], {
    baseURL: getApiBaseUrl(),
  });
  if (
    data?.type !== type ||
    typeof data?.version !== 'string' ||
    !data.version.trim() ||
    typeof data?.title !== 'string' ||
    typeof data?.body !== 'string' ||
    !data.body.trim()
  )
    throw invalidResponse();
  return {
    type,
    version: data.version,
    title: data.title,
    body: data.body,
  };
}
