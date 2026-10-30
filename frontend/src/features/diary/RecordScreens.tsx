import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { View } from 'react-native';
import { TextButton } from '@/components/ui/Button';
import {
  CozyButton as Button,
  CozyScreen as Screen,
} from '@/components/ui/CozyUI';
import {
  ErrorBanner,
  GenerationProgress,
  Loading,
  PictureState,
  StatePanel,
} from '@/components/ui/Feedback';
import { Heading } from '@/components/ui/Screen';
import { MemoInput } from '@/components/ui/Input';
import { DiaryArtwork, DiaryCard } from '@/components/ui/DiaryCard';
import { AppText } from '@/components/ui/Text';
import { EmotionPicker } from '@/components/emotion/Emotion';
import { cozyColors as colors } from '@/theme/cozy';
import type { DiaryTag } from '@/types/diary';
import {
  MEMO_MAX_LENGTH,
  canResend,
  canRetry,
  entryPhase,
  useAppStore,
} from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { CONTENT_SAVE_SUPPORTED } from '@/services/diaryApi';
import {
  ImageRequestButton,
  ImageRequestStatus,
  ScenePicker,
  useImageRequest,
} from './ImageRequestActions';
import { tagSummary } from './tagRules';
import { useHome } from './useDiaryQueries';
import { useRecordGuard } from './useRecordGuard';

export function EmotionScreen() {
  const locked = useRecordGuard();
  const emotion = useAppStore(state => state.draft.emotion);
  const selectEmotion = useAppStore(state => state.selectEmotion);
  if (locked) return null;
  return (
    <Screen
      title="오늘의 기록"
      back
      footer={
        <Button
          label="다음"
          disabled={!emotion}
          onPress={() => router.push('/record/tags')}
        />
      }
    >
      <Heading
        eyebrow="1 / 4"
        title="오늘 기분은 어땠나요?"
        description="가장 가까운 모찌를 하나 골라 주세요."
      />
      <EmotionPicker value={emotion} onChange={selectEmotion} />
    </Screen>
  );
}

function UsedTags({ tags, label }: { tags: DiaryTag[]; label: string }) {
  if (!tags.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="small" style={{ color: colors.ink }}>
        {tagSummary(tags)}
      </AppText>
    </View>
  );
}

// G-01 그리는 중 · E-03 실패 · E-01 요청 유실 · G-02 그림 확인 + 오늘의 한 줄 · 완료를 한 경로에서 상태로 나눈다.
// 상태는 서버(GET /home)가 정한다. 그리는 중에는 화면이 보일 때만 주기적으로 다시 읽는다.
export function GenerationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const home = useHome();
  const entry = home.today?.id === id ? home.today : null;
  const whatIcons =
    home.data?.todayDiary?.diaryId === entry?.serverId
      ? (home.data?.todayDiary?.myIcons.WHAT ?? [])
      : [];
  const request = useImageRequest(entry, whatIcons);
  const memo = useAppStore(state => state.draft.memo);
  const saveStatus = useAppStore(state => state.saveStatus);
  const saveError = useAppStore(state => state.saveError);
  const saving = saveStatus === 'saving';
  const disablePrevention = usePreventRemove(saving);
  const goHome = () => router.dismissTo('/home');
  if (!entry)
    return (
      <Screen back title="오늘의 기록">
        {home.isPending ? (
          <Loading label="오늘의 기록을 불러오고 있어요" />
        ) : home.isError ? (
          <StatePanel
            title="기록을 불러오지 못했어요"
            description="연결 상태를 확인하고 다시 시도해 주세요."
            retry={home.refetch}
            retryLabel="다시 불러오기"
          />
        ) : (
          <StatePanel
            title="기록을 찾지 못했어요"
            description="홈에서 오늘의 기록을 다시 확인해 주세요."
          />
        )}
      </Screen>
    );
  const phase = entryPhase(entry, saving);
  const detail = () => {
    disablePrevention();
    router.replace({
      pathname: '/diary/[id]',
      params: { id: entry.id, date: entry.date },
    });
  };
  const copy = (() => {
    if (phase === 'generating')
      return {
        title: '오늘의 모찌를 그리고 있어요',
        description: '화면을 나가도 계속 그려요.',
      };
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
            title: '그림을 완성하지 못했어요',
            description: '고른 장면으로 한 번 더 그려 볼게요.',
          }
        : {
            title: '오늘은 그림을 더 그릴 수 없어요',
            description: '그리기 횟수를 모두 썼어요.',
          };
    if (phase === 'completed')
      return {
        title: '오늘도 한 장 남겼어요',
        description: '모찌가 오늘의 장면을 완성했어요.',
      };
    return { title: '그림이 완성됐어요', description: undefined };
  })();
  const footer = (() => {
    if (phase === 'generating')
      return (
        <Button label="홈에서 기다리기" variant="secondary" onPress={goHome} />
      );
    if (phase === 'failed' || phase === 'notRequested')
      return (
        <>
          <ImageRequestButton request={request} />
          <TextButton label="홈으로" onPress={goHome} />
        </>
      );
    if (phase === 'completed')
      return (
        <>
          <Button label="기록 자세히 보기" onPress={detail} />
          <TextButton label="홈으로" onPress={goHome} />
        </>
      );
    return (
      <>
        <Button
          label={
            saving
              ? '저장하고 있어요'
              : saveStatus === 'error'
                ? '다시 저장하기'
                : '기록 저장하기'
          }
          loading={saving}
          disabled={!CONTENT_SAVE_SUPPORTED}
          onPress={() => {
            const memberId = useAuthStore.getState().member?.memberId;
            if (memberId !== undefined && entry.serverId)
              void useAppStore
                .getState()
                .completeDiary(memberId, entry.serverId);
          }}
        />
        {!saving && <TextButton label="홈으로" onPress={goHome} />}
      </>
    );
  })();
  return (
    <Screen
      action={{ icon: 'close', label: '홈으로', onPress: goHome }}
      footer={footer}
    >
      <Heading
        eyebrow={
          phase === 'reviewing' || phase === 'saving' ? '4 / 4' : undefined
        }
        title={copy.title}
        description={copy.description}
      />
      {phase === 'completed' ? (
        <DiaryCard entry={entry} />
      ) : phase === 'reviewing' || phase === 'saving' ? (
        <DiaryArtwork uri={entry.imageUrl} />
      ) : (
        <PictureState
          emotion={entry.emotion}
          companion={entry.companion}
          generating={phase === 'generating'}
          tone="sage"
        />
      )}
      {phase === 'generating' && <GenerationProgress />}
      {(phase === 'failed' || phase === 'notRequested') && (
        <>
          <ScenePicker request={request} whatIcons={whatIcons} />
          <ImageRequestStatus request={request} />
        </>
      )}
      {(phase === 'reviewing' || phase === 'saving') && (
        <>
          <MemoInput
            label="오늘의 한 줄 (선택)"
            placeholder="그림을 보고 떠오른 한 줄을 남겨 보세요"
            maxLength={MEMO_MAX_LENGTH}
            value={memo}
            editable={CONTENT_SAVE_SUPPORTED && !saving}
            onChangeText={useAppStore.getState().setMemo}
          />
          {!CONTENT_SAVE_SUPPORTED && (
            <AppText variant="caption">
              한 줄 저장은 서버에서 준비 중이에요. 그림은 이미 저장됐어요.
            </AppText>
          )}
        </>
      )}
      {phase !== 'completed' && (
        <UsedTags
          tags={entry.imageTags ?? entry.tags}
          label={
            phase === 'generating'
              ? '이 태그로 그리고 있어요'
              : entry.imageTags
                ? '이 태그로 그렸어요'
                : '오늘 고른 태그'
          }
        />
      )}
      {saveStatus === 'error' && phase === 'reviewing' && (
        <ErrorBanner message={saveError} />
      )}
    </Screen>
  );
}
