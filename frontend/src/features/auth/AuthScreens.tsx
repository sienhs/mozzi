import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { ErrorBanner } from '@/components/ui/Feedback';
import { DiaryArtwork } from '@/components/ui/DiaryCard';
import { colors } from '@/theme/tokens';
import { mockAuthService } from '@/mocks/services';
import { useAppStore } from '@/stores/useAppStore';

export function WelcomeScreen() {
  const profile = useAppStore(state => state.profile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  if (profile) return <Redirect href="/home" />;
  async function signIn() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      await mockAuthService.signIn();
      router.push('/onboarding');
    } catch (error) {
      setError(error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <Screen
      header={false}
      contentStyle={{ paddingTop: 56, gap: 32 }}
      footer={
        <>
          {!!error && <ErrorBanner message={error} />}
          <Button
            label={loading ? 'Google 계정 확인 중' : 'Google로 시작하기'}
            variant="google"
            loading={loading}
            onPress={() => void signIn()}
          />
        </>
      }
    >
      <Heading
        display
        title="오늘의 모찌"
        description={
          '하루를 한 장의 그림으로 남겨요.\n모찌가 오늘의 장면을 그려 줄게요.'
        }
      />
      <DiaryArtwork />
    </Screen>
  );
}

export function OnboardingScreen() {
  const [nickname, setNickname] = useState('하루');
  const [touched, setTouched] = useState(false);
  const login = useAppStore(state => state.login);
  const valid = nickname.trim().length >= 2 && nickname.trim().length <= 10;
  return (
    <Screen
      title="Google로 시작"
      back
      footer={
        <>
          <Button
            label="시작하기"
            disabled={!valid}
            onPress={() => {
              login(nickname.trim());
              router.replace('/home');
            }}
          />
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
          </AppText>
        </>
      }
    >
      <Heading
        title={'Google 계정으로\n처음 오셨네요'}
        description="모찌가 부를 이름만 정하면 바로 시작해요."
      />
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="google" size={20} />
        </View>
        <View>
          <AppText variant="label">Google 계정 연결됨</AppText>
          <AppText variant="small">ha***@gmail.com</AppText>
        </View>
      </View>
      <Input
        label="닉네임"
        value={nickname}
        onChangeText={value => {
          setNickname(value);
          setTouched(true);
        }}
        maxLength={10}
        autoCapitalize="none"
        helper="2~10자, 나중에 설정에서 바꿀 수 있어요"
        error={
          touched && !valid ? '닉네임을 2~10자로 입력해 주세요.' : undefined
        }
        returnKeyType="done"
      />
    </Screen>
  );
}
