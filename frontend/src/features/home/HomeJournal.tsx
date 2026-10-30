import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ArrowUpRight, BookOpen, Check, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DiaryArtwork, DiaryRow } from '@/components/ui/DiaryCard';
import { EmotionImage, EmotionPill } from '@/components/emotion/Emotion';
import { MotionReveal } from '@/components/ui/Motion';
import { formatDate } from '@/constants/date';
import { colors } from '@/theme/tokens';
import type { DiaryEntry } from '@/types/diary';

export function HomeMasthead({ date }: { date?: string }) {
  const day = date ? formatDate(date, false) : '';
  const weekday = date ? formatDate(date).slice(day.length + 1) : '';
  return (
    <View style={styles.masthead}>
      <Image
        source={require('../../../assets/Mozzi_Logo2.png')}
        accessibilityLabel="오늘의 모찌"
        resizeMode="contain"
        style={styles.logo}
      />
      <View
        accessible
        accessibilityLabel={date ? formatDate(date) : '오늘의 기록'}
        style={styles.dateStamp}
      >
        <AppText variant="caption" style={{ color: colors.mossInk }}>
          {weekday || '오늘의 기록'}
        </AppText>
        {!!day && (
          <AppText
            variant="label"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 22, lineHeight: 28 }}
          >
            {day}
          </AppText>
        )}
      </View>
    </View>
  );
}

export function HomeJournalPage({
  children,
  completed = false,
}: {
  children: ReactNode;
  completed?: boolean;
}) {
  return (
    <View style={styles.page}>
      <View style={styles.pageHeading}>
        <BookOpen size={16} color={colors.primary} />
        <AppText variant="label" style={styles.pageLabel}>
          오늘의 한 페이지
        </AppText>
        <View style={styles.headingRule} />
        {completed && (
          <View accessible accessibilityLabel="오늘 기록 완료">
            <Check size={18} color={colors.mossInk} />
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

export function HomeEmptyPage({ onRecord }: { onRecord: () => void }) {
  return (
    <HomeJournalPage>
      <View style={styles.emptyContent}>
        <AppText
          variant="title"
          accessibilityRole="header"
          style={styles.question}
        >
          오늘은 어떤 하루였나요?
        </AppText>
        <View style={styles.mochiStage}>
          <View pointerEvents="none" style={styles.mochiGround} />
          <Sparkles size={19} color={colors.primary} style={styles.sparkle} />
          <MotionReveal pop>
            <EmotionImage emotion="happy" size={152} />
          </MotionReveal>
        </View>
        <AppText variant="small" style={styles.invitation}>
          태그 몇 개로, 오늘을 그림 한 장에.
        </AppText>
        <Button label="오늘 기록하기" onPress={onRecord} />
      </View>
    </HomeJournalPage>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(entry.date)} ${entry.title}`}
      accessibilityHint="그림과 기록을 자세히 볼 수 있어요."
      onPress={onOpen}
    >
      <HomeJournalPage completed>
        <View style={styles.pictureInset}>
          <DiaryArtwork uri={entry.imageUrl} />
        </View>
        <View style={styles.diaryCaption}>
          <AppText variant="title" numberOfLines={2} style={styles.diaryTitle}>
            {entry.title}
          </AppText>
          <View style={styles.metadata}>
            <EmotionPill emotion={entry.emotion} />
            <AppText variant="small" numberOfLines={1} style={styles.tags}>
              {entry.tags.map(tag => tag.label).join(' · ')}
            </AppText>
          </View>
          <View style={styles.openDiary}>
            <AppText variant="label" style={{ color: colors.primary }}>
              일기 펼쳐보기
            </AppText>
            <ArrowUpRight size={18} color={colors.primary} />
          </View>
        </View>
      </HomeJournalPage>
    </Pressable>
  );
}

export function HomeRecentRecord({
  entry,
  onOpen,
  onBrowse,
}: {
  entry: DiaryEntry;
  onOpen: () => void;
  onBrowse: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.recentHeading}>
        <AppText variant="heading">지난 기록</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지난 기록 모두 보기"
          onPress={onBrowse}
          style={styles.browse}
        >
          <AppText variant="caption">모두 보기</AppText>
          <ArrowUpRight size={15} color={colors.muted} />
        </Pressable>
      </View>
      <DiaryRow entry={entry} onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  logo: {
    width: 160,
    height: 84,
    flexShrink: 1,
    minWidth: 0,
    transform: [{ translateX: -8 }],
  },
  dateStamp: {
    alignItems: 'center',
    minWidth: 112,
    maxWidth: '50%',
    flexShrink: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  page: {
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    boxShadow: '0 6px 20px rgba(91, 65, 39, 0.05)',
    overflow: 'hidden',
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageLabel: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 26,
    flexShrink: 1,
    minWidth: 0,
  },
  headingRule: { height: 1, flex: 1, backgroundColor: colors.paperEdge },
  emptyContent: { paddingHorizontal: 18, paddingBottom: 18, gap: 8 },
  question: { fontSize: 30, lineHeight: 40, textAlign: 'center' },
  mochiStage: { height: 160, alignItems: 'center', justifyContent: 'center' },
  mochiGround: {
    position: 'absolute',
    bottom: 8,
    width: 178,
    height: 108,
    borderRadius: 90,
    backgroundColor: colors.peachPaper,
  },
  sparkle: { position: 'absolute', left: '19%', top: 28 },
  invitation: {
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 4,
  },
  pictureInset: { paddingHorizontal: 8 },
  diaryCaption: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  diaryTitle: { fontSize: 24, lineHeight: 32 },
  metadata: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 24 },
  openDiary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 4,
  },
  recentHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  browse: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
});
