import type { AuthMember } from '@/types/auth';
import { api } from './api';
import { AuthError } from './authErrors';
export async function getMember(): Promise<AuthMember> {
  const { data } = await api.get('/members/me');
  if (
    !Number.isSafeInteger(data?.memberId) ||
    typeof data?.email !== 'string' ||
    typeof data?.nickname !== 'string'
  ) {
    throw new AuthError(
      'INVALID_RESPONSE',
      '내 정보를 확인하지 못했어요. 다시 시도해 주세요.',
    );
  }
  return {
    memberId: data.memberId,
    email: data.email,
    nickname: data.nickname,
  };
}
