import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { CozyScreen as Screen } from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { TextButton } from '@/components/ui/Button';
import { DiaryRow } from '@/components/ui/DiaryCard';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions } from '@/constants/emotions';
import { formatDate, monthCells, todayKey } from '@/constants/date';
import { cozyColors as colors } from '@/theme/cozy';
import type { DiaryEntry, Emotion } from '@/types/diary';
import { toAppEmotion } from '@/features/diary/serverDiary';
import { useDiary, useMonthly } from '@/features/diary/useDiaryQueries';

export function CalendarDay({
  date,
  entry,
  selected,
  onPress,
}: {
  date: string;
  entry?: Pick<DiaryEntry, 'emotion' | 'companion'>;
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
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : 'transparent',
        backgroundColor: selected
          ? colors.soft
          : date === todayKey()
            ? colors.roseWash
            : 'transparent',
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
      {/* 날짜 셀은 장착 모찌와 관계없이 기본 감정 이미지로 표시한다. */}
      {entry && <EmotionImage emotion={entry.emotion} size={28} />}
    </Pressable>
  );
}
// 서버 캘린더: 달마다 GET /diaries/monthly로 일기를 쓴 날의 감정을 받고,
// 날짜를 누르면 그날 일기를 GET /diaries/daily로 불러 한 줄(없으면 감정 기본 제목)을 보여 준다.
const monthKey = (month: Date) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
export function CalendarScreen() {
  const today = todayKey();
  const [month, setMonth] = useState(
    () => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
  );
  const monthly = useMonthly(monthKey(month));
  const recorded = useMemo(
    () =>
      new Map<string, Emotion>(
        (monthly.data ?? []).map(item => [
          item.recordDate,
          toAppEmotion(item.emotion),
        ]),
      ),
    [monthly.data],
  );
  const [selected, setSelected] = useState<string | null>(today);
  const [emptyDate, setEmptyDate] = useState<string | null>(null);
  const cells = monthCells(month.getFullYear(), month.getMonth() + 1);
  const selectedRecorded = !!selected && recorded.has(selected);
  const day = useDiary(selectedRecorded ? selected! : undefined);
  const entry = selectedRecorded ? day.entry : null;
  function changeMonth(offset: number) {
    setMonth(
      value => new Date(value.getFullYear(), value.getMonth() + offset, 1),
    );
    setSelected(null);
  }
  return (
    <Screen tabbed title="캘린더" contentStyle={{ gap: 24 }}>
      <View
        style={{
          gap: 6,
          backgroundColor: colors.paper,
          padding: 12,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.paperEdge,
          boxShadow: '0 4px 18px rgba(130, 86, 97, 0.05)',
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            onPress={() => changeMonth(-1)}
            style={monthButton}
          >
            <Icon name="back" color={colors.muted} />
          </Pressable>
          <AppText variant="heading" style={{ color: colors.ink }}>
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
                  entry={
                    recorded.has(date)
                      ? { emotion: recorded.get(date)! }
                      : undefined
                  }
                  selected={selected === date}
                  onPress={() => {
                    setSelected(date);
                    // 달을 아직 받지 못했으면 기록 없음으로 단정하지 않는다.
                    if (monthly.isSuccess && !recorded.has(date))
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
      {monthly.isError ? (
        <StatePanel
          compact
          title="이달의 기록을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
          retry={() => void monthly.refetch()}
          retryLabel="다시 불러오기"
        />
      ) : monthly.isPending ? (
        <Loading label="이달의 기록을 불러오고 있어요" />
      ) : entry ? (
        <DiaryRow
          entry={entry}
          onPress={() =>
            router.push({
              pathname: '/diary/[id]',
              params: { id: entry.id, date: entry.date },
            })
          }
        />
      ) : selectedRecorded && day.isError ? (
        <StatePanel
          compact
          title="기록을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
          retry={day.refetch}
          retryLabel="다시 불러오기"
        />
      ) : selectedRecorded ? (
        <Loading label="기록을 불러오고 있어요" />
      ) : (
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
  borderRadius: 16,
  backgroundColor: colors.lavender,
};
