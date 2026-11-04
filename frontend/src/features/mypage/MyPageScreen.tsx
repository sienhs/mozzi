import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CozyScreen as Screen } from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { CompanionNotice, MyPageTitle } from '@/components/mypage/CompanionUI';
import { companionName } from '@/constants/companions';
import { gachaArt } from '@/constants/gacha';
import { emotionOrder, emotions } from '@/constants/emotions';
import { EmotionImage } from '@/components/emotion/Emotion';
import { StatePanel } from '@/components/ui/Feedback';
import { cozyColors as colors } from '@/theme/cozy';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMozziPicks } from '@/features/gacha/useGachaQueries';
import { MotionReveal } from '@/components/ui/Motion';

// 감정별 대표 모찌는 서버 값(GET /members/me의 mozzis)이다.
export function MyPageScreen() {
  const profile = useAuthStore(state => state.member);
  const { picks, ...pickQuery } = useMozziPicks();
  const { equipped, emotion: equippedEmotion } = useLocalSearchParams<{
    equipped?: string;
    emotion?: string;
  }>();
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
            source={gachaArt.mochi}
            accessible={false}
            contentFit="contain"
            style={{ width: 58, height: 58 }}
          />
        </View>
        <AppText variant="heading" style={{ flex: 1 }}>
          {profile?.nickname ?? '모찌'} 님
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="모찌 도감"
        onPress={() => router.push('/gacha/collection')}
        style={styles.collectionLink}
      >
        <BookOpen size={20} color={colors.muted} />
        <AppText variant="label" style={{ flex: 1 }}>
          모찌 도감
        </AppText>
        <ChevronRight size={20} color={colors.muted} />
      </Pressable>
      {showSuccess && <CompanionNotice />}
      <View style={{ gap: 10 }}>
        <AppText variant="heading">감정별 함께하는 모찌</AppText>
        {pickQuery.isError && (
          <StatePanel
            compact
            title="고른 모찌를 불러오지 못했어요"
            description="연결 상태를 확인하고 다시 시도해 주세요."
            retry={() => void pickQuery.refetch()}
            retryLabel="다시 불러오기"
          />
        )}
        <View style={styles.equipmentPanel}>
          {emotionOrder.map((emotion, index) => {
            const companion = picks[emotion];
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
                  <MotionReveal
                    pop
                    animate={showSuccess && equippedEmotion === emotion}
                    replayKey={equipped}
                  >
                    <EmotionImage
                      emotion={emotion}
                      companion={companion}
                      size={64}
                    />
                  </MotionReveal>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label">{emotions[emotion].label}</AppText>
                  <AppText
                    variant="small"
                    textBreakStrategy="balanced"
                    lineBreakStrategyIOS="hangul-word"
                  >
                    {pickQuery.data ? companionName(companion) : ' '}
                  </AppText>
                </View>
                <ChevronRight size={20} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.peachPaper,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    boxShadow: '0 4px 14px rgba(130, 86, 97, 0.04)',
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
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    boxShadow: '0 4px 14px rgba(130, 86, 97, 0.04)',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  collectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    backgroundColor: colors.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
});
