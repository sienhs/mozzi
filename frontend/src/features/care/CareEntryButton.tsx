import { useState } from 'react';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { CardImage } from '@/components/gacha/CardImage';
import { EmotionImage } from '@/components/emotion/Emotion';
import { AppText } from '@/components/ui/Text';
import { companionName } from '@/constants/companions';
import { christmas as colors } from '@/features/home/HomeChristmas';
import { fonts } from '@/theme/tokens';
import type { Companion } from '@/types/companion';
import type { Emotion } from '@/types/diary';

// 홈 하단: 오늘 감정의 모찌와 돌보기 화면으로 간다.
export function CareEntryButton({
  emotion,
  companion,
}: {
  emotion: Emotion;
  companion?: Companion | null;
}) {
  const [pressed, setPressed] = useState(false);
  const name = companionName(companion);
  const open = () =>
    router.push({
      pathname: '/care',
      params: companion
        ? { emotion, image: companion.imageUrl, name: companion.name }
        : { emotion },
    });
  return (
    <Pressable
      testID="home-care-entry"
      accessibilityRole="button"
      accessibilityLabel={`${name}랑 놀기`}
      accessibilityHint="쓰다듬기, 간식, 공놀이를 하면 뽑기권을 받아요."
      onPress={open}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.avatar}>
        {companion ? (
          <CardImage
            uri={companion.imageUrl}
            contentFit="contain"
            style={{ width: 44, height: 44 }}
          />
        ) : (
          <EmotionImage emotion={emotion} size={44} />
        )}
      </View>
      <View style={styles.copy}>
        <AppText numberOfLines={1} style={styles.title}>
          모찌랑 놀기
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.caption}>
          놀아 주고 뽑기권 받기
        </AppText>
      </View>
      <View style={styles.cta}>
        <AppText style={styles.ctaText}>놀러 가기</AppText>
        <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.edge,
    backgroundColor: colors.card,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 22,
    lineHeight: 28,
  },
  caption: { color: colors.muted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#8B5E46',
  },
  ctaText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 14 },
});
