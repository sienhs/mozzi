import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CozyScreen as Screen } from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { Popup } from '@/components/ui/Popup';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions } from '@/constants/emotions';
import { formatDate, monthCells, todayKey } from '@/constants/date';
import { cozyColors as colors } from '@/theme/cozy';
import { spacing } from '@/theme/tokens';
import type { DiaryEntry, Emotion } from '@/types/diary';
import { toAppEmotion } from '@/features/diary/serverDiary';
import { useDiary, useMonthly } from '@/features/diary/useDiaryQueries';
import { DiaryDetailBody } from '@/features/diary/DiaryDetailScreen';
import { useDiaryImageActions } from '@/features/diary/useDiaryImageActions';
import { SnowBackdrop } from '@/features/calendar/SnowBackdrop';
import { ChristmasLights } from '@/features/calendar/ChristmasLights';

// 칸 크기는 화면에 남는 공간으로 정한다. 스크롤 없이 한 달이 아래까지 꽉 차게 들어간다.
const CELL_DEFAULT = 62;
const CELL_MIN = 38;

export function CalendarDay({
  date,
  entry,
  selected,
  onPress,
  height = CELL_DEFAULT,
  face = 28,
}: {
  date: string;
  entry?: Pick<DiaryEntry, 'emotion' | 'companion'>;
  selected: boolean;
  onPress: () => void;
  height?: number;
  // 감정 얼굴 크기. 칸이 커지면 함께 키운다.
  face?: number;
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
        height,
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
        paddingTop: 3,
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
      {entry && (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <EmotionImage emotion={entry.emotion} size={face} />
        </View>
      )}
    </Pressable>
  );
}
// 서버 캘린더: 달마다 GET /diaries/monthly로 일기를 쓴 날의 감정을 받고,
// 날짜를 누르면 그날 일기(GET /diaries/daily)를 팝업으로 띄운다. 기록이 없는 날은 없다고만 알린다.
// 화면은 스크롤하지 않고, 달력이 남는 공간을 꽉 채운다.
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
  // 팝업에 띄운 날. 선택(테두리)과 따로 두어 닫아도 고른 날은 남는다.
  const [opened, setOpened] = useState<string | null>(null);
  // 달 버튼으로 밤하늘로 바꾼다. 탭을 옮겨도 캘린더 화면이 살아 있는 동안은 유지된다.
  const [night, setNight] = useState(false);
  const focused = useIsFocused();
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [errorHeight, setErrorHeight] = useState(0);
  const cells = monthCells(month.getFullYear(), month.getMonth() + 1);
  const weeks = cells.length / 7;
  // 카드 안쪽 고정 높이: 위아래 여백 24 + 테두리 2 + 달 이동 줄 48 + 요일 줄 28 + 줄 사이 6씩.
  // 불러오기 실패 안내가 아래에 있으면 그만큼(사이 14 포함) 뺀다.
  const below = monthly.isError ? errorHeight + 14 : 0;
  const cellHeight = space.height
    ? Math.max(
        CELL_MIN,
        Math.floor(
          (space.height - below - 26 - 48 - 28 - 6 * (weeks + 1)) / weeks,
        ),
      )
    : CELL_DEFAULT;
  // 칸 폭: 카드 폭 - 여백 24 - 테두리 2 - 칸 사이 2×6, 일곱 칸. 얼굴은 날짜 숫자 아래 남는 자리를 채운다.
  const cellWidth = space.width ? (space.width - 26 - 12) / 7 : 46;
  const face = Math.max(
    22,
    Math.min(64, Math.floor(cellWidth - 4), cellHeight - 26),
  );
  function changeMonth(offset: number) {
    setMonth(
      value => new Date(value.getFullYear(), value.getMonth() + offset, 1),
    );
    setSelected(null);
  }
  const pick = (date: string) => {
    setSelected(date);
    // 달을 아직 받지 못했으면 기록 없음으로 단정하지 않고 고르기만 한다.
    if (monthly.isSuccess) setOpened(date);
  };
  return (
    <Screen
      tabbed
      scrollable={false}
      title="캘린더"
      titleContent={
        <AppText
          variant="heading"
          style={{ color: night ? colors.white : colors.ink }}
        >
          캘린더
        </AppText>
      }
      action={{
        icon: 'moon',
        label: '밤하늘',
        selected: night,
        color: night ? '#F6D77B' : colors.muted,
        onPress: () => setNight(value => !value),
      }}
      backdrop={<SnowBackdrop night={night} />}
      contentStyle={{
        paddingHorizontal: spacing.page,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
      }}
    >
      {night && focused && <StatusBar style="light" />}
      <View
        style={{ flex: 1, gap: 14 }}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setSpace(value =>
            value.width === width && value.height === height
              ? value
              : { width, height },
          );
        }}
      >
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
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <AppText variant="heading" style={{ color: colors.ink }}>
                {month.getFullYear()}년 {month.getMonth() + 1}월
              </AppText>
              {monthly.isPending && (
                <ActivityIndicator
                  accessibilityLabel="이달의 기록을 불러오고 있어요"
                  size="small"
                  color={colors.primary}
                />
              )}
            </View>
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
          {Array.from({ length: weeks }, (_, week) => (
            <View key={week} style={{ flexDirection: 'row', gap: 2 }}>
              {cells
                .slice(week * 7, week * 7 + 7)
                .map((date, index) =>
                  date ? (
                    <CalendarDay
                      key={date}
                      date={date}
                      height={cellHeight}
                      face={face}
                      entry={
                        recorded.has(date)
                          ? { emotion: recorded.get(date)! }
                          : undefined
                      }
                      selected={selected === date}
                      onPress={() => pick(date)}
                    />
                  ) : (
                    <View
                      key={`blank-${index}`}
                      style={{ flex: 1, height: cellHeight }}
                    />
                  ),
                )}
            </View>
          ))}
          <ChristmasLights />
        </View>
        {monthly.isError && (
          <View
            onLayout={event => setErrorHeight(event.nativeEvent.layout.height)}
          >
            <StatePanel
              compact
              title="이달의 기록을 불러오지 못했어요"
              description="연결 상태를 확인하고 다시 시도해 주세요."
              retry={() => void monthly.refetch()}
              retryLabel="다시 불러오기"
            />
          </View>
        )}
      </View>
      <DayPopup
        date={opened}
        recorded={!!opened && recorded.has(opened)}
        today={today}
        onClose={() => setOpened(null)}
      />
    </Screen>
  );
}

// 그날 기록 팝업. 그림 크기를 화면 높이에 맞춰 줄여 팝업 안에서도 스크롤하지 않는다.
function DayPopup({
  date,
  recorded,
  today,
  onClose,
}: {
  date: string | null;
  recorded: boolean;
  today: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const day = useDiary(date && recorded ? date : undefined);
  const entry = date && recorded ? day.entry : null;
  const actions = useDiaryImageActions(entry);
  // 팝업 안쪽 폭(최대 420 - 여백 36)과 남는 높이(머리줄·감정·한 줄·시각·버튼 약 340) 중 작은 쪽.
  const artworkSize = Math.max(
    150,
    Math.min(Math.min(width - 32, 420) - 36, height * 0.9 - 340),
  );
  return (
    <Popup
      visible={!!date}
      onClose={onClose}
      label={date ? `${formatDate(date)} 기록` : '기록'}
    >
      <AppText
        variant="label"
        numberOfLines={1}
        style={{ textAlign: 'center', color: colors.ink }}
      >
        {date ? formatDate(date) : ''}
      </AppText>
      {!recorded ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <AppText variant="heading" style={{ color: colors.ink }}>
            {date === today
              ? '오늘은 아직 기록이 없어요'
              : '이날은 기록이 없어요'}
          </AppText>
        </View>
      ) : entry ? (
        <View style={{ gap: 12 }}>
          <DiaryDetailBody
            entry={entry}
            artworkSize={artworkSize}
            onNavigate={onClose}
          />
        </View>
      ) : day.isError ? (
        <StatePanel
          compact
          title="기록을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
          retry={day.refetch}
          retryLabel="다시 불러오기"
        />
      ) : (
        <View style={{ height: artworkSize, justifyContent: 'center' }}>
          <Loading label="기록을 불러오고 있어요" />
        </View>
      )}
      {actions.notice && (
        <AppText
          accessibilityLiveRegion="polite"
          variant="small"
          style={{ textAlign: 'center', color: colors.muted }}
        >
          {actions.notice}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {recorded && actions.canSave && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그림 저장"
            accessibilityState={{ busy: actions.busy === 'save' }}
            onPress={actions.save}
            style={[popupAction, { backgroundColor: colors.lavender }]}
          >
            {actions.busy === 'save' ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Icon name="download" size={18} color={colors.muted} />
            )}
            <AppText variant="small" style={{ color: colors.ink }}>
              저장
            </AppText>
          </Pressable>
        )}
        {recorded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기록 공유"
            accessibilityState={{
              disabled: !entry,
              busy: actions.busy === 'share',
            }}
            disabled={!entry}
            onPress={actions.share}
            style={[popupAction, { backgroundColor: colors.lavender }]}
          >
            {actions.busy === 'share' ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Icon name="share" size={18} color={colors.muted} />
            )}
            <AppText variant="small" style={{ color: colors.ink }}>
              공유
            </AppText>
          </Pressable>
        ) : (
          date === today && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="오늘 기록 쓰기"
              onPress={() => {
                onClose();
                router.push('/record/emotion');
              }}
              style={[popupAction, { backgroundColor: colors.lavender }]}
            >
              <Icon name="pencil" size={18} color={colors.muted} />
              <AppText variant="small" style={{ color: colors.ink }}>
                기록 쓰기
              </AppText>
            </Pressable>
          )
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={[popupAction, { flex: 2, backgroundColor: colors.primary }]}
        >
          <AppText variant="small" style={{ color: colors.white }}>
            닫기
          </AppText>
        </Pressable>
      </View>
    </Popup>
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
const popupAction = {
  flex: 1,
  minHeight: 48,
  borderRadius: 16,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 6,
};
