export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}
export interface AuthMember {
  memberId: number;
  nickname: string;
  email: string;
}
export interface SignupTicket {
  signupToken: string;
  signupExpiresAt: string;
}
export type GoogleLoginResponse =
  | ({ status: 'LOGIN_SUCCESS' } & AuthTokens)
  | ({ status: 'SIGNUP_REQUIRED' } & SignupTicket);
export interface AgreedTerms {
  type: 'TERMS' | 'PRIVACY';
  version: string;
}
export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: { field: string; reason: string }[] | null;
}
export const validNickname = (value: string) =>
  /^[가-힣A-Za-z0-9]{2,12}$/.test(value);

export function isAuthTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    [
      'accessToken',
      'refreshToken',
      'accessExpiresAt',
      'refreshExpiresAt',
    ].every(key => typeof data[key] === 'string' && !!data[key]) &&
    Number.isFinite(Date.parse(String(data.accessExpiresAt))) &&
    Number.isFinite(Date.parse(String(data.refreshExpiresAt)))
  );
}
