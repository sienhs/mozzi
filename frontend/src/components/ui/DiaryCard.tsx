import { Image, Pressable, View } from 'react-native';
import type { DiaryEntry } from '@/types/diary';
import { formatDate } from '@/constants/date';
import { colors, radii } from '@/theme/tokens';
import { EmotionImage, EmotionPill } from '@/components/emotion/Emotion';
import { AppText } from './Text';
import { Icon } from './Icon';
import { PictureState } from './Feedback';

export const diaryArtwork = require('../../../assets/figma/warm-evening.png');
// The frame owns the 3:2 ratio: an Image sized with width + aspectRatio keeps the source's pixel height.
export function DiaryArtwork({ rounded = true }: { rounded?: boolean }) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 3 / 2,
        borderRadius: rounded ? radii.card : 0,
        overflow: 'hidden',
      }}
    >
      <Image
        source={diaryArtwork}
        accessibilityLabel="따뜻한 방에서 오므라이스를 먹는 모찌의 그림일기"
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
export function DiaryMeta({ entry }: { entry: DiaryEntry }) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <EmotionPill emotion={entry.emotion} />
      <AppText variant="small">{entry.activities.join(' · ')}</AppText>
    </View>
  );
}
export function DiaryCard({
  entry,
  onPress,
}: {
  entry: DiaryEntry;
  onPress?: () => void;
}) {
  const content = (
    <>
      {entry.generation === 'ready' ? (
        <DiaryArtwork rounded={false} />
      ) : (
        <PictureState
          emotion={entry.emotion}
          generating={entry.generation === 'generating'}
        />
      )}
      <View
        style={{
          paddingTop: 16,
          paddingBottom: 20,
          paddingHorizontal: 20,
          gap: 6,
        }}
      >
        <AppText variant="caption">{formatDate(entry.date)}</AppText>
        <AppText variant="label">{entry.title}</AppText>
        <DiaryMeta entry={entry} />
      </View>
    </>
  );
  const style = {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    overflow: 'hidden' as const,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(entry.date)} ${entry.title}`}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
export function DiaryRow({
  entry,
  onPress,
}: {
  entry: DiaryEntry;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(entry.date)} ${entry.title}`}
      onPress={onPress}
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 12,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        minHeight: 70,
      }}
    >
      <EmotionImage emotion={entry.emotion} size={28} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" numberOfLines={1}>
          {entry.title}
        </AppText>
        <AppText variant="caption">
          {formatDate(entry.date)} · {entry.activities.join(' · ')}
        </AppText>
      </View>
      <Icon name="chevronRight" color={colors.muted} />
    </Pressable>
  );
}
