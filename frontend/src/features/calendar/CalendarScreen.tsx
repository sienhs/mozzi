import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { TextButton } from '@/components/ui/Button';
import { DiaryRow } from '@/components/ui/DiaryCard';
import { Sheet } from '@/components/ui/Sheet';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions } from '@/constants/emotions';
import { formatDate, monthCells, todayKey } from '@/constants/date';
import { colors } from '@/theme/tokens';
import type { DiaryEntry } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';

export function CalendarDay({
  date,
  entry,
  selected,
  onPress,
}: {
  date: string;
  entry?: DiaryEntry;
  selected: boolean;
  onPress: () => void;
}) {
  const future = date > todayKey();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(date)} ${entry ? emotions[entry.emotion].label : '기록 없음'}`}
      accessibilityState={{ selected, disabled: future }}
      disabled={future}
      onPress={onPress}
      style={{
        height: 62,
        flex: 1,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : 'transparent',
        backgroundColor: selected ? colors.soft : 'transparent',
        alignItems: 'center',
        paddingTop: 4,
        gap: 2,
      }}
    >
      <AppText
        variant="caption"
        style={{
          color:
            date === todayKey()
              ? colors.primary
              : future
                ? colors.line
                : colors.muted,
        }}
      >
        {Number(date.slice(8))}
      </AppText>
      {entry && (
        <EmotionImage
          emotion={entry.emotion}
          size={28}
          companionId={entry.companionId}
        />
      )}
    </Pressable>
  );
}
export function CalendarScreen() {
  const today = todayKey();
  const allEntries = useAppStore(state => state.entries);
  // 캘린더에는 저장을 마친 기록만 보인다. 오늘 작성 중인 기록은 홈에서 이어 쓴다.
  const entries = useMemo(
    () => allEntries.filter(entry => entry.status === 'completed'),
    [allEntries],
  );
  const [month, setMonth] = useState(
    () => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
  );
  const [selected, setSelected] = useState<string | null>(() =>
    today.startsWith('2026-10') &&
    entries.some(entry => entry.date === '2026-10-21')
      ? '2026-10-21'
      : today,
  );
  const [emptyDate, setEmptyDate] = useState<string | null>(null);
  const cells = monthCells(month.getFullYear(), month.getMonth() + 1);
  const entry = entries.find(item => item.date === selected);
  function changeMonth(offset: number) {
    setMonth(
      value => new Date(value.getFullYear(), value.getMonth() + offset, 1),
    );
    setSelected(null);
  }
  return (
    <Screen tabbed title="캘린더" contentStyle={{ gap: 24 }}>
      <View style={{ gap: 4 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            onPress={() => changeMonth(-1)}
            style={monthButton}
          >
            <Icon name="back" color={colors.muted} />
          </Pressable>
          <AppText variant="heading">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            onPress={() => changeMonth(1)}
            style={monthButton}
          >
            <Icon name="chevronRight" color={colors.muted} />
          </Pressable>
        </View>
        <View className="flex-row">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <View
              key={day}
              style={{
                flex: 1,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption">{day}</AppText>
            </View>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <View key={week} style={{ flexDirection: 'row', gap: 2 }}>
            {cells.slice(week * 7, week * 7 + 7).map((date, index) =>
              date ? (
                <CalendarDay
                  key={date}
                  date={date}
                  entry={entries.find(item => item.date === date)}
                  selected={selected === date}
                  onPress={() => {
                    setSelected(date);
                    if (!entries.some(item => item.date === date))
                      setEmptyDate(date);
                  }}
                />
              ) : (
                <View key={`blank-${index}`} style={{ flex: 1, height: 62 }} />
              ),
            )}
          </View>
        ))}
      </View>
      {entry && (
        <DiaryRow
          entry={entry}
          onPress={() =>
            router.push({ pathname: '/diary/[id]', params: { id: entry.id } })
          }
        />
      )}
      {!entry && (
        <AppText variant="small" style={{ textAlign: 'center' }}>
          모찌가 그린 날을 눌러 보세요.
        </AppText>
      )}
      <Sheet
        visible={!!emptyDate}
        onClose={() => setEmptyDate(null)}
        title="이날은 기록이 없어요"
        eyebrow={emptyDate ? formatDate(emptyDate) : undefined}
      >
        <AppText style={{ textAlign: 'center', color: colors.muted }}>
          모찌가 그린 다른 날을 눌러 보세요.
        </AppText>
        <TextButton label="닫기" onPress={() => setEmptyDate(null)} />
      </Sheet>
    </Screen>
  );
}
const monthButton = {
  width: 48,
  height: 48,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
