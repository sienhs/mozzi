import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '@/types/auth';

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorBody = (error: unknown): ApiErrorBody | undefined => {
  if (!isAxiosError(error)) return undefined;
  const data = error.response?.data;
  return data &&
    typeof data.code === 'string' &&
    typeof data.message === 'string'
    ? data
    : undefined;
};
export const errorCode = (error: unknown) =>
  error instanceof AuthError ? error.code : errorBody(error)?.code;
export const isSessionRejected = (error: unknown) =>
  [
    'ACCESS_TOKEN_MISSING',
    'ACCESS_TOKEN_INVALID',
    'SESSION_REVOKED',
    'REFRESH_TOKEN_INVALID',
    'REFRESH_TOKEN_EXPIRED',
  ].includes(errorCode(error) ?? '');
// 일반 API 오류 문구. 서버 message는 사용자에게 그대로 보여 줘도 되는 문장이다 (docs/api/common.md).
// axios 자체 오류 문구(영문)는 보여 주지 않는다.
export function apiErrorMessage(error: unknown, fallback: string) {
  const body = errorBody(error);
  if (body) return body.message;
  if (isAxiosError(error))
    return '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.';
  return error instanceof AuthError ? error.message : fallback;
}
// 응답을 받지 못한 실패(타임아웃·연결 끊김). 서버가 처리했는지 알 수 없으므로 실패로 단정하지 않는다.
export const isUnknownOutcome = (error: unknown) =>
  isAxiosError(error) && !error.response;
export function authErrorMessage(error: unknown) {
  const body = errorBody(error);
  if (body)
    return (
      body.fieldErrors?.find(field => field.field === 'nickname')?.reason ??
      body.message
    );
  if (isAxiosError(error))
    return '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.';
  return error instanceof Error
    ? error.message
    : '로그인을 마치지 못했어요. 다시 시도해 주세요.';
}
