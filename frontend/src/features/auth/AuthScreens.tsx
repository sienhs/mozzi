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
import { LegalDocument, useLegalDocument } from '@/components/ui/LegalDocument';
import { legalLabels, legalTypes, type LegalType } from '@/constants/legal';
import { Checkbox } from '@/components/ui/Selection';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMetaStore } from '@/stores/useMetaStore';
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
        eyebrow="하루 한 장, 마음 한 조각"
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
  // 동의한 본문의 버전을 기억한다. 서버 버전이 바뀌면 그 동의는 더 이상 유효하지 않다.
  const [agreed, setAgreed] = useState<Record<LegalType, string | null>>({
    TERMS: null,
    PRIVACY: null,
  });
  const [document, setDocument] = useState<LegalType | null>(null);
  const meta = useMetaStore(state => state.meta);
  const metaLoading = useMetaStore(state => state.status === 'loading');
  // 서버에서 받은 본문의 버전이 가입에 필요한 버전(GET /meta)과 같을 때만 그 본문으로 동의를 받는다.
  const documents = {
    TERMS: useLegalDocument('TERMS'),
    PRIVACY: useLegalDocument('PRIVACY'),
  };
  const versionOf = (type: LegalType) => {
    const version = documents[type].data?.version;
    return version && meta?.termsVersions[type] === version ? version : null;
  };
  const termsReady = legalTypes.every(type => !!versionOf(type));
  const documentsLoading = legalTypes.some(type => documents[type].isFetching);
  const documentsFailed = legalTypes.some(type => documents[type].isError);
  function reloadTerms() {
    if (!metaLoading) void useMetaStore.getState().load();
    for (const type of legalTypes) void documents[type].refetch();
  }
  const isAgreed = (type: LegalType) =>
    !!agreed[type] && agreed[type] === versionOf(type);
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
              !legalTypes.every(isAgreed)
            }
            onPress={async () => {
              await signup(
                nickname,
                legalTypes.map(type => ({ type, version: agreed[type]! })),
              );
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
          <>
            <AppText variant="small">
              {!meta || documentsFailed
                ? '약관 정보를 불러오지 못했어요. 다시 확인해 주세요.'
                : documentsLoading
                  ? '약관을 불러오고 있어요.'
                  : '약관이 새로 바뀌었어요. 잠시 후 다시 확인해 주세요.'}
            </AppText>
            <TextButton
              label={
                metaLoading || documentsLoading
                  ? '확인하고 있어요'
                  : '약관 다시 확인하기'
              }
              onPress={() => {
                if (!documentsLoading) reloadTerms();
              }}
            />
          </>
        ) : (
          legalTypes.map(type => (
            <View key={type}>
              <TextButton
                label={`${legalLabels[type]} 보기`}
                onPress={() => setDocument(type)}
              />
              <Checkbox
                label={`${legalLabels[type]} 동의 (필수)`}
                checked={isAgreed(type)}
                onChange={checked => {
                  if (!pending)
                    setAgreed(value => ({
                      ...value,
                      [type]: checked ? versionOf(type) : null,
                    }));
                }}
              />
            </View>
          ))
        )}
      </View>
      <Sheet
        visible={document !== null}
        title={
          document
            ? (documents[document].data?.title ?? legalLabels[document])
            : ''
        }
        onClose={() => setDocument(null)}
      >
        {document && <LegalDocument type={document} />}
        <Button label="닫기" onPress={() => setDocument(null)} />
      </Sheet>
    </Screen>
  );
}
