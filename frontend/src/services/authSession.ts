import type { AuthTokens } from '@/types/auth';
import { AuthError } from './authErrors';
import { authTransport } from './authTransport';
import { tokenStorage } from './tokenStorage';

let tokens: AuthTokens | null = null;
let epoch = 0;
let refresh: Promise<AuthTokens> | null = null;
let writes: Promise<unknown> = Promise.resolve();
const queue = <T>(work: () => Promise<T>): Promise<T> => {
  const next = writes.then(work, work);
  writes = next.catch(() => undefined);
  return next;
};
export const authSession = {
  current: () => tokens,
  version: () => epoch,
  assert(version: number) {
    if (version !== epoch)
      throw new AuthError('SESSION_CHANGED', '로그인 상태가 변경됐어요.');
  },
  begin() {
    epoch += 1;
    tokens = null;
    refresh = null;
    return epoch;
  },
  async restore(version: number) {
    const saved = await queue(() => tokenStorage.read());
    authSession.assert(version);
    tokens = saved;
    return saved;
  },
  async save(next: AuthTokens, version: number) {
    authSession.assert(version);
    // Retain rotated credentials in memory if native storage fails; retry saving, not rotating.
    tokens = next;
    await queue(async () => {
      authSession.assert(version);
      await tokenStorage.write(next);
    });
    authSession.assert(version);
  },
  async clear() {
    authSession.begin();
    await queue(() => tokenStorage.clear());
  },
  refreshTokens(): Promise<AuthTokens> {
    if (refresh) return refresh;
    const current = tokens;
    const version = epoch;
    if (!current)
      return Promise.reject(
        new AuthError('ACCESS_TOKEN_MISSING', '다시 로그인해 주세요.'),
      );
    const pending = (async () => {
      const next = await authTransport.refresh(current.refreshToken);
      authSession.assert(version);
      await authSession.save(next, version);
      return next;
    })();
    refresh = pending;
    void pending
      .finally(() => {
        if (refresh === pending) refresh = null;
      })
      .catch(() => undefined);
    return pending;
  },
};
