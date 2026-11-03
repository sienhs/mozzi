import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Pencil,
} from 'lucide-react-native';
import { AppText } from '@/components/ui/Text';
import { EmotionPill } from '@/components/emotion/Emotion';
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
}: {
  children: ReactNode;
  minHeight?: number;
  gap?: number;
}) {
  return (
    <View style={[styles.page, { minHeight, gap }]}>
      <View style={styles.pageHeading}>
        <BookOpen size={17} color={colors.accent} />
        <AppText variant="label" style={styles.pageLabel}>
          오늘의 한 페이지
        </AppText>
        <View style={styles.headingRule} />
      </View>
      {children}
    </View>
  );
}

export function HomeEmptyPage({
  onRecord,
  minHeight,
}: {
  onRecord: () => void;
  minHeight?: number;
}) {
  return (
    <HomeJournalPage minHeight={minHeight} gap={16}>
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

export function HomeGeneratingPage({ minHeight }: { minHeight?: number }) {
  return (
    <HomeJournalPage minHeight={minHeight}>
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

export function HomeCompletedPage({
  entry,
  onOpen,
}: {
  entry: DiaryEntry;
  onOpen: () => void;
}) {
  return (
    <HomeJournalPage>
      <Pressable
        style={{ flex: 1, minHeight: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`${formatDate(entry.date)} 그림일기 보기`}
        accessibilityHint="그림과 기록 전체를 자세히 볼 수 있어요."
        onPress={onOpen}
      >
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
          <StampFrame uri={entry.imageUrl} />
          <View style={styles.viewRecord}>
            <AppText variant="label" style={styles.viewRecordText}>
              기록 보기
            </AppText>
            <ChevronRight size={19} color={colors.ink} />
          </View>
        </ChristmasCard>
      </Pressable>
    </HomeJournalPage>
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
  tag: {
    backgroundColor: colors.pink,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: '30%',
  },
});
