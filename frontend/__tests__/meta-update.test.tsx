import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import Welcome from '@/app/index';
import { fetchMeta } from '@/services/metaApi';
import { useMetaStore } from '@/stores/useMetaStore';
import { parseMeta } from '@/types/server';
import {
  appUpdateUrl,
  compareVersions,
  installedAppVersion,
  updateRequirement,
} from '@/utils/appVersion';

jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  openURL: jest.fn(async () => true),
}));
// Jest의 expo-constants에는 앱 버전이 없다. 설치 버전 1.2.0인 앱으로 본다.
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  const constants = actual.default ?? actual;
  return {
    __esModule: true,
    ...actual,
    default: {
      ...constants,
      expoConfig: { ...constants.expoConfig, version: '1.2.0' },
    },
  };
});

const routes = { _layout: RootLayout, index: Welcome };
const meta = (minSupportedVersion: string, latestVersion: string) => ({
  termsVersions: { TERMS: '1.0', PRIVACY: '1.0' },
  minSupportedVersion,
  latestVersion,
});
const installed = Constants.expoConfig!.version!;
beforeEach(() => {
  useMetaStore.setState({
    meta: null,
    status: 'idle',
    error: '',
    update: 'none',
    updateDismissed: false,
  });
  delete process.env.EXPO_PUBLIC_APP_UPDATE_URL;
});
afterEach(async () => {
  await cleanup();
});

test('versions compare each part as a number and the forced update wins', () => {
  expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  expect(compareVersions('1.9.9', '1.10.0')).toBe(-1);
  expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
  expect(updateRequirement('1.0.0', meta('1.1.0', '1.2.0'))).toBe('required');
  expect(updateRequirement('1.1.0', meta('1.1.0', '1.2.0'))).toBe(
    'recommended',
  );
  expect(updateRequirement('1.2.0', meta('1.1.0', '1.2.0'))).toBe('none');
  expect(updateRequirement('1.10.0', meta('1.9.0', '1.9.5'))).toBe('none');
  // 설치 버전을 모르면 막지 않는다.
  expect(updateRequirement(null, meta('9.0.0', '9.0.0'))).toBe('none');
  expect(installedAppVersion()).toBe('1.2.0');
  expect(installed).toBe('1.2.0');
});

test('meta responses without a terms version or with a malformed version are rejected, not filled in', () => {
  expect(() =>
    parseMeta({ ...meta('1.0.0', '1.0.0'), termsVersions: { TERMS: '1.0' } }),
  ).toThrow();
  expect(() => parseMeta(meta('01.0.0', '1.0.0'))).toThrow();
  expect(parseMeta(meta('1.0.0', '1.2.0')).latestVersion).toBe('1.2.0');
});

test('concurrent loads share one request, and a failure keeps no meta until a retry succeeds', async () => {
  jest.mocked(fetchMeta).mockClear();
  jest.mocked(fetchMeta).mockRejectedValueOnce(new Error('down'));
  const first = useMetaStore.getState().load();
  const second = useMetaStore.getState().load();
  expect(second).toBe(first);
  expect(await first).toBeNull();
  expect(fetchMeta).toHaveBeenCalledTimes(1);
  expect(useMetaStore.getState()).toMatchObject({
    status: 'error',
    meta: null,
  });
  await useMetaStore.getState().load();
  expect(useMetaStore.getState().status).toBe('ready');
  expect(useMetaStore.getState().meta).not.toBeNull();
});

test('a failed meta call blocks entry with a retry instead of assuming a normal response', async () => {
  jest.mocked(fetchMeta).mockRejectedValueOnce(new Error('down'));
  await renderRouter(routes, { initialUrl: '/' });
  expect(
    await screen.findByText('앱 정보를 불러오지 못했어요'),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Google로 시작하기' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(
    await screen.findByRole('button', { name: 'Google로 시작하기' }),
  ).toBeOnTheScreen();
});

test('below the minimum version the app stops at the update screen; without a configured link no URL is invented', async () => {
  jest.mocked(fetchMeta).mockResolvedValueOnce(meta('99.0.0', '99.0.0'));
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('업데이트가 필요해요')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Google로 시작하기' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: '업데이트하기' })).toBeNull();
  expect(
    screen.getByText(/업데이트 받을 곳이 아직 준비되지 않았어요/),
  ).toBeOnTheScreen();
  expect(appUpdateUrl()).toBeNull();
});

test('a recommended update can be dismissed and opens the configured link', async () => {
  process.env.EXPO_PUBLIC_APP_UPDATE_URL = 'https://example.test/mozzi';
  jest.mocked(fetchMeta).mockResolvedValueOnce(meta(installed, '99.0.0'));
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('새 버전이 나왔어요')).toBeOnTheScreen();
  // 계속 쓸 수 있다.
  expect(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '업데이트하기' }));
  expect(Linking.openURL).toHaveBeenCalledWith('https://example.test/mozzi');
  await fireEvent.press(screen.getByRole('button', { name: '나중에 할게요' }));
  await act(async () => undefined);
  expect(screen.queryByText('새 버전이 나왔어요')).toBeNull();
  expect(useMetaStore.getState().updateDismissed).toBe(true);
});
