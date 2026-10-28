import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import type { Emotion } from '@/types/diary';
import type { CompanionId } from '@/types/companion';
import { colors } from '@/theme/tokens';
import { EmotionImage } from '@/components/emotion/Emotion';
import { AppText } from './Text';
import { Icon } from './Icon';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.white,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.error,
        }}
      />
      <AppText variant="small" style={{ flex: 1, color: colors.error }}>
        {message}
      </AppText>
    </View>
  );
}
export function Loading({ label }: { label: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: 'center', padding: 24, gap: 16 }}
    >
      <ActivityIndicator color={colors.primary} />
      <AppText variant="small">{label}</AppText>
    </View>
  );
}
export function StatePanel({
  title,
  description,
  emotion = 'happy',
  retry,
  compact,
}: {
  title: string;
  description: string;
  emotion?: Emotion;
  retry?: () => void;
  compact?: boolean;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        gap: 8,
        paddingTop: compact ? 20 : 64,
        paddingHorizontal: compact ? 20 : 0,
        paddingBottom: compact ? 8 : 20,
        alignItems: compact ? 'flex-start' : 'center',
        backgroundColor: compact ? colors.white : undefined,
        borderRadius: 20,
      }}
    >
      {!compact && <EmotionImage emotion={emotion} size={64} />}
      <AppText variant={compact ? 'label' : 'heading'}>{title}</AppText>
      <AppText
        variant={compact ? 'small' : 'body'}
        style={{ color: colors.muted, textAlign: compact ? 'left' : 'center' }}
      >
        {description}
      </AppText>
      {retry && (
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={{
            minHeight: 48,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <Icon name="refresh" size={18} color={colors.primary} />
          <AppText variant="small" style={{ color: colors.primary }}>
            다시 물어보기
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
export function PictureState({
  emotion = 'happy',
  companionId,
  generating,
  tone = 'white',
  caption,
  captionStyle,
  ratio = 1,
}: {
  emotion?: Emotion;
  companionId?: CompanionId;
  generating?: boolean;
  tone?: 'white' | 'sage';
  caption?: string;
  captionStyle?: StyleProp<TextStyle>;
  // 기록 그림 자리는 그림과 같은 1:1이다.
  ratio?: number;
}) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: ratio,
        borderRadius: 20,
        backgroundColor: tone === 'sage' ? colors.sageSoft : colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <EmotionImage
        emotion={emotion}
        size={generating ? 80 : 72}
        companionId={companionId}
      />
      {generating && <Icon name="pencil" color={colors.sage} />}
      {caption && (
        <AppText variant="small" style={captionStyle}>
          {caption}
        </AppText>
      )}
    </View>
  );
}
export function GenerationProgress({ home = false }: { home?: boolean }) {
  const [progress, setProgress] = useState(15);
  // setInterval 대신 한 번씩 예약한다: 생성 완료와 같은 순간에 interval을 정리하면
  // Jest 가짜 타이머(@sinonjs/fake-timers 15.4)가 멈추는 경우가 있었다. 화면 동작은 같다.
  useEffect(() => {
    if (progress >= 94) return;
    const timer = setTimeout(
      () => setProgress(value => Math.min(value + 6, 94)),
      400,
    );
    return () => clearTimeout(timer);
  }, [progress]);
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="그림 생성 진행률"
        accessibilityValue={{ min: 0, max: 100, now: progress }}
        style={{
          height: 6,
          backgroundColor: colors.line,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 6,
            width: `${progress}%`,
            backgroundColor: colors.primary,
            borderRadius: 3,
          }}
        />
      </View>
      <AppText variant="caption">
        {home
          ? '완성되면 여기에 바로 보여 드릴게요'
          : '장면을 고르는 중 · 보통 30초쯤 걸려요'}
      </AppText>
    </View>
  );
}
