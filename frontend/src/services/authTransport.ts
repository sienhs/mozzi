import { create } from 'axios';
import { getApiBaseUrl } from './authConfig';
import { AuthError } from './authErrors';
import {
  isAuthTokens,
  type AgreedTerms,
  type AuthTokens,
  type GoogleLoginResponse,
} from '@/types/auth';

// Refresh uses this client, never the authenticated client's interceptor.
export const authHttp = create({
  timeout: 10000,
  headers: { Accept: 'application/json' },
});
export const requireTokens = (data: unknown): AuthTokens => {
  if (!isAuthTokens(data))
    throw new AuthError(
      'INVALID_RESPONSE',
      '로그인 응답을 확인하지 못했어요. 다시 시도해 주세요.',
    );
  return data;
};
export const authTransport = {
  async google(idToken: string): Promise<GoogleLoginResponse> {
    const { data } = await authHttp.post(
      '/auth/google',
      { idToken },
      { baseURL: getApiBaseUrl() },
    );
    if (data?.status === 'LOGIN_SUCCESS')
      return { ...requireTokens(data), status: 'LOGIN_SUCCESS' };
    if (
      data?.status === 'SIGNUP_REQUIRED' &&
      typeof data.signupToken === 'string' &&
      data.signupToken &&
      Number.isFinite(Date.parse(data.signupExpiresAt))
    ) {
      return {
        status: 'SIGNUP_REQUIRED',
        signupToken: data.signupToken,
        signupExpiresAt: data.signupExpiresAt,
      };
    }
    throw new AuthError(
      'INVALID_RESPONSE',
      '로그인 응답을 확인하지 못했어요. 다시 시도해 주세요.',
    );
  },
  async signup(
    signupToken: string,
    nickname: string,
    agreedTerms: AgreedTerms[],
  ) {
    const { data } = await authHttp.post(
      '/auth/signup',
      { signupToken, nickname, agreedTerms },
      { baseURL: getApiBaseUrl() },
    );
    return requireTokens(data);
  },
  async refresh(refreshToken: string) {
    const { data } = await authHttp.post(
      '/auth/refresh',
      { refreshToken },
      { baseURL: getApiBaseUrl() },
    );
    return requireTokens(data);
  },
};
