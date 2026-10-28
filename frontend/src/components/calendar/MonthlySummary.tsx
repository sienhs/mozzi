import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/Text';
import { emotionOrder, emotions } from '@/constants/emotions';
import { colors } from '@/theme/tokens';
import type { DiaryEntry } from '@/types/diary';

export function getMonthlySummary(
  entries: DiaryEntry[],
  monthKey: string,
  today: string,
) {
  const days = new Map(
    entries
      .filter(
        entry =>
          // 저장을 마친 기록만 센다 (작성 중 기록 제외).
          entry.status === 'completed' &&
          entry.date.startsWith(`${monthKey}-`) &&
          entry.date <= today,
      )
      .map(entry => [entry.date, entry]),
  );
  const counts = emotionOrder.map(emotion => ({
    emotion,
    count: [...days.values()].filter(entry => entry.emotion === emotion).length,
  }));
  const highest = Math.max(0, ...counts.map(item => item.count));
  const topEmotions = counts.filter(item => item.count === highest);
  let longestStreak = 0;
  let streak = 0;
  let previousDay = -1;
  for (const date of [...days.keys()].sort()) {
    const day = Number(date.slice(8));
    streak = day === previousDay + 1 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previousDay = day;
  }
  return {
    recordedDays: days.size,
    topEmotion:
      highest === 0
        ? '기록 없음'
        : topEmotions.length > 1
          ? '공동 1위'
          : emotions[topEmotions[0].emotion].label,
    longestStreak,
  };
}

export function MonthlySummary({
  entries,
  monthKey,
  today,
}: {
  entries: DiaryEntry[];
  monthKey: string;
  today: string;
}) {
  const summary = getMonthlySummary(entries, monthKey, today);
  const statistics = [
    { value: `${summary.recordedDays}일`, label: '기록한 날' },
    { value: summary.topEmotion, label: '가장 많은 기분' },
    { value: `${summary.longestStreak}일`, label: '최장 연속 기록' },
  ];
  return (
    <View style={styles.card}>
      <AppText variant="label" accessibilityRole="header">
        이번 달의 모찌 <AppText style={{ color: colors.primary }}>♡</AppText>
      </AppText>
      <View style={styles.statistics}>
        {statistics.map(({ value, label }) => (
          <View key={label} style={styles.statistic}>
            <AppText variant="title" style={styles.value}>
              {value}
            </AppText>
            <AppText variant="caption" style={styles.label}>
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  statistics: { flexDirection: 'row', gap: 8 },
  statistic: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  value: {
    color: colors.primary,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
  },
  label: { textAlign: 'center', color: colors.muted },
});
