import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, CalendarDays, Pencil } from 'lucide-react-native';
import { AppText } from '@/components/ui/Text';
import { EmotionImage, EmotionPill } from '@/components/emotion/Emotion';
import { fonts } from '@/theme/tokens';
import { formatDate, todayKey } from '@/constants/date';
import type { DiaryEntry } from '@/types/diary';
import {
  ChristmasCard,
  DateHolly,
  WinterVillage,
  christmas as colors,
} from './HomeChristmas';
import { StampFrame } from './ChristmasStamp';

export function HomeMasthead({ date = todayKey() }: { date?: string }) {
  const day = formatDate(date, false);
  const weekday = formatDate(date).slice(day.length + 1);
  return (
    <View style={styles.masthead}>
      <WinterVillage />
      <Image
        source={require('../../../assets/Mozzi_Logo2.png')}
        accessibilityLabel="오늘의 모찌"
        resizeMode="contain"
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
          resizeMode="contain"
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

// 카드 자체는 누르지 않는다. 옆으로 밀어 넘기다 실수로 기록 보기로 넘어가지 않도록 '기록 보기' 버튼만 연다.
export function HomeCompletedPage({
  entry,
  onOpen,
  label,
  trailing,
}: {
  entry: DiaryEntry;
  onOpen: () => void;
  label?: string;
  trailing?: ReactNode;
}) {
  const past = entry.date !== todayKey();
  const picture = entry.generation === 'ready' && !!entry.imageUrl;
  return (
    <HomeJournalPage label={label} trailing={trailing}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ChristmasCard contentSized>
          <View style={styles.metadata}>
            <View style={styles.diaryDate}>
              <CalendarDays size={19} color={colors.accent} />
              <AppText variant="label" style={styles.diaryDateText}>
                {formatDate(entry.date)}
              </AppText>
            </View>
            <EmotionPill emotion={entry.emotion} />
          </View>
          {!!entry.tags.length && (
            <View style={styles.tags}>
              {entry.tags.slice(0, 3).map((tag, index) => (
                <View key={`${tag.category}-${index}`} style={styles.tag}>
                  <AppText
                    variant="caption"
                    numberOfLines={1}
                    style={{ color: colors.ink }}
                  >
                    {tag.label}
                  </AppText>
                </View>
              ))}
              {entry.tags.length > 3 && (
                <AppText variant="caption">+{entry.tags.length - 3}</AppText>
              )}
            </View>
          )}
          {/* 지난 기록은 태그가 오지 않아(목록 응답) 한 줄 일기를 대신 적는다. */}
          {past && (
            <AppText
              numberOfLines={2}
              style={[styles.memo, !entry.memo && { color: colors.muted }]}
            >
              {entry.memo || entry.title}
            </AppText>
          )}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(entry.date)} 그림일기 보기`}
            accessibilityHint="그림과 기록 전체를 자세히 볼 수 있어요."
            onPress={onOpen}
            hitSlop={6}
            style={({ pressed }) => [
              styles.viewRecord,
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <AppText variant="label" style={styles.viewRecordText}>
              기록 보기
            </AppText>
          </Pressable>
        </ChristmasCard>
      </View>
    </HomeJournalPage>
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
  viewRecord: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 25,
    backgroundColor: colors.peachPaper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewRecordText: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 22,
    lineHeight: 28,
  },
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
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memo: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 20,
    lineHeight: 27,
    paddingRight: 8,
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
    maxWidth: '30%',
  },
});
