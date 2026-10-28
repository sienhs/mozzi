import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import {
  CompanionArtwork,
  CompanionNotice,
  EquippedBadge,
  MyPageTitle,
} from '@/components/mypage/CompanionUI';
import { companions } from '@/constants/companions';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { filterOwnedCompanions } from './ownedCompanions';

export function MyPageScreen() {
  const profile = useAuthStore(state => state.member);
  const equippedId = useGachaStore(state => state.equippedId);
  const owned = useGachaStore(state => state.owned);
  const acquiredAt = useGachaStore(state => state.acquiredAt);
  const { equipped } = useLocalSearchParams<{ equipped?: string }>();
  const [dismissedSuccess, setDismissedSuccess] = useState<string>();
  const showSuccess = !!equipped && equipped !== dismissedSuccess;
  useEffect(() => {
    if (!equipped) return;
    const timer = setTimeout(() => {
      setDismissedSuccess(equipped);
      router.setParams({ equipped: undefined });
    }, 3000);
    return () => clearTimeout(timer);
  }, [equipped]);
  const current = companions[equippedId];
  const recentIds = filterOwnedCompanions({ owned, acquiredAt }).slice(0, 4);
  return (
    <Screen
      tabbed
      title="마이페이지"
      titleContent={<MyPageTitle back={false}>마이페이지</MyPageTitle>}
      contentStyle={{ gap: 20 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="설정으로 이동"
        onPress={() => router.push('/settings')}
        style={styles.profile}
      >
        <View style={styles.avatar}>
          <Image
            source={companions.default.source}
            accessible={false}
            resizeMode="contain"
            style={{ width: 58, height: 58 }}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{profile?.nickname ?? '모찌'} 님</AppText>
          <AppText variant="small">오늘도 좋은 하루 보내세요!</AppText>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </Pressable>
      {showSuccess && <CompanionNotice success />}
      <View style={{ gap: 10 }}>
        <AppText variant="heading">지금 함께하는 모찌 🌱</AppText>
        <View style={styles.hero}>
          <EquippedBadge />
          <View style={{ width: '85%', alignSelf: 'center' }}>
            <CompanionArtwork id={equippedId} />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <AppText variant="title" style={{ textAlign: 'center' }}>
              {current.name}
            </AppText>
            <AppText variant="small" style={{ textAlign: 'center' }}>
              {current.description}
            </AppText>
          </View>
          <Button
            label="내 모찌 변경하기"
            variant="secondary"
            style={styles.changeButton}
            onPress={() => router.push('/mypage/owned')}
          />
        </View>
      </View>
      <CompanionNotice />
      <View style={{ gap: 10 }}>
        <AppText variant="heading">최근 만난 모찌</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {recentIds.map(id => (
            <View key={id} style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={[
                  styles.preview,
                  id === equippedId && { borderColor: colors.primary },
                ]}
              >
                <CompanionArtwork id={id} />
              </View>
              <AppText variant="caption" style={{ textAlign: 'center' }}>
                {companions[id].name}
              </AppText>
              {id === equippedId && (
                <AppText
                  variant="caption"
                  style={{ textAlign: 'center', color: colors.primary }}
                >
                  장착 중
                </AppText>
              )}
            </View>
          ))}
        </View>
        {recentIds.some(id => id === 'default' || !acquiredAt[id]) && (
          <AppText variant="caption">
            획득일이 없는 모찌는 이름순으로 보여드려요.
          </AppText>
        )}
      </View>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        개발용 미리보기 · 장착 정보는 앱을 실행한 동안 유지돼요.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
  },
  avatar: { borderRadius: 36, backgroundColor: colors.gachaCream, padding: 4 },
  hero: {
    padding: 16,
    gap: 12,
    borderRadius: 24,
    backgroundColor: colors.white,
  },
  changeButton: { borderWidth: 1.5, borderColor: colors.primary },
  preview: {
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 3,
  },
});
