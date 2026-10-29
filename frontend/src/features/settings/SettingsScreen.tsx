import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { ConfirmModal, Sheet } from '@/components/ui/Sheet';
import { EmotionImage } from '@/components/emotion/Emotion';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/useAuthStore';

export function SettingsScreen() {
  const profile = useAuthStore(state => state.member);
  const [logout, setLogout] = useState(false);
  const [panel, setPanel] = useState('');
  return (
    <Screen title="설정" back contentStyle={{ gap: 24 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="프로필 정보"
        onPress={() => {
          setPanel('프로필');
        }}
        style={{
          padding: 16,
          backgroundColor: colors.white,
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <EmotionImage emotion="happy" size={28} />
        <View style={{ flex: 1 }}>
          <AppText variant="label">{profile?.nickname}</AppText>
          <AppText variant="caption">{profile?.email} · Google</AppText>
        </View>
        <Icon name="chevronRight" color={colors.muted} />
      </Pressable>
      <View>
        <AppText variant="caption">정보</AppText>
        <SettingsRow label="이용약관" onPress={() => setPanel('이용약관')} />
        <SettingsRow
          label="개인정보 처리방침"
          onPress={() => setPanel('개인정보 처리방침')}
        />
        <SettingsRow label="앱 버전" value="1.0.0" />
      </View>
      <View>
        <AppText variant="caption">계정</AppText>
        <SettingsRow
          label="로그아웃"
          onPress={() => setLogout(true)}
          chevron={false}
        />
        <SettingsRow
          label="회원 탈퇴"
          muted
          onPress={() => setPanel('회원 탈퇴')}
          chevron={false}
        />
      </View>
      <ConfirmModal
        visible={logout}
        title="로그아웃할까요?"
        description={'이 기기의 로그인 정보를 정리하고 시작 화면으로 이동해요.'}
        confirmLabel="로그아웃"
        onClose={() => setLogout(false)}
        onConfirm={() => {
          setLogout(false);
          void useAuthStore.getState().signOut();
        }}
      />
      <Sheet
        visible={!!panel}
        title={panel === '프로필' ? '모찌가 부를 이름' : panel}
        onClose={() => setPanel('')}
      >
        {panel === '프로필' ? (
          <>
            <AppText variant="label">{profile?.nickname}</AppText>
            <AppText>{profile?.email}</AppText>
            <AppText variant="small">
              닉네임은 가입 후 변경할 수 없어요.
            </AppText>
            <Button label="확인" onPress={() => setPanel('')} />
          </>
        ) : panel === '이용약관' || panel === '개인정보 처리방침' ? (
          <>
            <LegalDocument type={panel === '이용약관' ? 'TERMS' : 'PRIVACY'} />
            <Button label="확인" onPress={() => setPanel('')} />
          </>
        ) : (
          <>
            <AppText style={{ textAlign: 'center', color: colors.muted }}>
              {panel === '회원 탈퇴'
                ? '회원 탈퇴 기능을 연결하고 있어요. 준비가 완료되면 안내해 드릴게요.'
                : `${panel}은 정식 서비스 시작 전에 안내해 드릴게요.`}
            </AppText>
            <Button
              label="확인"
              variant="secondary"
              onPress={() => setPanel('')}
            />
          </>
        )}
      </Sheet>
      {__DEV__ && (
        <SettingsRow
          label="개발용 화면 미리보기"
          onPress={() => router.push('/dev')}
        />
      )}
    </Screen>
  );
}
function SettingsRow({
  label,
  value,
  onPress,
  muted,
  chevron = true,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  muted?: boolean;
  chevron?: boolean;
}) {
  const children = (
    <>
      <AppText style={{ flex: 1, color: muted ? colors.muted : colors.ink }}>
        {label}
      </AppText>
      {value && <AppText variant="small">{value}</AppText>}
      {onPress && chevron && <Icon name="chevronRight" color={colors.muted} />}
    </>
  );
  const style = {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}
