import { parseMeta, type MetaResponse } from '@/types/server';
import { getApiBaseUrl } from './authConfig';
import { authHttp } from './authTransport';

// GET /meta는 인증이 없다. 로그인 전에 부르므로 토큰을 붙이는 api 대신 authHttp를 쓴다.
export async function fetchMeta(): Promise<MetaResponse> {
  const { data } = await authHttp.get('/meta', { baseURL: getApiBaseUrl() });
  return parseMeta(data);
}
