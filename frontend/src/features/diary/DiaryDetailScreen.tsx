import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import {
  CozyScreen as Screen,
  CozyButton as Button,
} from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { DiaryArtwork, DiaryMeta } from '@/components/ui/DiaryCard';
import { Loading, PictureState, StatePanel } from '@/components/ui/Feedback';
import { formatDate, formatTime } from '@/constants/date';
import { cozyColors as colors } from '@/theme/cozy';
import type { DiaryEntry } from '@/types/diary';
import {
  canResend,
  canRetry,
  entryPhase,
  useAppStore,
} from '@/stores/useAppStore';
import { useDiary } from './useDiaryQueries';
import { completedDiaryPreview } from '@/mocks/diaryPreview';
import { shareDiary } from '@/services/diaryImage';

// 서버 기록은 날짜로 조회한다 (GET /diaries/daily — 서버에 ID 단건 조회가 없다).
// 날짜 없이 들어오면 검색이 아직 쓰는 로컬 샘플 기록에서 찾는다.
export function DiaryDetailScreen() {
  const { id, date, preview, previewImage } = useLocalSearchParams<{
    id: string;
    date?: string;
    preview?: string;
    previewImage?: string;
  }>();
  const local = useAppStore(state =>
    date ? undefined : state.entries.find(item => item.id === id),
  );
  const server = useDiary(date);
  const previewEntry =
    __DEV__ && preview === 'completed'
      ? completedDiaryPreview(
          server.entry ?? local,
          date,
          previewImage === 'portrait',
        )
      : null;
  if (date && !server.entry && !previewEntry) {
    return (
      <Screen title={formatDate(date)} back>
        {server.isPending ? (
          <Loading label="기록을 불러오고 있어요" />
        ) : server.isError ? (
          <StatePanel
            title="기록을 불러오지 못했어요"
            description="연결 상태를 확인하고 다시 시도해 주세요."
            retry={server.refetch}
            retryLabel="다시 불러오기"
          />
        ) : (
          <NotFound />
        )}
      </Screen>
    );
  }
  const entry = previewEntry ?? (date ? server.entry : local);
  if (!entry)
    return (
      <Screen title="기록 상세" back>
        <NotFound />
      </Screen>
    );
  return <DiaryDetail entry={entry} />;
}
function NotFound() {
  return (
    <>
      <StatePanel
        title="기록을 찾지 못했어요"
        description="캘린더에서 다른 날을 눌러 보세요."
      />
      <Button label="캘린더로" onPress={() => router.replace('/calendar')} />
    </>
  );
}
function DiaryDetail({ entry }: { entry: DiaryEntry }) {
  return (
    <Screen
      title={formatDate(entry.date)}
      back
      action={{
        icon: 'share',
        label: '기록 공유',
        onPress: () => void shareDiary(entry),
      }}
      contentStyle={{ gap: 20 }}
    >
      <DiaryDetailBody entry={entry} />
    </Screen>
  );
}
// 상세 화면과 캘린더가 같은 내용을 펼쳐 보여 준다.
// artworkSize를 주면 그림을 그 폭(정사각형)으로 줄여 팝업처럼 높이가 정해진 곳에 맞춘다.
export function DiaryDetailBody({
  entry,
  artworkSize,
  onNavigate,
}: {
  entry: DiaryEntry;
  artworkSize?: number;
  // 다른 화면으로 넘어가기 직전에 부른다(팝업을 닫는 데 쓴다).
  onNavigate?: () => void;
}) {
  const phase = entryPhase(entry, false);
  // 다시 그리기·한 줄 쓰기는 오늘 기록의 생성 화면에서 한다.
  const openGeneration = () => {
    onNavigate?.();
    router.push({ pathname: '/record/generation', params: { id: entry.id } });
  };
  return (
    <>
      <View
        style={
          artworkSize ? { width: artworkSize, alignSelf: 'center' } : undefined
        }
      >
        {entry.generation === 'ready' ? (
          <DiaryArtwork uri={entry.imageUrl} />
        ) : (
          <PictureState
            emotion={entry.emotion}
            companion={entry.companion}
            generating={entry.generation === 'generating'}
            tone="sage"
            caption={
              entry.generation === 'failed'
                ? '그림을 완성하지 못했어요'
                : entry.generation === 'notRequested'
                  ? '그림을 요청하지 않았어요'
                  : undefined
            }
          />
        )}
      </View>
      <DiaryMeta entry={entry} />
      {entry.status === 'completed' && (
        <AppText>{entry.memo || entry.title}</AppText>
      )}
      {entry.serverId && phase === 'reviewing' && (
        <Button label="한 줄 남기고 저장하기" onPress={openGeneration} />
      )}
      {entry.serverId &&
        ((phase === 'failed' && canRetry(entry)) ||
          (phase === 'notRequested' && canResend(entry))) && (
          <Button
            label={phase === 'failed' ? '다시 그리기' : '다시 보내기'}
            onPress={openGeneration}
          />
        )}
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <AppText variant="caption">
        {formatTime(entry.createdAt)}에 남긴 기록
      </AppText>
    </>
  );
}
