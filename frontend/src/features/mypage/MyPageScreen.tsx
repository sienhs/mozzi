import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import {
  CompanionArtwork,
  CompanionNotice,
  MyPageTitle,
} from '@/components/mypage/CompanionUI';
import { companions } from '@/constants/companions';
import { emotionOrder, emotions } from '@/constants/emotions';
import { EmotionImage } from '@/components/emotion/Emotion';
import { colors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { filterOwnedCompanions } from './ownedCompanions';

export function MyPageScreen() {
  const profile = useAuthStore(state => state.member);
  const equippedByEmotion = useGachaStore(state => state.equippedByEmotion);
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
  const recentIds = filterOwnedCompanions({ owned, acquiredAt }).slice(0, 4);
  return (
    <Screen
      tabbed
      title="마이페이지"
      titleContent={
        <View style={{ paddingLeft: 48 }}>
          <MyPageTitle back={false}>마이페이지</MyPageTitle>
        </View>
      }
      action={{
        icon: 'settings',
        label: '설정',
        onPress: () => router.push('/settings'),
      }}
      contentStyle={{ gap: 20 }}
    >
      <View style={styles.profile}>
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
      </View>
      {showSuccess && <CompanionNotice success />}
      <View style={{ gap: 10 }}>
        <AppText variant="heading">감정별 함께하는 모찌 🌱</AppText>
        <AppText variant="small">감정마다 함께할 모찌를 골라 주세요.</AppText>
        <View style={styles.equipmentPanel}>
          {emotionOrder.map((emotion, index) => {
            const id = equippedByEmotion[emotion];
            return (
              <Pressable
                key={emotion}
                accessibilityRole="button"
                accessibilityLabel={`${emotions[emotion].label} 모찌 변경하기`}
                onPress={() =>
                  router.push({
                    pathname: '/mypage/owned',
                    params: { emotion },
                  })
                }
                style={[
                  styles.equipmentRow,
                  index < emotionOrder.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.paperEdge,
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: emotions[emotion].color,
                    borderRadius: 22,
                    padding: 6,
                  }}
                >
                  <EmotionImage emotion={emotion} companionId={id} size={64} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label">{emotions[emotion].label}</AppText>
                  <AppText variant="small">{companions[id].name}</AppText>
                </View>
                <ChevronRight size={20} color={colors.muted} />
              </Pressable>
            );
          })}
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
                  Object.values(equippedByEmotion).includes(id) && {
                    borderColor: colors.primary,
                  },
                ]}
              >
                <CompanionArtwork id={id} />
              </View>
              <AppText variant="caption" style={{ textAlign: 'center' }}>
                {companions[id].name}
              </AppText>
              {Object.values(equippedByEmotion).includes(id) && (
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
    backgroundColor: colors.peachPaper,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  avatar: {
    borderRadius: 36,
    backgroundColor: colors.paper,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  equipmentPanel: {
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    boxShadow: '0 4px 14px rgba(91, 65, 39, 0.04)',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  preview: {
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 3,
  },
});
