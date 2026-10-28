import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { authHttp } from '@/services/authTransport';
import { api } from '@/services/api';
import { authSession } from '@/services/authSession';
import { googleAuth } from '@/services/googleAuth';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppStore } from '@/stores/useAppStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { useTagStore } from '@/stores/useTagStore';
import { createMockEntries } from '@/mocks/diaries';
import { mockGachaService, mockDiaryService } from '@/mocks/services';
import type { PullItem } from '@/types/gacha';
import { normalizeApiUrl } from '@/services/authConfig';
import { validNickname, type AuthTokens } from '@/types/auth';

jest.mock('@/services/googleAuth', () => ({
  googleAuth: { signIn: jest.fn(), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));
const pair = (suffix = 'one'): AuthTokens => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  accessExpiresAt: new Date(Date.now() + 1800000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
});
const member = { memberId: 7, nickname: '서버회원', email: 'real@example.com' };
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ data, config, status, statusText: String(status), headers: {} });
function reject(
  config: InternalAxiosRequestConfig,
  code: string,
  status = 401,
): never {
  throw new AxiosError(
    'request failed',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    response(config, { code, message: code, fieldErrors: null }, status),
  );
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const terms = [
  { type: 'TERMS' as const, version: '1.0' },
  { type: 'PRIVACY' as const, version: '1.0' },
];
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
  jest.mocked(googleAuth.signIn).mockResolvedValue('google-id-token');
  await authSession.clear();
  useAuthStore.setState({
    status: 'signedOut',
    member: null,
    ticket: null,
    pending: false,
    error: '',
  });
  authHttp.defaults.adapter = async config =>
    response(config, { status: 'LOGIN_SUCCESS', ...pair() });
  api.defaults.adapter = async config => response(config, member);
});

test('API prefix and nickname validation follow the implemented backend contract', () => {
  expect(normalizeApiUrl('https://example.com/')).toBe(
    'https://example.com/api/v1',
  );
  expect(normalizeApiUrl('https://example.com/api/v1/')).toBe(
    'https://example.com/api/v1',
  );
  expect(() => normalizeApiUrl('https://example.com/api')).toThrow();
  expect(validNickname('가나다라마바사아자차카타')).toBe(true);
  for (const name of ['a', '가 나', 'ㄱㄴ', 'hello!', 'abcdefghijklm'])
    expect(validNickname(name)).toBe(false);
});

test('existing Google member saves tokens and displays server profile without onboarding', async () => {
  const calls: string[] = [];
  authHttp.defaults.adapter = async config => {
    calls.push(config.url!);
    expect(JSON.parse(config.data)).toEqual({ idToken: 'google-id-token' });
    expect(config.headers.get('Authorization')).toBeUndefined();
    return response(config, { status: 'LOGIN_SUCCESS', ...pair() });
  };
  api.defaults.adapter = async config => {
    expect(config.headers.get('Authorization')).toBe('Bearer access-one');
    return response(config, member);
  };
  await useAuthStore.getState().signIn();
  expect(calls).toEqual(['/auth/google']);
  expect(useAuthStore.getState()).toMatchObject({
    status: 'authenticated',
    member,
    ticket: null,
    pending: false,
  });
  expect(SecureStore.setItemAsync).toHaveBeenCalled();
});

test('new member holds ticket in memory and sends nickname and explicit agreements at signup', async () => {
  const saved = pair();
  const calls: string[] = [];
  authHttp.defaults.adapter = async config => {
    calls.push(config.url!);
    if (config.url === '/auth/google')
      return response(config, {
        status: 'SIGNUP_REQUIRED',
        signupToken: 'ticket',
        signupExpiresAt: new Date(Date.now() + 600000).toISOString(),
      });
    expect(JSON.parse(config.data)).toEqual({
      signupToken: 'ticket',
      nickname: '새회원',
      agreedTerms: terms,
    });
    return response(config, saved, 201);
  };
  await useAuthStore.getState().signIn();
  expect(useAuthStore.getState().status).toBe('signupRequired');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  await useAuthStore.getState().signup('새회원', terms);
  expect(calls).toEqual(['/auth/google', '/auth/signup']);
  expect(useAuthStore.getState()).toMatchObject({
    status: 'authenticated',
    member,
    ticket: null,
  });
});

test('Google account cancellation makes no server request', async () => {
  jest.mocked(googleAuth.signIn).mockResolvedValue(null);
  const request = jest.fn(async (config: InternalAxiosRequestConfig) =>
    response(config, {}),
  );
  authHttp.defaults.adapter = request;
  await useAuthStore.getState().signIn();
  expect(request).not.toHaveBeenCalled();
  expect(useAuthStore.getState()).toMatchObject({
    status: 'signedOut',
    pending: false,
    error: '',
  });
});

test('double tapping login opens one Google flow', async () => {
  const gate = deferred<string | null>();
  jest.mocked(googleAuth.signIn).mockReturnValue(gate.promise);
  const first = useAuthStore.getState().signIn();
  await useAuthStore.getState().signIn();
  gate.resolve('id-token');
  await first;
  expect(googleAuth.signIn).toHaveBeenCalledTimes(1);
});

test('invalid login response never admits a session', async () => {
  authHttp.defaults.adapter = async config =>
    response(config, { status: 'LOGIN_SUCCESS', accessToken: 'missing-pair' });
  await useAuthStore.getState().signIn();
  expect(useAuthStore.getState().status).toBe('signedOut');
  expect(authSession.current()).toBeNull();
});

test('duplicate nickname retains ticket and input recovery; no agreement cannot submit', async () => {
  useAuthStore.setState({
    status: 'signupRequired',
    ticket: {
      signupToken: 'ticket',
      signupExpiresAt: new Date(Date.now() + 600000).toISOString(),
    },
  });
  let calls = 0;
  authHttp.defaults.adapter = async config => {
    calls++;
    return reject(config, 'NICKNAME_DUPLICATED', 409);
  };
  await useAuthStore.getState().signup('새회원', []);
  expect(calls).toBe(0);
  await useAuthStore.getState().signup('새회원', terms);
  expect(useAuthStore.getState()).toMatchObject({
    status: 'signupRequired',
    ticket: { signupToken: 'ticket' },
    pending: false,
    error: 'NICKNAME_DUPLICATED',
  });
});

test('expired signup ticket returns to Google login without sending signup', async () => {
  useAuthStore.setState({
    status: 'signupRequired',
    ticket: {
      signupToken: 'expired',
      signupExpiresAt: new Date(Date.now() - 1).toISOString(),
    },
  });
  await useAuthStore.getState().signup('새회원', terms);
  expect(useAuthStore.getState()).toMatchObject({
    status: 'signedOut',
    ticket: null,
    pending: false,
  });
});

test('concurrent expired requests share one rotation and retry with the new access token', async () => {
  await authSession.save(pair(), authSession.version());
  const gate = deferred<void>();
  let rotations = 0;
  authHttp.defaults.adapter = async config => {
    rotations++;
    expect(JSON.parse(config.data)).toEqual({ refreshToken: 'refresh-one' });
    await gate.promise;
    return response(config, pair('two'));
  };
  api.defaults.adapter = async config =>
    config.headers.get('Authorization') === 'Bearer access-one'
      ? reject(config, 'ACCESS_TOKEN_EXPIRED')
      : response(config, member);
  const requests = Promise.all([
    api.get('/members/me'),
    api.get('/members/me'),
    api.get('/members/me'),
  ]);
  await flush();
  gate.resolve();
  await requests;
  expect(rotations).toBe(1);
  expect(authSession.current()?.refreshToken).toBe('refresh-two');
});

test('an invalid access token ends session instead of attempting refresh', async () => {
  await authSession.save(pair(), authSession.version());
  const rotation = jest.fn(async (config: InternalAxiosRequestConfig) =>
    response(config, pair('two')),
  );
  authHttp.defaults.adapter = rotation;
  api.defaults.adapter = async config => reject(config, 'ACCESS_TOKEN_INVALID');
  await expect(api.get('/members/me')).rejects.toBeDefined();
  expect(rotation).not.toHaveBeenCalled();
  expect(authSession.current()).toBeNull();
  expect(useAuthStore.getState().status).toBe('signedOut');
});

test('503 during refresh preserves credentials for recovery', async () => {
  await authSession.save(pair(), authSession.version());
  authHttp.defaults.adapter = async config =>
    reject(config, 'AUTH_SERVICE_UNAVAILABLE', 503);
  api.defaults.adapter = async config => reject(config, 'ACCESS_TOKEN_EXPIRED');
  await expect(api.get('/members/me')).rejects.toBeDefined();
  expect(authSession.current()?.refreshToken).toBe('refresh-one');
});

test('late rotation cannot resurrect a cleared session', async () => {
  await authSession.save(pair(), authSession.version());
  const gate = deferred<AuthTokens>();
  authHttp.defaults.adapter = async config =>
    response(config, await gate.promise);
  const rotation = authSession.refreshTokens();
  const rejected = expect(rotation).rejects.toMatchObject({
    code: 'SESSION_CHANGED',
  });
  await flush();
  await authSession.clear();
  jest.mocked(SecureStore.setItemAsync).mockClear();
  gate.resolve(pair('late'));
  await rejected;
  expect(authSession.current()).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('storage failure retries saving issued credentials without logging into Google again', async () => {
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  await useAuthStore.getState().signIn();
  expect(useAuthStore.getState().status).toBe('restorationError');
  await useAuthStore.getState().bootstrap();
  expect(useAuthStore.getState()).toMatchObject({
    status: 'authenticated',
    member,
  });
  expect(googleAuth.signIn).toHaveBeenCalledTimes(1);
});

test('temporary member lookup failure preserves session and does not repeat signup', async () => {
  let reads = 0;
  api.defaults.adapter = async config => {
    if (reads++ === 0) return reject(config, 'AUTH_SERVICE_UNAVAILABLE', 503);
    return response(config, member);
  };
  await useAuthStore.getState().signIn();
  expect(useAuthStore.getState().status).toBe('restorationError');
  expect(authSession.current()).not.toBeNull();
  await useAuthStore.getState().bootstrap();
  expect(useAuthStore.getState().status).toBe('authenticated');
});

test('signout resets account data and cannot restore old saved profile', async () => {
  await useAuthStore.getState().signIn();
  useAppStore.getState().selectEmotion('sad');
  useAppStore.getState().setMemo('private draft');
  useTagStore.setState({
    tags: [
      {
        id: 'custom-1',
        label: '비밀 태그',
        key: '비밀 태그',
        createdAt: '2026-10-26T00:00:00Z',
      },
    ],
    loadStatus: 'ready',
  });
  await useAuthStore.getState().signOut();
  expect(authSession.current()).toBeNull();
  expect(useAuthStore.getState()).toMatchObject({
    status: 'signedOut',
    member: null,
    ticket: null,
    pending: false,
  });
  expect(useAppStore.getState().draft.memo).toBe('');
  // 내 태그도 계정 데이터다. 다음 계정이 로그인하면 서버에서 다시 불러온다.
  expect(useTagStore.getState()).toMatchObject({
    tags: [],
    loadStatus: 'idle',
  });
  expect(googleAuth.clear).toHaveBeenCalled();
});

test('cold start restores saved credentials and the server member', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      baseURL: 'https://api.example.test/api/v1',
      tokens: pair(),
    }),
  );
  useAuthStore.setState({ status: 'restoring' });
  await useAuthStore.getState().bootstrap();
  expect(useAuthStore.getState()).toMatchObject({
    status: 'authenticated',
    member,
  });
  expect(googleAuth.signIn).not.toHaveBeenCalled();
});

test('cold start network outage retains credentials and offers restoration retry', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      baseURL: 'https://api.example.test/api/v1',
      tokens: pair(),
    }),
  );
  api.defaults.adapter = async config =>
    reject(config, 'AUTH_SERVICE_UNAVAILABLE', 503);
  useAuthStore.setState({ status: 'restoring' });
  await useAuthStore.getState().bootstrap();
  expect(useAuthStore.getState().status).toBe('restorationError');
  expect(authSession.current()).not.toBeNull();
});

test('refresh rejection ends the session and stops repeated retries', async () => {
  await authSession.save(pair(), authSession.version());
  let attempts = 0;
  api.defaults.adapter = async config => reject(config, 'ACCESS_TOKEN_EXPIRED');
  authHttp.defaults.adapter = async config => {
    attempts++;
    return reject(config, 'REFRESH_TOKEN_EXPIRED');
  };
  await expect(api.get('/members/me')).rejects.toBeDefined();
  expect(attempts).toBe(1);
  expect(authSession.current()).toBeNull();
});

test('account switch discards an older gacha response without changing the new balance', async () => {
  const gate = deferred<PullItem[]>();
  const spy = jest
    .spyOn(mockGachaService, 'pull')
    .mockReturnValueOnce(gate.promise);
  const old = useGachaStore.getState().pull(1);
  useGachaStore.getState().resetSession();
  gate.resolve([{ id: 'peach', isNew: true, shards: 0 }]);
  expect(await old).toEqual([]);
  expect(useGachaStore.getState().tickets).toBe(23);
  expect(useGachaStore.getState().owned).not.toContain('peach');
  spy.mockRestore();
});

test('an old image-generation failure cannot mutate the new account demo entry', async () => {
  let fail!: (error: Error) => void;
  const promise = new Promise<void>((_, rejectPromise) => {
    fail = rejectPromise;
  });
  jest.spyOn(mockDiaryService, 'retry').mockResolvedValueOnce();
  const spy = jest
    .spyOn(mockDiaryService, 'generate')
    .mockReturnValueOnce(promise);
  const id = 'diary-old-account';
  useAppStore.setState(state => ({
    entries: [
      {
        ...state.entries[0],
        id,
        date: '2026-10-30',
        status: 'draft',
        generation: 'failed',
        failure: null,
      },
      ...state.entries,
    ],
  }));
  const old = useAppStore.getState().generateImage(id);
  useAppStore.getState().resetSession();
  fail(new Error('old generation failed'));
  await old;
  expect(useAppStore.getState().entries).toEqual(createMockEntries());
  spy.mockRestore();
});
