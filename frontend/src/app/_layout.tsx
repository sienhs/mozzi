import '../../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { colors, fonts } from '@/theme/tokens';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SPLASH_MIN_MS, Splash } from '@/components/ui/Splash';
import { useMetaStore } from '@/stores/useMetaStore';
import {
  ForceUpdateScreen,
  MetaErrorScreen,
  RecommendedUpdateSheet,
} from '@/features/update/UpdateScreens';

// The native splash only covers font loading; the S-C start screen takes over after it.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { status, error, bootstrap, invalidate } = useAuthStore();
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  // 메타는 로그인과 무관하게 앱 시작 때 함께 부른다. 받기 전에는 버전·약관을 판단할 수 없다.
  const meta = useMetaStore(state => state.meta);
  const metaFailed = useMetaStore(state => state.status === 'error');
  const update = useMetaStore(state => state.update);
  useEffect(() => {
    void useMetaStore.getState().load();
  }, []);
  const [loaded, fontError] = useFonts({
    [fonts.pen]: require('../../assets/fonts/OwnglyphParkDahyun.ttf'),
  });
  const fontsSettled = loaded || !!fontError;
  useEffect(() => {
    if (__DEV__ && fontError)
      console.warn(
        'Handwriting font unavailable; using the system font.',
        fontError.message,
      );
  }, [fontError]);
  const [splashDone, setSplashDone] = useState(SPLASH_MIN_MS <= 0);
  useEffect(() => {
    if (!fontsSettled) return;
    SplashScreen.hide();
    if (splashDone) return;
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, [fontsSettled, splashDone]);
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" hidden={!splashDone} />
        {!fontsSettled ? (
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        ) : !splashDone || (!meta && !metaFailed) || status === 'restoring' ? (
          <Splash />
        ) : !meta ? (
          <MetaErrorScreen />
        ) : update === 'required' ? (
          <ForceUpdateScreen />
        ) : status === 'restorationError' ? (
          <Screen header={false}>
            <ErrorBanner message={error} />
            <Button label="다시 시도" onPress={() => void bootstrap()} />
            <Button
              label="로그인 화면으로"
              variant="secondary"
              onPress={() => void invalidate()}
            />
          </Screen>
        ) : (
          <>
            <RecommendedUpdateSheet />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Protected guard={status === 'signupRequired'}>
                <Stack.Screen name="onboarding" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'authenticated'}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="record/emotion" />
                <Stack.Screen name="record/tags" />
                <Stack.Screen name="record/activity" />
                <Stack.Screen name="record/generation" />
                <Stack.Screen name="diary/[id]" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="mypage/owned" />
                <Stack.Screen name="mypage/mochi/[id]" />
                <Stack.Screen
                  name="gacha/opening"
                  options={{ animation: 'fade', gestureEnabled: false }}
                />
                <Stack.Screen
                  name="gacha/reveal"
                  options={{ animation: 'fade' }}
                />
                <Stack.Screen
                  name="gacha/results"
                  options={{ animation: 'fade' }}
                />
                <Stack.Screen
                  name="gacha/failed"
                  options={{ animation: 'fade' }}
                />
                <Stack.Screen name="gacha/collection" />
                <Stack.Screen name="gacha/mochi/[id]" />
                <Stack.Screen name="gacha/exchange" />
                <Stack.Screen name="gacha/exchange-confirm" />
                <Stack.Screen
                  name="gacha/exchanged"
                  options={{ animation: 'fade' }}
                />
              </Stack.Protected>
              <Stack.Protected guard={__DEV__}>
                <Stack.Screen name="dev" />
              </Stack.Protected>
            </Stack>
          </>
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
