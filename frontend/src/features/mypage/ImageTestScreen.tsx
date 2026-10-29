import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DiaryArtwork } from '@/components/ui/DiaryCard';
import { TagChip } from '@/components/ui/Selection';
import {
  ErrorBanner,
  Loading,
  PictureState,
  StatePanel,
} from '@/components/ui/Feedback';
import { emotions } from '@/constants/emotions';
import { formatDate } from '@/constants/date';
import { colors } from '@/theme/tokens';
import { apiErrorMessage } from '@/services/authErrors';
import {
  diaryApi,
  diaryKeys,
  PROVISIONAL_CHARACTER_ID,
} from '@/services/diaryApi';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { createRequestKey } from '@/utils/requestKey';
import { fallbackTitle, toAppEmotion } from '@/features/diary/serverDiary';
import { useDiary } from '@/features/diary/useDiaryQueries';
import type {
  DiarySummary,
  MyIcon,
  ServerWeather,
  TimeOfDay,
} from '@/types/server';

// [테스트·임시] 그림 테스트 (POST /diaries/{id}/image/test, S15P31D102-132).
// 일기를 고르고 장면을 정해 제한 없이 다시 그린다. 백엔드가 테스트 API를 지우면 이 화면도 지운다.
const weathers: { value: ServerWeather; label: string }[] = [
  { value: 'NONE', label: '없음' },
  { value: 'SUNNY', label: '맑음' },
  { value: 'CLOUDY', label: '흐림' },
  { value: 'RAINY', label: '비' },
  { value: 'SNOWY', label: '눈' },
];
const times: { value: TimeOfDay | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 'MORNING', label: '아침' },
  { value: 'LUNCH', label: '점심' },
  { value: 'EVENING', label: '저녁' },
];
const statusLabel = {
  PENDING: '그리는 중',
  SUCCEEDED: '완성',
  FAILED: '실패',
} as const;

export function ImageTestScreen() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const [selected, setSelected] = useState<DiarySummary | null>(null);
  const recent = useQuery({
    queryKey: diaryKeys.recent(memberId ?? 0),
    queryFn: () => diaryApi.recent(),
    enabled: memberId !== undefined,
    staleTime: 0,
  });
  return (
    <Screen back title="그림 테스트" contentStyle={{ gap: 16 }}>
      <View
        style={{
          backgroundColor: colors.sageSoft,
          borderRadius: 16,
          padding: 14,
          gap: 4,
        }}
      >
        <AppText variant="label">테스트용 임시 화면이에요</AppText>
        <AppText variant="small">
          지난 일기도 다시 그리고, 완성된 그림은 새 그림으로 바뀌어요. 실패하면
          실패 횟수가 올라가 일반 다시 그리기가 막힐 수 있어요.
        </AppText>
      </View>
      {selected ? (
        <DiaryTest diary={selected} onBack={() => setSelected(null)} />
      ) : recent.data ? (
        recent.data.length ? (
          <View style={{ gap: 8 }}>
            <AppText variant="label">테스트할 일기를 골라 주세요</AppText>
            {recent.data.map(diary => (
              <DiaryChoice
                key={diary.diaryId}
                diary={diary}
                onPress={() => setSelected(diary)}
              />
            ))}
          </View>
        ) : (
          <StatePanel
            compact
            title="아직 일기가 없어요"
            description="먼저 오늘의 일기를 남겨 주세요."
          />
        )
      ) : recent.isError ? (
        <StatePanel
          compact
          title="일기를 불러오지 못했어요"
          description={apiErrorMessage(
            recent.error,
            '연결 상태를 확인하고 다시 시도해 주세요.',
          )}
          retry={() => void recent.refetch()}
          retryLabel="다시 불러오기"
        />
      ) : (
        <Loading label="일기를 불러오고 있어요" />
      )}
    </Screen>
  );
}

function DiaryChoice({
  diary,
  onPress,
}: {
  diary: DiarySummary;
  onPress: () => void;
}) {
  const emotion = toAppEmotion(diary.emotion);
  const status = diary.image ? statusLabel[diary.image.status] : '그림 없음';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(diary.recordDate)} 일기 테스트`}
      onPress={onPress}
      style={{
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.paperEdge,
        borderRadius: 16,
        padding: 14,
        gap: 2,
      }}
    >
      <AppText variant="label">
        {formatDate(diary.recordDate)} · {emotions[emotion].label}
      </AppText>
      <AppText variant="small" numberOfLines={1}>
        {diary.content ?? fallbackTitle(emotion)}
      </AppText>
      <AppText variant="caption">그림 {status}</AppText>
    </Pressable>
  );
}

function IconChoices({
  title,
  icons,
  value,
  onChange,
  optional,
}: {
  title: string;
  icons: MyIcon[];
  value: number | null;
  onChange: (id: number | null) => void;
  optional?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{title}</AppText>
      {icons.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {optional && (
            <TagChip
              label="없음"
              single
              selected={value === null}
              onPress={() => onChange(null)}
            />
          )}
          {icons.map(icon => (
            <TagChip
              key={icon.myIconId}
              label={icon.name}
              single
              selected={value === icon.myIconId}
              onPress={() => onChange(icon.myIconId)}
            />
          ))}
        </View>
      ) : (
        <AppText variant="small">이 일기에 남은 태그가 없어요.</AppText>
      )}
    </View>
  );
}

function DiaryTest({
  diary,
  onBack,
}: {
  diary: DiarySummary;
  onBack: () => void;
}) {
  const memberId = useAuthStore(state => state.member?.memberId);
  const current = useDiary(diary.recordDate);
  const detail = current.detail;
  const [what, setWhat] = useState<number | null>(null);
  const [where, setWhere] = useState<number | null>(null);
  const [who, setWho] = useState<number | null>(null);
  const [weather, setWeather] = useState<ServerWeather>('NONE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | null>(null);
  const [error, setError] = useState('');
  const request = useMutation({
    mutationFn: () =>
      diaryApi.requestImageTest(
        diary.diaryId,
        {
          characterId: PROVISIONAL_CHARACTER_ID,
          weather,
          timeOfDay,
          whereMyIconId: where,
          whoMyIconId: who,
          whatMyIconId: what!,
        },
        createRequestKey(),
      ),
    onMutate: () => setError(''),
    onSuccess: () => {
      if (memberId !== undefined)
        void queryClient.invalidateQueries({
          queryKey: diaryKeys.all(memberId),
        });
    },
    onError: failure =>
      setError(apiErrorMessage(failure, '테스트 그림을 부탁하지 못했어요.')),
  });
  if (!detail)
    return current.isError ? (
      <StatePanel
        compact
        title="일기를 불러오지 못했어요"
        description="연결 상태를 확인하고 다시 시도해 주세요."
        retry={current.refetch}
        retryLabel="다시 불러오기"
      />
    ) : current.notFound ? (
      <StatePanel
        compact
        title="일기를 찾지 못했어요"
        description="다른 일기를 골라 주세요."
      />
    ) : (
      <Loading label="일기를 불러오고 있어요" />
    );
  const emotion = toAppEmotion(detail.emotion);
  const image = detail.image;
  const pending = image?.status === 'PENDING';
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <AppText variant="heading">
          {formatDate(detail.recordDate)} · {emotions[emotion].label}
        </AppText>
        <AppText variant="small">
          {detail.content ?? fallbackTitle(emotion)}
        </AppText>
        <AppText variant="caption">
          지금 그림: {image ? statusLabel[image.status] : '그림 없음'}
        </AppText>
      </View>
      {image?.status === 'SUCCEEDED' ? (
        <DiaryArtwork uri={image.imageUrl} />
      ) : (
        <PictureState emotion={emotion} generating={pending} />
      )}
      <IconChoices
        title="무엇을 (필수)"
        icons={detail.myIcons.WHAT}
        value={what}
        onChange={setWhat}
      />
      <IconChoices
        title="어디서"
        icons={detail.myIcons.WHERE}
        value={where}
        onChange={setWhere}
        optional
      />
      <IconChoices
        title="누구와"
        icons={detail.myIcons.WHO}
        value={who}
        onChange={setWho}
        optional
      />
      <View style={{ gap: 8 }}>
        <AppText variant="label">날씨</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {weathers.map(item => (
            <TagChip
              key={item.value}
              label={item.label}
              single
              selected={weather === item.value}
              onPress={() => setWeather(item.value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">시간대</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {times.map(item => (
            <TagChip
              key={item.label}
              label={item.label}
              single
              selected={timeOfDay === item.value}
              onPress={() => setTimeOfDay(item.value)}
            />
          ))}
        </View>
      </View>
      {!!error && <ErrorBanner message={error} />}
      {pending && (
        <AppText variant="small">
          그리는 중에는 새로 부탁할 수 없어요. 결과는 자동으로 다시 확인해요.
        </AppText>
      )}
      <Button
        label={request.isPending ? '부탁하고 있어요' : '테스트 그림 만들기'}
        loading={request.isPending}
        disabled={what === null || pending}
        onPress={() => request.mutate()}
      />
      <Button label="다른 일기 고르기" variant="secondary" onPress={onBack} />
    </View>
  );
}
