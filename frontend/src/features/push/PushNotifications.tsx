import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { diaryKeys } from '@/services/diaryApi';
import {
  diaryImagePush,
  pushSupported,
  registerPushToken,
} from '@/services/pushNotifications';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/useAuthStore';

// 로그인한 동안만 붙는다(루트 레이아웃). 앱 시작·로그인 때마다 FCM 토큰을 등록하고,
// 그림 결과 푸시가 오면 일기를 다시 읽고, 알림을 누르면 그날 기록으로 간다.
export function PushNotifications() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!pushSupported() || memberId === undefined) return;
    // 앱이 켜져 있을 때도 알림을 띄운다. 그림 결과는 홈이 다시 읽어 화면에도 반영한다.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    // 등록이 안 돼도 앱은 홈을 다시 읽어 그림 결과를 확인한다. 화면을 막지 않는다.
    void registerPushToken().catch(() => undefined);
    const token = Notifications.addPushTokenListener(({ data }) => {
      if (typeof data === 'string')
        void registerPushToken(data).catch(() => undefined);
    });
    const received = Notifications.addNotificationReceivedListener(
      notification => {
        if (diaryImagePush(notification))
          void queryClient.invalidateQueries({
            queryKey: diaryKeys.all(memberId),
          });
      },
    );
    return () => {
      token.remove();
      received.remove();
    };
  }, [memberId]);

  useEffect(() => {
    if (!pushSupported() || !response || memberId === undefined) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    void Notifications.clearLastNotificationResponseAsync().catch(
      () => undefined,
    );
    const push = diaryImagePush(response.notification);
    if (!push) return;
    void queryClient.invalidateQueries({ queryKey: diaryKeys.all(memberId) });
    router.push({
      pathname: '/diary/[id]',
      params: { id: String(push.diaryId), date: push.recordDate },
    });
  }, [response, memberId]);

  return null;
}
