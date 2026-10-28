import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { View } from 'react-native';
import { Button, TextButton } from '@/components/ui/Button';
import {
  ErrorBanner,
  GenerationProgress,
  PictureState,
  StatePanel,
} from '@/components/ui/Feedback';
import { Screen, Heading } from '@/components/ui/Screen';
import { MemoInput } from '@/components/ui/Input';
import { DiaryArtwork, DiaryCard } from '@/components/ui/DiaryCard';
import { AppText } from '@/components/ui/Text';
import { EmotionPicker } from '@/components/emotion/Emotion';
import { colors } from '@/theme/tokens';
import type { DiaryTag } from '@/types/diary';
import {
  MEMO_MAX_LENGTH,
  canRetry,
  canRewrite,
  entryPhase,
  useAppStore,
} from '@/stores/useAppStore';
import { retryEntry, rewriteEntry } from './recordActions';
import { tagSummary } from './tagRules';
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

// G-01 그리는 중 · E-03 실패 · G-02 그림 확인 + 오늘의 한 줄 · 완료를 한 경로에서 상태로 나눈다.
export function GenerationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useAppStore(state =>
    state.entries.find(item => item.id === id),
  );
  const memo = useAppStore(state => state.draft.memo);
  const saveStatus = useAppStore(state => state.saveStatus);
  const saveError = useAppStore(state => state.saveError);
  const saving = saveStatus === 'saving';
  const disablePrevention = usePreventRemove(saving);
  if (!entry)
    return (
      <Screen back title="오늘의 기록">
        <StatePanel
          title="기록을 찾지 못했어요"
          description="홈에서 기록을 다시 확인해 주세요."
        />
      </Screen>
    );
  const phase = entryPhase(entry, saving);
  const home = () => router.dismissTo('/home');
  const detail = () => {
    disablePrevention();
    router.replace({ pathname: '/diary/[id]', params: { id: entry.id } });
  };
  const copy = (() => {
    if (phase === 'generating')
      return {
        title: '오늘의 모찌를 그리고 있어요',
        description: '화면을 나가도 계속 그려요.',
      };
    if (phase === 'failed') {
      if (canRewrite(entry))
        return {
          title: '이 내용으로는 그림을 그릴 수 없어요',
          description: '기분과 태그를 고쳐서 다시 써 주세요.',
        };
      if (canRetry(entry))
        return {
          title: '그림을 완성하지 못했어요',
          description: '고른 태그로 한 번 더 그려 볼게요.',
        };
      return {
        title: '오늘은 그림을 더 그릴 수 없어요',
        description: '그리기 횟수를 모두 썼어요.',
      };
    }
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
        <Button label="홈에서 기다리기" variant="secondary" onPress={home} />
      );
    if (phase === 'failed')
      return (
        <>
          {canRewrite(entry) ? (
            <Button
              label="다시 작성하기"
              onPress={() => rewriteEntry(entry, 'generation')}
            />
          ) : canRetry(entry) ? (
            <Button label="다시 그리기" onPress={() => retryEntry(entry)} />
          ) : null}
          <TextButton label="홈으로" onPress={home} />
        </>
      );
    if (phase === 'completed')
      return (
        <>
          <Button label="기록 자세히 보기" onPress={detail} />
          <TextButton label="홈으로" onPress={home} />
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
          onPress={() => void useAppStore.getState().completeDiary(entry.id)}
        />
        {!saving && <TextButton label="홈으로" onPress={home} />}
      </>
    );
  })();
  const blocked = entry.failure?.blockedTags ?? [];
  return (
    <Screen
      action={{ icon: 'close', label: '홈으로', onPress: home }}
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
        <DiaryArtwork />
      ) : (
        <PictureState
          emotion={entry.emotion}
          companionId={entry.companionId}
          generating={phase === 'generating'}
          tone="sage"
        />
      )}
      {phase === 'generating' && <GenerationProgress />}
      {(phase === 'reviewing' || phase === 'saving') && (
        <MemoInput
          label="오늘의 한 줄 (선택)"
          placeholder="그림을 보고 떠오른 한 줄을 남겨 보세요"
          maxLength={MEMO_MAX_LENGTH}
          value={memo}
          editable={!saving}
          onChangeText={useAppStore.getState().setMemo}
        />
      )}
      {phase !== 'completed' && (
        <UsedTags
          tags={blocked.length ? blocked : (entry.imageTags ?? entry.tags)}
          label={
            blocked.length
              ? '다시 볼 태그'
              : phase === 'generating'
                ? '이 태그로 그리고 있어요'
                : '이 태그로 그렸어요'
          }
        />
      )}
      {saveStatus === 'error' && phase === 'reviewing' && (
        <ErrorBanner message={saveError} />
      )}
    </Screen>
  );
}
