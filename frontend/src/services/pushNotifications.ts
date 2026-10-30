import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

// 그림 결과 푸시 (backend docs/api/auth.md "푸시 토큰 등록", diary.md "그림 결과 푸시").
// 서버는 Expo push token이 아니라 FCM 토큰을 받는다. iOS는 Firebase 설정이 없어 APNs 토큰만
// 나오므로 아직 등록하지 않는다. 웹은 대상이 아니다.
export const pushSupported = () => Platform.OS === 'android';
// app.json expo-notifications 플러그인의 defaultChannel과 같은 값. FCM 알림이 이 채널로 온다.
export const PUSH_CHANNEL = 'default';
const DEVICE_ID_KEY = 'mozzi.device-id';

// 앱이 처음 실행될 때 만들어 계속 쓰는 기기 ID(UUID 형식, 최대 64자). 보안 값이 아니다.
let device: Promise<string> | null = null;
export function deviceId() {
  device ??= (async () => {
    const saved = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (saved) return saved;
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  })().catch(error => {
    device = null;
    throw error;
  });
  return device;
}

// 알림 권한을 확인하고(없으면 한 번 묻는다) FCM 토큰을 서버에 등록한다. 권한이 없으면 등록하지 않는다.
// Android 13+는 채널이 하나라도 있어야 권한 창이 뜨므로 채널을 먼저 만든다.
export async function registerPushToken(token?: string): Promise<boolean> {
  if (!pushSupported()) return false;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: '그림일기 알림',
    importance: AndroidImportance.HIGH,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  const value = token ?? (await Notifications.getDevicePushTokenAsync()).data;
  if (typeof value !== 'string' || !value) return false;
  await api.put('/members/me/push-tokens', {
    token: value,
    platform: 'ANDROID',
    deviceId: await deviceId(),
  });
  return true;
}

export interface DiaryImagePush {
  diaryId: number;
  recordDate: string;
  status: 'SUCCEEDED' | 'FAILED';
}
// 그림 결과 푸시의 data(값은 모두 문자열). 다른 알림이면 null.
// FCM data는 보통 content.data에 오지만, 기기·버전에 따라 trigger의 remoteMessage에만 있을 수 있다.
export function diaryImagePush(
  notification: Notifications.Notification,
): DiaryImagePush | null {
  const { content, trigger } = notification.request;
  const remote =
    trigger && typeof trigger === 'object' && 'remoteMessage' in trigger
      ? (trigger.remoteMessage as { data?: Record<string, unknown> } | null)
          ?.data
      : undefined;
  const data =
    content.data && 'type' in content.data ? content.data : (remote ?? {});
  const diaryId = Number(data.diaryId);
  if (
    data.type !== 'DIARY_IMAGE' ||
    !Number.isSafeInteger(diaryId) ||
    diaryId <= 0 ||
    typeof data.recordDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.recordDate) ||
    (data.status !== 'SUCCEEDED' && data.status !== 'FAILED')
  )
    return null;
  return { diaryId, recordDate: data.recordDate, status: data.status };
}
