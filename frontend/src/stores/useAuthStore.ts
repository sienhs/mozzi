import { create } from 'zustand';
import { setSessionRejectedHandler } from '@/services/api';
import { authHttp, authTransport } from '@/services/authTransport';
import { authSession } from '@/services/authSession';
import {
  authErrorMessage,
  errorCode,
  isSessionRejected,
} from '@/services/authErrors';
import { googleAuth } from '@/services/googleAuth';
import { getMember } from '@/services/memberApi';
import { getApiBaseUrl } from '@/services/authConfig';
import { queryClient } from '@/services/queryClient';
import type {
  AgreedTerms,
  AuthMember,
  AuthTokens,
  SignupTicket,
} from '@/types/auth';
import { validNickname } from '@/types/auth';
import { useAppStore } from './useAppStore';
import { useGachaStore } from './useGachaStore';

type AuthStatus =
  | 'restoring'
  | 'signedOut'
  | 'signupRequired'
  | 'authenticated'
  | 'restorationError';
interface AuthState {
  status: AuthStatus;
  member: AuthMember | null;
  ticket: SignupTicket | null;
  pending: boolean;
  error: string;
  bootstrap: () => Promise<void>;
  signIn: () => Promise<void>;
  signup: (nickname: string, terms: AgreedTerms[]) => Promise<void>;
  cancelSignup: () => void;
  signOut: () => Promise<void>;
  invalidate: (message?: string) => Promise<void>;
}
let bootstrapPromise: Promise<void> | null = null;
let cleanupRequired = false;
const resetUserData = () => {
  void queryClient.cancelQueries();
  queryClient.clear();
  useAppStore.getState().resetSession();
  useGachaStore.getState().resetSession();
};
async function finishLogin(tokens: AuthTokens, version: number) {
  await authSession.save(tokens, version);
  const member = await getMember();
  authSession.assert(version);
  resetUserData();
  useAuthStore.setState({
    member,
    ticket: null,
    status: 'authenticated',
    error: '',
  });
}
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'restoring',
  member: null,
  ticket: null,
  pending: false,
  error: '',
  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    if (!['restoring', 'restorationError'].includes(get().status))
      return Promise.resolve();
    if (cleanupRequired) return get().invalidate();
    const version = authSession.version();
    set({ status: 'restoring', error: '' });
    const task = (async () => {
      try {
        const saved =
          authSession.current() ?? (await authSession.restore(version));
        if (!saved) {
          set({ status: 'signedOut', member: null });
          return;
        }
        if (Date.parse(saved.accessExpiresAt) <= Date.now())
          await authSession.refreshTokens();
        // Retry an earlier native storage failure before admitting the session.
        await authSession.save(authSession.current()!, version);
        const member = await getMember();
        authSession.assert(version);
        set({ member, ticket: null, status: 'authenticated' });
      } catch (error) {
        if (version !== authSession.version()) return;
        if (isSessionRejected(error))
          await get().invalidate(authErrorMessage(error));
        else
          set({ status: 'restorationError', error: authErrorMessage(error) });
      }
    })();
    bootstrapPromise = task;
    void task
      .finally(() => {
        if (bootstrapPromise === task) bootstrapPromise = null;
      })
      .catch(() => undefined);
    return task;
  },
  signIn: async () => {
    if (get().pending || get().status !== 'signedOut') return;
    const version = authSession.begin();
    set({ pending: true, error: '', ticket: null });
    try {
      getApiBaseUrl();
      const idToken = await googleAuth.signIn();
      authSession.assert(version);
      if (!idToken) return;
      const result = await authTransport.google(idToken);
      authSession.assert(version);
      if (result.status === 'SIGNUP_REQUIRED') {
        set({
          ticket: {
            signupToken: result.signupToken,
            signupExpiresAt: result.signupExpiresAt,
          },
          status: 'signupRequired',
        });
      } else await finishLogin(result, version);
    } catch (error) {
      if (version === authSession.version())
        set({
          error: authErrorMessage(error),
          status: authSession.current() ? 'restorationError' : 'signedOut',
        });
    } finally {
      if (version === authSession.version()) set({ pending: false });
    }
  },
  signup: async (nickname, agreedTerms) => {
    const { ticket, pending } = get();
    if (pending || get().status !== 'signupRequired' || !ticket) return;
    if (!validNickname(nickname)) {
      set({ error: '닉네임은 2~12자의 한글, 영문, 숫자로 입력해 주세요.' });
      return;
    }
    if (
      agreedTerms.length !== 2 ||
      !['TERMS', 'PRIVACY'].every(type =>
        agreedTerms.some(term => term.type === type && !!term.version),
      )
    ) {
      set({ error: '필수 약관을 확인하고 동의해 주세요.' });
      return;
    }
    if (Date.parse(ticket.signupExpiresAt) <= Date.now()) {
      get().cancelSignup();
      set({
        error: '가입 시간이 지났어요. Google 로그인을 다시 진행해 주세요.',
      });
      return;
    }
    const version = authSession.version();
    set({ pending: true, error: '' });
    try {
      const tokens = await authTransport.signup(
        ticket.signupToken,
        nickname,
        agreedTerms,
      );
      authSession.assert(version);
      // Keep routing in the loading state while the consumed ticket becomes a session.
      set({ ticket: null, status: 'restoring' });
      await finishLogin(tokens, version);
    } catch (error) {
      if (version !== authSession.version()) return;
      if (
        [
          'SIGNUP_TOKEN_INVALID',
          'SIGNUP_TOKEN_EXPIRED',
          'ACCOUNT_ALREADY_REGISTERED',
        ].includes(errorCode(error) ?? '')
      ) {
        get().cancelSignup();
      } else if (authSession.current()) set({ status: 'restorationError' });
      set({ error: authErrorMessage(error) });
    } finally {
      if (version === authSession.version()) set({ pending: false });
    }
  },
  cancelSignup: () => {
    authSession.begin();
    set({
      ticket: null,
      member: null,
      status: 'signedOut',
      pending: false,
      error: '',
    });
  },
  invalidate: async (message = '') => {
    // Clear memory immediately; queued disk cleanup runs after any older disk write.
    const clearing = authSession.clear();
    const version = authSession.version();
    resetUserData();
    set({
      member: null,
      ticket: null,
      status: 'signedOut',
      pending: true,
      error: message,
    });
    try {
      await clearing;
      cleanupRequired = false;
    } catch {
      cleanupRequired = true;
      if (version === authSession.version())
        set({
          status: 'restorationError',
          error: '로그인 정보를 정리하지 못했어요. 다시 시도해 주세요.',
        });
    } finally {
      if (version === authSession.version()) set({ pending: false });
    }
  },
  signOut: async () => {
    if (get().pending) return;
    const previous = authSession.current();
    const clearing = authSession.clear();
    const version = authSession.version();
    let storageFailed = false;
    const cleanup = clearing.catch(() => {
      storageFailed = true;
    });
    resetUserData();
    set({
      status: 'signedOut',
      member: null,
      ticket: null,
      pending: true,
      error: '',
    });
    let message = '';
    // Use captured credentials; ordinary requests and refreshes are already invalidated.
    try {
      if (previous)
        await authHttp.post('/auth/logout', undefined, {
          baseURL: getApiBaseUrl(),
          headers: { Authorization: `Bearer ${previous.accessToken}` },
        });
    } catch (error) {
      if (!isSessionRejected(error))
        message =
          '이 기기에서 로그아웃했어요. 서버 연결이 끊겨 세션 종료는 확인하지 못했어요.';
    }
    try {
      await googleAuth.clear();
    } catch {
      /* Server/local cleanup must still proceed. */
    }
    await cleanup;
    if (version !== authSession.version()) return;
    cleanupRequired = storageFailed;
    set({
      pending: false,
      status: storageFailed ? 'restorationError' : 'signedOut',
      error: storageFailed
        ? '로그인 정보를 정리하지 못했어요. 다시 시도해 주세요.'
        : message,
    });
  },
}));
setSessionRejectedHandler(() =>
  useAuthStore
    .getState()
    .invalidate('로그인이 만료됐어요. 다시 로그인해 주세요.'),
);
