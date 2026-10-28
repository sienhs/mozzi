import RootLayout from '@/app/_layout';
import Welcome from '@/app/index';
import Onboarding from '@/app/onboarding';
import Tabs from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/home';
import {
  cleanup,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import { authTransport } from '@/services/authTransport';
import { authSession } from '@/services/authSession';
import { googleAuth } from '@/services/googleAuth';
import { getMember } from '@/services/memberApi';
import { useAuthStore } from '@/stores/useAuthStore';

jest.mock('@/services/googleAuth', () => ({
  googleAuth: { signIn: jest.fn(), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/services/authTransport', () => ({
  authTransport: { google: jest.fn(), signup: jest.fn(), refresh: jest.fn() },
}));
jest.mock('@/services/memberApi', () => ({ getMember: jest.fn() }));
jest.mock('@/services/authConfig', () => ({
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
  authConfig: {
    terms: {
      TERMS: { url: 'https://example.test/terms', version: '1.0' },
      PRIVACY: { url: 'https://example.test/privacy', version: '1.0' },
    },
  },
}));
const routes = {
  _layout: RootLayout,
  index: Welcome,
  onboarding: Onboarding,
  '(tabs)/_layout': Tabs,
  '(tabs)/home': Home,
};
const pair = () => ({
  accessToken: 'access',
  refreshToken: 'refresh',
  accessExpiresAt: new Date(Date.now() + 1800000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
});
beforeEach(async () => {
  jest.clearAllMocks();
  await authSession.clear();
  useAuthStore.setState({
    status: 'signedOut',
    pending: false,
    member: null,
    ticket: null,
    error: '',
  });
  jest.mocked(googleAuth.signIn).mockResolvedValue('google-id-token');
  jest.mocked(getMember).mockResolvedValue({
    memberId: 7,
    nickname: '회원',
    email: 'member@example.com',
  });
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

test('existing Google member moves from welcome directly to home', async () => {
  jest
    .mocked(authTransport.google)
    .mockResolvedValue({ status: 'LOGIN_SUCCESS', ...pair() });
  const app = await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  );
  await waitFor(() => expect(app.getPathname()).toBe('/home'));
  expect(authTransport.signup).not.toHaveBeenCalled();
});

test('new member can consent without opening documents but must agree to both before signup', async () => {
  jest.mocked(authTransport.google).mockResolvedValue({
    status: 'SIGNUP_REQUIRED',
    signupToken: 'ticket',
    signupExpiresAt: new Date(Date.now() + 600000).toISOString(),
  });
  jest.mocked(authTransport.signup).mockResolvedValue(pair());
  const app = await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  );
  await waitFor(() => expect(app.getPathname()).toBe('/onboarding'));
  expect(screen.queryByText('ha***@gmail.com')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('닉네임'), '새회원');
  expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
  expect(screen.queryByText('본문을 먼저 확인해 주세요.')).toBeNull();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: '이용약관 동의 (필수)' }),
  );
  expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: '개인정보 처리방침 동의 (필수)' }),
  );
  expect(screen.getByRole('button', { name: '시작하기' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: '시작하기' }));
  await waitFor(() => expect(app.getPathname()).toBe('/home'));
  expect(authTransport.signup).toHaveBeenCalledWith('ticket', '새회원', [
    { type: 'TERMS', version: '1.0' },
    { type: 'PRIVACY', version: '1.0' },
  ]);
});

test('without a signup ticket a direct onboarding link cannot grant access', async () => {
  const app = await renderRouter(routes, { initialUrl: '/onboarding' });
  await waitFor(() => expect(app.getPathname()).toBe('/'));
});

test('restored session entering the root route reaches home', async () => {
  await authSession.save(pair(), authSession.version());
  useAuthStore.setState({ status: 'restoring' });
  const app = await renderRouter(routes, { initialUrl: '/' });
  await waitFor(() => expect(app.getPathname()).toBe('/home'));
  expect(getMember).toHaveBeenCalled();
  expect(authTransport.google).not.toHaveBeenCalled();
});
