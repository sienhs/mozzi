import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Sheet } from '@/components/ui/Sheet';
import { EmotionImage } from '@/components/emotion/Emotion';
import { colors } from '@/theme/tokens';
import { useAppStore } from '@/stores/useAppStore';

export function SettingsScreen() {
  const profile = useAppStore(state => state.profile);
  const [logout, setLogout] = useState(false);
  const [panel, setPanel] = useState('');
  const [nickname, setNickname] = useState(profile?.nickname ?? '하루');
  const valid = nickname.trim().length >= 2 && nickname.trim().length <= 10;
  return (
    <Screen title="설정" back contentStyle={{ gap: 24 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닉네임 변경"
        onPress={() => {
          setNickname(profile?.nickname ?? '하루');
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
        <AppText variant="caption">기록</AppText>
        <SettingsRow
          label="기록 알림"
          value="오후 9:00"
          onPress={() => setPanel('기록 알림')}
        />
        <SettingsRow
          label="그림 저장 위치"
          value="앨범"
          onPress={() => setPanel('그림 저장 위치')}
        />
      </View>
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
        description={
          '남긴 기록은 그대로 있어요.\n다시 로그인하면 이어서 볼 수 있어요.'
        }
        confirmLabel="로그아웃"
        onClose={() => setLogout(false)}
        onConfirm={() => {
          setLogout(false);
          useAppStore.getState().logout();
        }}
      />
      <Sheet
        visible={!!panel}
        title={panel === '프로필' ? '모찌가 부를 이름' : panel}
        onClose={() => setPanel('')}
      >
        {panel === '프로필' ? (
          <>
            <Input
              label="닉네임"
              value={nickname}
              onChangeText={setNickname}
              maxLength={10}
              helper="2~10자로 입력해 주세요"
            />
            <Button
              label="저장하기"
              disabled={!valid}
              onPress={() => {
                useAppStore.getState().login(nickname.trim());
                setPanel('');
              }}
            />
          </>
        ) : (
          <>
            <AppText style={{ textAlign: 'center', color: colors.muted }}>
              {panel === '기록 알림'
                ? '기록 알림은 준비 중이에요.'
                : panel === '그림 저장 위치'
                  ? '그림은 앱의 기록실에서 볼 수 있어요.\n앨범 저장은 준비 중이에요.'
                  : panel === '회원 탈퇴'
                    ? '지금은 체험 계정으로 이용하고 있어요.\n회원 탈퇴는 정식 서비스에서 지원해요.'
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
    minHeight: 52,
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
