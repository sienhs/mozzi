import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  BookOpen,
  CalendarDays,
  Download,
  Pencil,
  Share,
} from 'lucide-react-native';
import { AppText } from '@/components/ui/Text';
import { EmotionImage, EmotionPill } from '@/components/emotion/Emotion';
import { fonts } from '@/theme/tokens';
import { formatDate, formatTime, todayKey } from '@/constants/date';
import type { DiaryEntry } from '@/types/diary';
import { useReducedMotion } from '@/components/ui/Motion';
import { entryPhase } from '@/stores/useAppStore';
import { useDiary } from '@/features/diary/useDiaryQueries';
import { useDiaryImageActions } from '@/features/diary/useDiaryImageActions';
import {
  ChristmasCard,
  DateHolly,
  WinterVillage,
  christmas as colors,
} from './HomeChristmas';
import { StampFrame } from './ChristmasStamp';

const native = Platform.OS !== 'web';

export function HomeMasthead({ date = todayKey() }: { date?: string }) {
  const day = formatDate(date, false);
  const weekday = formatDate(date).slice(day.length + 1);
  return (
    <View style={styles.masthead}>
      <WinterVillage />
      <Image
        source={require('../../../assets/Mozzi_Logo2.png')}
        accessibilityLabel="오늘의 모찌"
        contentFit="contain"
        style={styles.logo}
      />
      <View
        accessible
        accessibilityLabel={formatDate(date)}
        style={styles.dateStamp}
      >
        <DateHolly />
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="caption" style={styles.weekday}>
            {weekday}
          </AppText>
          <AppText
            variant="label"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.date}
          >
            {day}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function HomeJournalPage({
  children,
  minHeight,
  gap = 24,
  label = '오늘의 한 페이지',
  trailing,
}: {
  children: ReactNode;
  minHeight?: number;
  gap?: number;
  label?: string;
  // 머리줄 오른쪽 끝(페이지 넘기기 안내 등).
  trailing?: ReactNode;
}) {
  return (
    <View style={[styles.page, { minHeight, gap }]}>
      <View style={styles.pageHeading}>
        <BookOpen size={17} color={colors.accent} />
        <AppText variant="label" style={styles.pageLabel}>
          {label}
        </AppText>
        <View style={styles.headingRule} />
        {trailing}
      </View>
      {children}
    </View>
  );
}

export function HomeEmptyPage({
  onRecord,
  minHeight,
  trailing,
}: {
  onRecord: () => void;
  minHeight?: number;
  trailing?: ReactNode;
}) {
  return (
    <HomeJournalPage minHeight={minHeight} gap={16} trailing={trailing}>
      <ChristmasCard
        backgroundImage={require('../../../assets/Mozzi_before.png')}
      >
        <View style={styles.characterSpace} />
        <AppText
          variant="title"
          style={[styles.message, { fontFamily: fonts.pen }]}
        >
          {'오늘 있었던 일과\n느낀 감정을 기록해 보세요!'}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일기 쓰기"
          onPress={onRecord}
          style={styles.recordButton}
        >
          <Pencil size={20} color={colors.white} />
          <AppText variant="label" style={{ color: colors.white }}>
            일기 쓰기
          </AppText>
        </Pressable>
      </ChristmasCard>
    </HomeJournalPage>
  );
}

export function HomeGeneratingPage({
  minHeight,
  trailing,
}: {
  minHeight?: number;
  trailing?: ReactNode;
}) {
  return (
    <HomeJournalPage minHeight={minHeight} trailing={trailing}>
      <ChristmasCard>
        <DiaryDrawingState fitToSpace />
      </ChristmasCard>
    </HomeJournalPage>
  );
}

// Shared with the dedicated generation screen so image, copy and progress stay aligned.
export function DiaryDrawingState({
  fitToSpace = false,
}: {
  fitToSpace?: boolean;
}) {
  return (
    <>
      <View
        style={[
          styles.generatingArtwork,
          fitToSpace && { flexBasis: 0, minHeight: 0 },
        ]}
      >
        <Image
          source={require('../../../assets/Mozzi_middle.png')}
          accessibilityLabel="크리스마스 그림을 그리는 모찌"
          contentFit="contain"
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        />
      </View>
      <View style={styles.drawingCaption}>
        <AppText variant="title" style={styles.drawingMessage}>
          {'모찌가 오늘의 마음을\n반짝이는 그림으로 담고 있어요'}
        </AppText>
        <DrawingProgressBar />
      </View>
    </>
  );
}

// The server confirms receipt and PENDING, not a numeric completion percentage.
// The middle milestone represents the drawing stage; completion replaces this card.
function DrawingProgressBar() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="그림 생성 중"
      accessibilityState={{ busy: true }}
      accessibilityValue={{ text: '기록 접수 완료, 그림 그리는 중' }}
      style={styles.progressSteps}
    >
      <View style={styles.progressTrack}>
        <View style={styles.progressFill}>
          <View style={styles.progressShine} />
        </View>
      </View>
    </View>
  );
}

// 완성된 날의 카드. 누르면 뒤집혀 한 줄 일기·태그·남긴 시각을 보여 주고, 다시 누르면 그림으로 돌아온다.
// 다른 화면으로 넘어가지 않는다. 옆으로 끌면 넘기기가 터치를 가져가 뒤집히지 않는다.
export function HomeCompletedPage({
  entry,
  label,
  trailing,
}: {
  entry: DiaryEntry;
  label?: string;
  trailing?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [turn] = useState(() => new Animated.Value(0));
  // 지난 기록은 목록 응답이라 태그·시각이 없다. 처음 뒤집을 때 그날 기록을 받아 채운다.
  const [opened, setOpened] = useState(false);
  const past = entry.date !== todayKey();
  const detail = useDiary(past && opened ? entry.date : undefined);
  const full = past ? (detail.entry ?? null) : entry;
  const actions = useDiaryImageActions(entry);
  const picture = entry.generation === 'ready' && !!entry.imageUrl;
  const writable =
    !past && !!entry.serverId && entryPhase(entry, false) === 'reviewing';
  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    setOpened(true);
    Animated.timing(turn, {
      toValue: next ? 1 : 0,
      duration: reduced ? 0 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  };
  const side = (back: boolean) => ({
    opacity: turn.interpolate({
      inputRange: [0, 0.5, 0.501, 1],
      outputRange: back ? [0, 0, 1, 1] : [1, 1, 0, 0],
    }),
    transform: [
      { perspective: 1400 },
      {
        rotateY: turn.interpolate({
          inputRange: [0, 1],
          outputRange: back ? ['-180deg', '0deg'] : ['0deg', '180deg'],
        }),
      },
    ],
  });
  // 보이지 않는 면은 누르거나 읽지 않는다.
  const hidden = (back: boolean) =>
    back !== flipped
      ? {
          pointerEvents: 'none' as const,
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        }
      : {};
  const date = (
    <View style={styles.metadata}>
      <View style={styles.diaryDate}>
        <CalendarDays size={19} color={colors.accent} />
        <AppText variant="label" style={styles.diaryDateText}>
          {formatDate(entry.date)}
        </AppText>
      </View>
      <EmotionPill emotion={entry.emotion} />
    </View>
  );
  const tags = full?.tags ?? [];
  return (
    <HomeJournalPage label={label} trailing={trailing} gap={16}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <Animated.View style={[styles.face, side(false)]} {...hidden(false)}>
          <ChristmasCard contentSized>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(entry.date)} 그림일기`}
              accessibilityHint="누르면 한 줄 일기와 태그를 볼 수 있어요."
              onPress={flip}
              style={styles.faceContent}
            >
              {date}
              {picture ? (
                <StampFrame uri={entry.imageUrl} />
              ) : (
                <View style={styles.noPicture}>
                  <EmotionImage emotion={entry.emotion} size={120} />
                  <AppText variant="small" style={{ color: colors.muted }}>
                    {entry.generation === 'generating'
                      ? '그림을 그리고 있어요'
                      : entry.generation === 'failed'
                        ? '그림을 완성하지 못한 날이에요'
                        : '그림 없이 남긴 하루예요'}
                  </AppText>
                </View>
              )}
            </Pressable>
          </ChristmasCard>
        </Animated.View>
        <Animated.View
          style={[styles.face, styles.backFace, side(true)]}
          {...hidden(true)}
        >
          <ChristmasCard contentSized>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(entry.date)} 한 줄 일기`}
              accessibilityHint="누르면 그림으로 돌아가요."
              onPress={flip}
              style={styles.faceContent}
            >
              {date}
              <View style={styles.memoArea}>
                <AppText variant="caption" style={styles.memoLabel}>
                  한 줄 일기
                </AppText>
                <AppText
                  style={[styles.memo, !entry.memo && { color: colors.muted }]}
                >
                  {entry.memo || '남긴 한 줄이 없어요'}
                </AppText>
                {/* 그림만 완성된 오늘 기록은 여기서 한 줄을 남긴다(상세 화면을 거치지 않는다). */}
                {writable && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="한 줄 남기기"
                    onPress={() =>
                      router.push({
                        pathname: '/record/generation',
                        params: { id: entry.id },
                      })
                    }
                    hitSlop={6}
                    style={[styles.actionPill, { alignSelf: 'center' }]}
                  >
                    <Pencil size={18} color={colors.accent} />
                    <AppText variant="label" style={styles.actionText}>
                      한 줄 남기기
                    </AppText>
                  </Pressable>
                )}
              </View>
              {full ? (
                <View style={{ gap: 12 }}>
                  {!!tags.length && (
                    <View style={styles.tags}>
                      {tags.map((tag, index) => (
                        <View
                          key={`${tag.category}-${index}`}
                          style={styles.tag}
                        >
                          <AppText
                            variant="caption"
                            numberOfLines={1}
                            style={{ color: colors.ink }}
                          >
                            {tag.label}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  )}
                  {!!full.createdAt && (
                    <AppText variant="caption" style={styles.writtenAt}>
                      {formatTime(full.createdAt)}에 남긴 기록
                    </AppText>
                  )}
                </View>
              ) : detail.isError ? (
                <AppText variant="caption" style={styles.writtenAt}>
                  태그를 불러오지 못했어요
                </AppText>
              ) : (
                <ActivityIndicator
                  accessibilityLabel="태그를 불러오고 있어요"
                  color={colors.accent}
                />
              )}
            </Pressable>
            <ImageActionRow actions={actions} />
          </ChristmasCard>
        </Animated.View>
      </View>
    </HomeJournalPage>
  );
}

// 카드 뒷면 하단의 그림 저장·공유. 저장은 공유 왼쪽에 두고, 그림이 없는 날은 공유(글)만 둔다.
function ImageActionRow({
  actions,
}: {
  actions: ReturnType<typeof useDiaryImageActions>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.actionRow}>
        {actions.canSave && (
          <ActionPill
            label="저장"
            accessibilityLabel="그림 저장"
            busy={actions.busy === 'save'}
            onPress={actions.save}
            icon={<Download size={18} color={colors.accent} />}
          />
        )}
        <ActionPill
          label="공유"
          accessibilityLabel="그림 공유"
          busy={actions.busy === 'share'}
          onPress={actions.share}
          icon={<Share size={18} color={colors.accent} />}
        />
      </View>
      {actions.notice && (
        <AppText
          accessibilityLiveRegion="polite"
          variant="caption"
          style={[styles.writtenAt, { textAlign: 'center' }]}
        >
          {actions.notice}
        </AppText>
      )}
    </View>
  );
}

function ActionPill({
  label,
  accessibilityLabel,
  busy,
  onPress,
  icon,
}: {
  label: string;
  accessibilityLabel: string;
  busy: boolean;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.actionPill,
        pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.accent} /> : icon}
      <AppText variant="label" style={styles.actionText}>
        {label}
      </AppText>
    </Pressable>
  );
}

// 머리줄 끝의 작은 버튼(밀어서 넘기는 동작을 버튼으로도 할 수 있게).
export function PageHint({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={styles.pageHint}
    >
      <AppText variant="caption" style={styles.pageHintText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 56,
    paddingBottom: 0,
  },
  logo: {
    width: '34%',
    maxWidth: 104,
    aspectRatio: 160 / 84,
    flexShrink: 1,
    minWidth: 0,
  },
  dateStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '55%',
    flexShrink: 1,
    gap: 5,
    paddingTop: 3,
  },
  weekday: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  date: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  page: { gap: 24, flex: 1, minHeight: 0 },
  characterSpace: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 0,
    flexBasis: 0,
  },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageLabel: {
    color: colors.accent,
    fontSize: 16,
    lineHeight: 24,
    flexShrink: 1,
    minWidth: 0,
  },
  headingRule: {
    height: 1,
    flex: 1,
    backgroundColor: colors.edge,
    opacity: 0.55,
  },
  message: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 29,
    textAlign: 'center',
  },
  recordButton: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.coral,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
  },
  generatingArtwork: { flexGrow: 1, minHeight: 260 },
  drawingCaption: { gap: 16, paddingHorizontal: 4, paddingBottom: 10 },
  drawingMessage: {
    fontFamily: fonts.pen,
    color: colors.ink,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 36,
  },
  progressSteps: { gap: 8 },
  progressTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: colors.pink,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.edge,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    borderRadius: 7,
    backgroundColor: colors.coral,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  progressShine: {
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFD8B9',
    opacity: 0.8,
    marginBottom: 3,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 20,
  },
  diaryDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  diaryDateText: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 25,
    flexShrink: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  face: { flex: 1, minHeight: 0, backfaceVisibility: 'hidden' },
  backFace: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  faceContent: { flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 16 },
  memoArea: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 6,
  },
  memoLabel: { color: colors.accent, textAlign: 'center' },
  memo: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 30,
    lineHeight: 40,
    textAlign: 'center',
  },
  writtenAt: { color: colors.muted },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  actionPill: {
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.peachPaper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 22,
    lineHeight: 28,
  },
  noPicture: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pageHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: colors.pink,
  },
  pageHintText: { color: colors.accent, fontSize: 13, lineHeight: 19 },
  tag: {
    backgroundColor: colors.pink,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
