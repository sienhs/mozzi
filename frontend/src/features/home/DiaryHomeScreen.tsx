import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { DiaryArtwork } from '@/components/ui/DiaryCard';
import {
  GenerationProgress,
  Loading,
  PictureState,
  StatePanel,
} from '@/components/ui/Feedback';
import { canResend, canRetry, entryPhase } from '@/stores/useAppStore';
import type { DiaryEntry } from '@/types/diary';
import {
  ImageRequestButton,
  ImageRequestStatus,
  ScenePicker,
  useImageRequest,
} from '@/features/diary/ImageRequestActions';
import { useHome } from '@/features/diary/useDiaryQueries';
import {
  HomeCompletedPage,
  HomeEmptyPage,
  HomeJournalPage,
  HomeMasthead,
  HomeRecentRecord,
} from './HomeJournal';

// 홈 상태는 서버 todayStatus를 따른다.
//   NOT_RECORDED → H-01 · IMAGE_PENDING → H-03 · COMPLETED → H-02(한 줄이 없으면 G-02로 이어짐)
//   IMAGE_FAILED → E-01 다시 그리기 · IMAGE_NOT_REQUESTED → E-01 구조에 다시 보내기
// 서버 COMPLETED는 '그림 완성'이다. 한 줄까지 남겨야(content) 작성 완료로 본다.
function homeCopy(entry: DiaryEntry | null) {
  if (!entry) return { title: '오늘은 어떤 하루였나요?' };
  const phase = entryPhase(entry, false);
  if (phase === 'generating') return { title: '오늘의 모찌를 그리고 있어요' };
  if (phase === 'notRequested')
    return canResend(entry)
      ? {
          title: '그림 요청이 전달되지 않았어요',
          description: '고른 장면으로 다시 보내 주세요.',
        }
      : {
          title: '지금은 그림을 요청할 수 없어요',
          description: '그림으로 남길 활동 태그가 기록에 남아 있지 않아요.',
        };
  if (phase === 'failed')
    return canRetry(entry)
      ? {
          title: '이번 그림은 완성하지 못했어요',
          description: '고른 장면으로 다시 그려요.',
        }
      : { title: '오늘은 그림을 더 그릴 수 없어요' };
  if (phase === 'reviewing') return { title: '그림이 완성됐어요' };
  return { title: '오늘도 한 장 남겼어요' };
}

export function DiaryHomeScreen() {
  const home = useHome();
  const entry = home.today;
  const recent = home.recent;
  const whatIcons = home.data?.todayDiary?.myIcons.WHAT ?? [];
  const request = useImageRequest(entry, whatIcons);
  const phase = entry ? entryPhase(entry, false) : null;
  const openEntry = (item: DiaryEntry) =>
    router.push({
      pathname: '/diary/[id]',
      params: { id: item.id, date: item.date },
    });
  const openGeneration = (id: string) =>
    router.push({ pathname: '/record/generation', params: { id } });
  const copy = homeCopy(entry);
  const loaded = !!home.data;
  const footer =
    !loaded || !entry ? undefined : phase === 'failed' ||
      phase === 'notRequested' ? (
      <ImageRequestButton request={request} />
    ) : phase === 'reviewing' ? (
      <Button
        label="한 줄 남기고 저장하기"
        onPress={() => openGeneration(entry.id)}
      />
    ) : undefined;
  return (
    <Screen
      tabbed
      title="오늘의 모찌"
      titleContent={<HomeMasthead date={home.data?.today} />}
      contentStyle={{ paddingTop: 8, gap: 18 }}
      onTitleLongPress={__DEV__ ? () => router.push('/dev') : undefined}
      footer={footer}
    >
      {!loaded ? (
        home.isError ? (
          <StatePanel
            title="오늘의 기록을 불러오지 못했어요"
            description="연결 상태를 확인하고 다시 시도해 주세요."
            retry={home.refetch}
            retryLabel="다시 불러오기"
          />
        ) : (
          <Loading label="오늘의 기록을 불러오고 있어요" />
        )
      ) : (
        <>
          {!entry && (
            <HomeEmptyPage onRecord={() => router.push('/record/emotion')} />
          )}
          {entry && phase === 'completed' && (
            <HomeCompletedPage entry={entry} onOpen={() => openEntry(entry)} />
          )}
          {entry && phase !== 'completed' && (
            <HomeJournalPage>
              <View
                style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}
              >
                <Heading
                  titleStyle={{ fontSize: 28, lineHeight: 38 }}
                  title={copy.title}
                  description={copy.description}
                />
                {phase === 'reviewing' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="완성된 그림 보기"
                    onPress={() => openGeneration(entry.id)}
                  >
                    <DiaryArtwork uri={entry.imageUrl} />
                  </Pressable>
                )}
                {phase === 'generating' && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="그림 생성 화면 보기"
                      onPress={() => openGeneration(entry.id)}
                    >
                      <PictureState
                        emotion={entry.emotion}
                        companion={entry.companion}
                        generating
                        tone="sage"
                      />
                    </Pressable>
                    <GenerationProgress home />
                  </>
                )}
                {(phase === 'failed' || phase === 'notRequested') && (
                  <>
                    <PictureState
                      emotion={entry.emotion}
                      companion={entry.companion}
                    />
                    <ScenePicker request={request} whatIcons={whatIcons} />
                    <ImageRequestStatus request={request} />
                  </>
                )}
              </View>
            </HomeJournalPage>
          )}
          {(!entry || phase === 'completed') && recent && (
            <HomeRecentRecord
              entry={recent}
              onOpen={() => openEntry(recent)}
              onBrowse={() => router.push('/calendar')}
            />
          )}
        </>
      )}
    </Screen>
  );
}
