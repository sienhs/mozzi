import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import type { DiaryEntry } from '@/types/diary';
import { formatDate } from '@/constants/date';
import { radii } from '@/theme/tokens';
import { cozyColors as colors } from '@/theme/cozy';
import { EmotionImage, EmotionPill } from '@/components/emotion/Emotion';
import { AppText } from './Text';
import { Icon } from './Icon';
import { PictureState } from './Feedback';
import { TextButton } from './Button';
import { MotionReveal } from './Motion';

const tagLabels = (entry: DiaryEntry) =>
  entry.tags.map(tag => tag.label).join(' · ');
export const diaryArtwork = require('../../../assets/figma/warm-evening.png');
// 기록 그림은 1:1이다 (AI 결과 768×768). Mock 그림은 3:2라 가운데를 잘라 보여 준다.
export const DIARY_ARTWORK_RATIO = 1;
// The frame owns the ratio: an Image sized with width + aspectRatio keeps the source's pixel height.
// uri가 있으면 서버 그림을, 없으면(시작 화면·샘플 기록) 앱에 든 샘플 그림을 보여 준다.
export function DiaryArtwork({
  rounded = true,
  ratio = DIARY_ARTWORK_RATIO,
  uri,
  fit = 'cover',
  style,
  onSize,
}: {
  rounded?: boolean;
  ratio?: number;
  uri?: string | null;
  fit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
  // 서버 그림을 받으면 원본 크기를 알려 준다(틀 비율을 맞추는 데 쓴다).
  onSize?: (width: number, height: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  if (uri)
    return (
      <RemoteArtwork
        uri={uri}
        rounded={rounded}
        ratio={ratio}
        fit={fit}
        style={style}
        onSize={onSize}
      />
    );
  return (
    <MotionReveal
      ready={loaded}
      style={[
        {
          width: '100%',
          aspectRatio: ratio,
          borderRadius: rounded ? radii.card : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Image
        onLoad={() => setLoaded(true)}
        source={diaryArtwork}
        accessibilityLabel="따뜻한 방에서 오므라이스를 먹는 모찌의 그림일기"
        contentFit={fit}
        style={{ width: '100%', height: '100%' }}
      />
    </MotionReveal>
  );
}
function RemoteArtwork({
  uri,
  rounded,
  ratio,
  fit,
  style,
  onSize,
}: {
  uri: string;
  rounded: boolean;
  ratio: number;
  fit: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
  onSize?: (width: number, height: number) => void;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
    'loading',
  );
  // 다시 불러오기는 같은 주소로 Image를 새로 만든다.
  const [attempt, setAttempt] = useState(0);
  return (
    <View
      style={[
        {
          width: '100%',
          aspectRatio: ratio,
          borderRadius: rounded ? radii.card : 0,
          overflow: 'hidden',
          backgroundColor: colors.sageSoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {state !== 'failed' && (
        <MotionReveal
          key={attempt}
          ready={state === 'loaded'}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        >
          <Image
            source={{ uri }}
            accessibilityLabel="오늘의 그림일기"
            contentFit={fit}
            onLoad={event => {
              setState('loaded');
              onSize?.(event.source.width, event.source.height);
            }}
            onError={() => setState('failed')}
            style={{ width: '100%', height: '100%' }}
          />
        </MotionReveal>
      )}
      {state === 'loading' && (
        <ActivityIndicator
          accessibilityLabel="그림을 불러오고 있어요"
          color={colors.sage}
        />
      )}
      {state === 'failed' && (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText variant="small">그림을 불러오지 못했어요</AppText>
          <TextButton
            label="다시 불러오기"
            onPress={() => {
              setState('loading');
              setAttempt(value => value + 1);
            }}
          />
        </View>
      )}
    </View>
  );
}
export function DiaryMeta({ entry }: { entry: DiaryEntry }) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <EmotionPill emotion={entry.emotion} />
      <AppText variant="small">{tagLabels(entry)}</AppText>
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
        <DiaryArtwork rounded={false} uri={entry.imageUrl} />
      ) : (
        <PictureState
          emotion={entry.emotion}
          companion={entry.companion}
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
        <AppText variant="heading">{entry.title}</AppText>
        <DiaryMeta entry={entry} />
      </View>
    </>
  );
  const style = {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    boxShadow: '0 5px 16px rgba(130, 86, 97, 0.06)',
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
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.paperEdge,
        borderRadius: 24,
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 12,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        minHeight: 70,
      }}
    >
      <EmotionImage
        emotion={entry.emotion}
        size={28}
        companion={entry.companion}
      />
      <View style={{ flex: 1 }}>
        <AppText variant="label" numberOfLines={1}>
          {entry.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {[formatDate(entry.date), tagLabels(entry)]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
      <Icon name="chevronRight" color={colors.muted} />
    </Pressable>
  );
}
