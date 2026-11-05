import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Heading } from '@/components/ui/Screen';
import { CozyScreen as Screen } from '@/components/ui/CozyUI';
import { Loading, PictureState, StatePanel } from '@/components/ui/Feedback';
import { canResend, canRetry } from '@/stores/useAppStore';
import type { DiaryEntry } from '@/types/diary';
import {
  ImageRequestButton,
  ImageRequestStatus,
  ScenePicker,
  useImageRequest,
} from '@/features/diary/ImageRequestActions';
import { useHome, usePastDiaries } from '@/features/diary/useDiaryQueries';
import {
  HomeCompletedPage,
  HomeEmptyPage,
  HomeGeneratingPage,
  HomeJournalPage,
  HomeMasthead,
  PageHint,
} from './HomeJournal';
import { HomePager, type PagerControls } from './HomePager';
import { ChristmasCard, WinterBackdrop } from './HomeChristmas';
import { completedDiaryPreview } from '@/mocks/diaryPreview';
import { FeedbackPrompt } from '@/features/feedback/FeedbackPrompt';
import { spacing } from '@/theme/tokens';

// 홈 상태는 서버 todayStatus를 따른다.
//   NOT_RECORDED → EMPTY · IMAGE_PENDING → GENERATING · COMPLETED → 완성 카드
//   IMAGE_FAILED → E-01 다시 그리기 · IMAGE_NOT_REQUESTED → E-01 구조에 다시 보내기
// 한 줄 작성 여부와 무관하게 그림이 완성되면 완성 카드를 표시한다.
function recoveryCopy(entry: DiaryEntry) {
  if (entry.generation === 'notRequested')
    return canResend(entry)
      ? {
          title: '그림 요청이 전달되지 않았어요',
          description: '고른 장면으로 다시 보내 주세요.',
        }
      : {
          title: '지금은 그림을 요청할 수 없어요',
          description: '그림으로 남길 활동 태그가 기록에 남아 있지 않아요.',
        };
  return canRetry(entry)
    ? {
        title: '이번 그림은 완성하지 못했어요',
        description: '고른 장면으로 다시 그려요.',
      }
    : { title: '오늘은 그림을 더 그릴 수 없어요' };
}

export function DiaryHomeScreen() {
  const { preview, previewImage } = useLocalSearchParams<{
    preview?: string;
    previewImage?: string;
  }>();
  const previewEmpty = __DEV__ && preview === 'empty';
  const previewCompleted = __DEV__ && preview === 'completed';
  const isPreview = previewEmpty || previewCompleted;
  const home = useHome();
  const [page, setPage] = useState(0);
  // 미리 보기 화면은 서버 기록을 섞지 않는다.
  const past = usePastDiaries(isPreview ? undefined : home.data?.today);
  // Presentation only: never change the server diary or its query cache.
  const entry = previewEmpty
    ? null
    : previewCompleted
      ? completedDiaryPreview(
          home.today,
          home.data?.today,
          previewImage === 'portrait',
        )
      : home.today;
  const whatIcons = home.data?.todayDiary?.myIcons.WHAT ?? [];
  const request = useImageRequest(entry, whatIcons);
  // Image completion is independent of the optional one-line writing step.
  const completed =
    (previewCompleted || home.data?.todayStatus === 'COMPLETED') &&
    entry?.generation === 'ready' &&
    !!entry.imageUrl;
  const generating =
    home.data?.todayStatus === 'IMAGE_PENDING' &&
    entry?.generation === 'generating';
  const empty =
    previewEmpty || (home.data?.todayStatus === 'NOT_RECORDED' && !entry);
  const recovering =
    entry?.generation === 'failed' || entry?.generation === 'notRequested';
  const loaded = isPreview || !!home.data;
  // 오늘 장 머리줄 끝: 지난 기록이 있으면 넘겨 볼 수 있다고 알린다(버튼으로도 넘어간다).
  const olderHint = (controls: PagerControls) =>
    past.entries.length ? (
      <PageHint label="지난 날" onPress={() => controls.goTo(1)} />
    ) : undefined;
  const todayPage = (controls: PagerControls) => {
    const trailing = olderHint(controls);
    return (
      <>
        {empty && (
          <HomeEmptyPage
            trailing={trailing}
            onRecord={() => router.push('/record/emotion')}
          />
        )}
        {entry && completed && (
          <HomeCompletedPage entry={entry} trailing={trailing} />
        )}
        {entry && generating && <HomeGeneratingPage trailing={trailing} />}
        {entry && recovering && (
          <HomeJournalPage trailing={trailing}>
            <ChristmasCard>
              <View style={{ paddingBottom: 12, gap: 14 }}>
                <Heading
                  titleStyle={{ fontSize: 24, lineHeight: 34 }}
                  {...recoveryCopy(entry)}
                />
                <PictureState
                  emotion={entry.emotion}
                  companion={entry.companion}
                  ratio={3}
                />
                <ScenePicker request={request} whatIcons={whatIcons} />
                <ImageRequestStatus request={request} />
              </View>
            </ChristmasCard>
          </HomeJournalPage>
        )}
        {!empty && !completed && !generating && !recovering && (
          <StatePanel
            title="오늘의 그림을 확인하고 있어요"
            description="최신 그림 상태를 다시 불러와 주세요."
            retry={home.refetch}
            retryLabel="다시 불러오기"
          />
        )}
      </>
    );
  };
  // 다시 그리기 버튼은 오늘 장을 볼 때만 둔다.
  const footer =
    loaded && recovering && page === 0 ? (
      <ImageRequestButton request={request} />
    ) : undefined;
  return (
    <Screen
      tabbed
      scrollable={false}
      title="오늘의 모찌"
      backdrop={<WinterBackdrop />}
      titleContent={<HomeMasthead date={home.data?.today} />}
      contentStyle={{
        paddingTop: 0,
        paddingBottom: 12,
        gap: 8,
        overflow: 'hidden',
      }}
      onTitleLongPress={
        __DEV__
          ? () => (isPreview ? router.replace('/home') : router.push('/dev'))
          : undefined
      }
      footer={footer}
    >
      {!isPreview && (
        <FeedbackPrompt
          recorded={
            (!!home.data && home.data.todayStatus !== 'NOT_RECORDED') ||
            past.entries.length > 0
          }
        />
      )}
      {!loaded ? (
        <View style={pageStyle}>
          {home.isError ? (
            <StatePanel
              title="오늘의 기록을 불러오지 못했어요"
              description="연결 상태를 확인하고 다시 시도해 주세요."
              retry={home.refetch}
              retryLabel="다시 불러오기"
            />
          ) : (
            <Loading label="오늘의 기록을 불러오고 있어요" />
          )}
        </View>
      ) : (
        <HomePager
          count={past.entries.length + 1}
          onNearEnd={past.loadMore}
          onIndexChange={setPage}
          renderPage={(page, controls) =>
            page === 0 ? (
              <View style={pageStyle}>{todayPage(controls)}</View>
            ) : (
              <View style={pageStyle}>
                <HomeCompletedPage
                  entry={past.entries[page - 1]}
                  label="지난 한 페이지"
                  trailing={
                    <PageHint label="오늘로" onPress={() => controls.goTo(0)} />
                  }
                />
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}
// 넘기는 장마다 좌우 여백을 넣어 장 전체가 화면 끝까지 밀려 나간다.
const pageStyle = { flex: 1, paddingHorizontal: spacing.page };
