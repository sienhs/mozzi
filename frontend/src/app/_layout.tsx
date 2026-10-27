import '../../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { NanumPenScript_400Regular } from '@expo-google-fonts/nanum-pen-script/400Regular';
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr/500Medium';
import { NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr/700Bold';
import { View } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useAppStore } from '@/stores/useAppStore';
import { colors } from '@/theme/tokens';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SPLASH_MIN_MS, Splash } from '@/components/ui/Splash';

// The native splash only covers font loading; the S-C start screen takes over after it.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const profile = useAppStore(state => state.profile);
  const [loaded, fontError] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
    NanumPenScript_400Regular,
  });
  const fontsSettled = loaded || !!fontError;
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
        ) : !splashDone ? (
          <Splash />
        ) : (
          <>
            {fontError && (
              <ErrorBanner message="글꼴을 불러오지 못해 기본 글꼴로 표시해요." />
            )}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Protected guard={!profile}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
              </Stack.Protected>
              <Stack.Protected guard={!!profile}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="record/emotion" />
                <Stack.Screen name="record/memo" />
                <Stack.Screen name="record/generation" />
                <Stack.Screen name="diary/[id]" />
                <Stack.Screen name="settings" />
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
