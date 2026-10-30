import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { ConfirmModal, Sheet } from '@/components/ui/Sheet';
import { ErrorBanner } from '@/components/ui/Feedback';
import { EmotionImage } from '@/components/emotion/Emotion';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/useAuthStore';
import { apiErrorMessage } from '@/services/authErrors';

export function SettingsScreen() {
  const profile = useAuthStore(state => state.member);
  const [logout, setLogout] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const pending = useAuthStore(state => state.pending);
  const [panel, setPanel] = useState('');
  async function confirmWithdraw() {
    setWithdrawError('');
    try {
      await useAuthStore.getState().withdraw();
    } catch (error) {
      setWithdrawError(
        apiErrorMessage(error, '탈퇴하지 못했어요. 다시 시도해 주세요.'),
      );
    }
  }
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
          onPress={() => {
            setWithdrawError('');
            setWithdraw(true);
          }}
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
        visible={withdraw}
        title="탈퇴할까요?"
        onClose={() => {
          if (!pending) setWithdraw(false);
        }}
      >
        <AppText style={{ textAlign: 'center', color: colors.muted }}>
          {
            '남긴 기록과 그림, 모은 모찌가 모두 지워져요.\n지운 내용은 되돌릴 수 없어요.'
          }
        </AppText>
        {!!withdrawError && <ErrorBanner message={withdrawError} />}
        <Button
          label="탈퇴하기"
          loading={pending}
          onPress={() => void confirmWithdraw()}
        />
        <Button
          label="취소"
          variant="secondary"
          disabled={pending}
          onPress={() => setWithdraw(false)}
        />
      </Sheet>
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
        ) : null}
      </Sheet>
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
