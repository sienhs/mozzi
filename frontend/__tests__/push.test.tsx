import { render } from '@testing-library/react-native';
import { act } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { PushNotifications } from '@/features/push/PushNotifications';
import { api } from '@/services/api';
import { diaryKeys } from '@/services/diaryApi';
import {
  diaryImagePush,
  registerPushToken,
} from '@/services/pushNotifications';
import { queryClient } from '@/services/queryClient';
import { setAuthPreview } from '@/mocks/authPreview';
import { createFakeServer, type FakeServer } from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

type Listeners = {
  token: Set<(token: { type: string; data: unknown }) => void>;
  received: Set<(notification: Notifications.Notification) => void>;
};
const listeners = () =>
  (jest.requireMock('expo-notifications') as { __listeners: Listeners })
    .__listeners;
const notification = (
  data: Record<string, unknown>,
  identifier = 'n-1',
): Notifications.Notification =>
  ({
    date: 0,
    request: {
      identifier,
      content: { title: '그림일기가 완성됐어요', body: '', data },
      trigger: { type: 'push' },
    },
  }) as unknown as Notifications.Notification;
const imagePush = {
  type: 'DIARY_IMAGE',
  diaryId: '501',
  recordDate: '2026-10-28',
  status: 'SUCCEEDED',
  imageUrl: 'https://cdn.example.test/diary/501.webp',
};
const MEMBER = 0; // setAuthPreview의 회원
let server: FakeServer;
const registrations = () =>
  server.callsTo('PUT', '/members/me/push-tokens').map(call => call.body);

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  server = createFakeServer('2026-10-28');
  api.defaults.adapter = server.adapter;
  setAuthPreview();
});
afterEach(() => {
  jest.restoreAllMocks();
  queryClient.clear();
});

test('registers the FCM token with a device id that stays the same', async () => {
  expect(await registerPushToken()).toBe(true);
  expect(await registerPushToken('fcm-token-2')).toBe(true);
  const [first, second] = registrations();
  expect(first).toEqual({
    token: 'fcm-token-1',
    platform: 'ANDROID',
    deviceId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
  });
  // 토큰이 바뀌어도 같은 기기로 덮어쓴다.
  expect(second).toEqual({ ...first, token: 'fcm-token-2' });
  expect(server.state.pushTokens.size).toBe(1);
  // Android 13+ 권한 창이 뜨도록 채널을 먼저 만든다.
  expect(
    jest.mocked(Notifications.setNotificationChannelAsync).mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(Notifications.getPermissionsAsync).mock.invocationCallOrder[0],
  );
});

test('asks for permission once and does not register when it is refused', async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
  jest
    .mocked(Notifications.requestPermissionsAsync)
    .mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
  expect(await registerPushToken()).toBe(false);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(registrations()).toHaveLength(0);

  // 다시 묻지 못하게 막혔으면 창을 띄우지 않는다.
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
  expect(await registerPushToken()).toBe(false);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('iOS and web do not register (the server only takes FCM tokens)', async () => {
  for (const os of ['ios', 'web'] as const) {
    jest.replaceProperty(Platform, 'OS', os);
    expect(await registerPushToken()).toBe(false);
  }
  expect(Notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  expect(registrations()).toHaveLength(0);
});

test('only well-formed diary image pushes are recognised', () => {
  expect(diaryImagePush(notification(imagePush))).toEqual({
    diaryId: 501,
    recordDate: '2026-10-28',
    status: 'SUCCEEDED',
  });
  // 기기에 따라 FCM data가 trigger의 remoteMessage에만 있다.
  expect(
    diaryImagePush({
      date: 0,
      request: {
        identifier: 'n-2',
        content: { title: null, body: null, data: {} },
        trigger: { type: 'push', remoteMessage: { data: imagePush } },
      },
    } as unknown as Notifications.Notification),
  ).toMatchObject({ diaryId: 501 });
  for (const data of [
    { ...imagePush, type: 'OTHER' },
    { ...imagePush, diaryId: 'abc' },
    { ...imagePush, recordDate: '10/28' },
    { ...imagePush, status: 'PENDING' },
    {},
  ])
    expect(diaryImagePush(notification(data))).toBeNull();
});

test('signing in registers the token, a received picture push refreshes diaries, and a token change re-registers', async () => {
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  await render(<PushNotifications />);
  await act(async () => undefined);
  expect(registrations()).toHaveLength(1);
  expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);

  await act(async () =>
    listeners().received.forEach(listener =>
      listener(notification({ type: 'OTHER' })),
    ),
  );
  expect(invalidate).not.toHaveBeenCalled();
  await act(async () =>
    listeners().received.forEach(listener => listener(notification(imagePush))),
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: diaryKeys.all(MEMBER),
  });

  await act(async () =>
    listeners().token.forEach(listener =>
      listener({ type: 'android', data: 'fcm-token-new' }),
    ),
  );
  expect(registrations().at(-1)).toMatchObject({ token: 'fcm-token-new' });
});

test('tapping a picture notification opens that day once', async () => {
  const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
  const tapped = {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: notification(imagePush, 'tap-1'),
  };
  jest
    .mocked(Notifications.useLastNotificationResponse)
    .mockReturnValue(tapped as never);
  const view = await render(<PushNotifications />);
  await act(async () => undefined);
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith({
    pathname: '/diary/[id]',
    params: { id: '501', date: '2026-10-28' },
  });
  expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  // 같은 응답으로 다시 그려져도 한 번만 이동한다.
  await view.rerender(<PushNotifications />);
  await act(async () => undefined);
  expect(push).toHaveBeenCalledTimes(1);
});
