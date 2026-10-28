import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button, TextButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { ErrorBanner } from '@/components/ui/Feedback';
import { DiaryArtwork } from '@/components/ui/DiaryCard';
import { Sheet } from '@/components/ui/Sheet';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { legalDocuments, type LegalType } from '@/constants/legal';
import { Checkbox } from '@/components/ui/Selection';
import { colors } from '@/theme/tokens';
import { authConfig } from '@/services/authConfig';
import { useAuthStore } from '@/stores/useAuthStore';
import { validNickname } from '@/types/auth';

export function WelcomeScreen() {
  const { status, pending, error, signIn } = useAuthStore();
  if (status === 'authenticated') return <Redirect href="/home" />;
  if (status === 'signupRequired') return <Redirect href="/onboarding" />;
  return (
    <Screen
      header={false}
      contentStyle={{ paddingTop: 56, gap: 32 }}
      footer={
        <>
          {!!error && <ErrorBanner message={error} />}
          <Button
            label={pending ? 'Google 계정 확인 중' : 'Google로 시작하기'}
            variant="google"
            loading={pending}
            onPress={async () => {
              await signIn();
              const next = useAuthStore.getState().status;
              if (next === 'authenticated') router.replace('/home');
              else if (next === 'signupRequired') router.replace('/onboarding');
            }}
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
      {/* 시작 화면 그림은 기록 그림(1:1)과 별개로 기존 3:2를 유지한다. */}
      <DiaryArtwork ratio={3 / 2} />
    </Screen>
  );
}

export function OnboardingScreen() {
  const { status, ticket, pending, error, signup, cancelSignup } =
    useAuthStore();
  const [nickname, setNickname] = useState('');
  const [touched, setTouched] = useState(false);
  const [agreed, setAgreed] = useState({ TERMS: false, PRIVACY: false });
  const [document, setDocument] = useState<LegalType | null>(null);
  const termsReady =
    !!legalDocuments.TERMS.body && !!legalDocuments.PRIVACY.body;
  if (status === 'authenticated') return <Redirect href="/home" />;
  if (status !== 'signupRequired' || !ticket) return <Redirect href="/" />;
  return (
    <Screen
      title="Google로 시작"
      back
      onBack={() => {
        cancelSignup();
        router.replace('/');
      }}
      footer={
        <>
          {!!error && <ErrorBanner message={error} />}
          <Button
            label={pending ? '가입하고 있어요' : '시작하기'}
            loading={pending}
            disabled={
              !validNickname(nickname) ||
              !termsReady ||
              !agreed.TERMS ||
              !agreed.PRIVACY
            }
            onPress={async () => {
              await signup(nickname, [
                { type: 'TERMS', version: authConfig.terms.TERMS.version },
                { type: 'PRIVACY', version: authConfig.terms.PRIVACY.version },
              ]);
              if (useAuthStore.getState().status === 'authenticated')
                router.replace('/home');
            }}
          />
        </>
      }
    >
      <Heading
        title={'Google 계정으로\n처음 오셨네요'}
        description="모찌가 부를 이름을 정해 주세요."
      />
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="google" size={20} />
        <AppText variant="label">Google 계정 연결됨</AppText>
      </View>
      <Input
        label="닉네임"
        value={nickname}
        editable={!pending}
        onChangeText={value => {
          setNickname(value);
          setTouched(true);
        }}
        maxLength={12}
        autoCapitalize="none"
        helper="2~12자의 한글, 영문, 숫자"
        error={
          touched && !validNickname(nickname)
            ? '닉네임은 2~12자의 한글, 영문, 숫자로 입력해 주세요.'
            : undefined
        }
      />
      <View style={{ gap: 8 }}>
        <AppText variant="label">필수 약관 동의</AppText>
        {!termsReady ? (
          <AppText variant="small">
            가입에 필요한 약관을 준비하고 있어요. 준비가 완료되면 가입할 수
            있어요.
          </AppText>
        ) : (
          (['TERMS', 'PRIVACY'] as const).map(type => (
            <View key={type}>
              <TextButton
                label={`${type === 'TERMS' ? '이용약관' : '개인정보 처리방침'} 보기`}
                onPress={() => setDocument(type)}
              />
              <Checkbox
                label={`${type === 'TERMS' ? '이용약관' : '개인정보 처리방침'} 동의 (필수)`}
                checked={agreed[type]}
                onChange={checked => {
                  if (!pending)
                    setAgreed(value => ({ ...value, [type]: checked }));
                }}
              />
            </View>
          ))
        )}
      </View>
      <Sheet
        visible={document !== null}
        title={document ? legalDocuments[document].title : ''}
        onClose={() => setDocument(null)}
      >
        {document && <LegalDocument type={document} />}
        <Button label="닫기" onPress={() => setDocument(null)} />
      </Sheet>
    </Screen>
  );
}
