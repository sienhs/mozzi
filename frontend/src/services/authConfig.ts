export function normalizeApiUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('API 주소 설정을 확인해 주세요.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1')
    throw new Error('API 주소는 서버 주소 또는 /api/v1까지 입력해 주세요.');
  return `${url.origin}/api/v1`;
}
export function getApiBaseUrl() {
  const value =
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!value)
    throw new Error('서버 연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요.');
  return normalizeApiUrl(value);
}
// 약관 버전은 여기 두지 않는다: 동의 버전은 앱에 들어 있는 본문(constants/legal)과 GET /meta를 맞춰 정한다.
export const authConfig = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '',
};
