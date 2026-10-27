import '../../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr/500Medium';
import { NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr/700Bold';
import { View } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useAppStore } from '@/stores/useAppStore';
import { colors } from '@/theme/tokens';
import { ErrorBanner, Loading } from '@/components/ui/Feedback';

export default function RootLayout() {
  const profile = useAppStore(state => state.profile);
  const [loaded, fontError] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!loaded && !fontError ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              backgroundColor: colors.bg,
            }}
          >
            <Loading label="모찌의 기록실을 열고 있어요" />
          </View>
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
                <Stack.Screen name="home" />
                <Stack.Screen name="record/emotion" />
                <Stack.Screen name="record/memo" />
                <Stack.Screen name="record/generation" />
                <Stack.Screen name="calendar" />
                <Stack.Screen name="diary/[id]" />
                <Stack.Screen name="search" />
                <Stack.Screen name="settings" />
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
