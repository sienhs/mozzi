import { useEffect, useRef } from 'react';
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
import { ActivityChip } from '@/components/ui/Selection';
import { DiaryCard } from '@/components/ui/DiaryCard';
import { EmotionPicker } from '@/components/emotion/Emotion';
import { activities } from '@/constants/emotions';
import { useAppStore } from '@/stores/useAppStore';

export function EmotionScreen() {
  const emotion = useAppStore(state => state.draft.emotion);
  const selectEmotion = useAppStore(state => state.selectEmotion);
  return (
    <Screen
      title="오늘의 기록"
      back
      footer={
        <Button
          label="다음"
          disabled={!emotion}
          onPress={() => router.push('/record/memo')}
        />
      }
    >
      <Heading
        eyebrow="1 / 2"
        title="오늘 기분은 어땠나요?"
        description="가장 가까운 모찌를 하나 골라 주세요."
      />
      <EmotionPicker value={emotion} onChange={selectEmotion} />
    </Screen>
  );
}
export function MemoScreen() {
  const draft = useAppStore(state => state.draft);
  const status = useAppStore(state => state.saveStatus);
  const error = useAppStore(state => state.saveError);
  const busy = status === 'saving';
  const disablePrevention = usePreventRemove(busy);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save() {
    const entry = await useAppStore.getState().saveDiary();
    if (entry && mounted.current) {
      disablePrevention();
      router.replace({
        pathname: '/record/generation',
        params: { id: entry.id },
      });
    }
  }
  return (
    <Screen
      title="오늘의 기록"
      back
      onBack={() => {
        if (!busy) router.back();
      }}
      footer={
        <Button
          label={
            busy
              ? '저장하고 있어요'
              : status === 'error'
                ? '다시 저장하기'
                : '기록 저장하기'
          }
          loading={busy}
          disabled={!draft.emotion}
          onPress={() => void save()}
        />
      }
    >
      <View
        style={{ gap: 28, opacity: busy ? 0.6 : 1 }}
        pointerEvents={busy ? 'none' : 'auto'}
      >
        <Heading
          eyebrow="2 / 2"
          title="오늘 무엇을 했나요?"
          description="여러 개 골라도 돼요."
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {activities.map(activity => (
            <ActivityChip
              key={activity}
              label={activity}
              selected={draft.activities.includes(activity)}
              disabled={busy}
              onPress={() => useAppStore.getState().toggleActivity(activity)}
            />
          ))}
        </View>
        <MemoInput
          value={draft.memo}
          editable={!busy}
          onChangeText={useAppStore.getState().setMemo}
        />
      </View>
      {!draft.emotion && (
        <StatePanel
          compact
          title="기분을 먼저 골라 주세요"
          description="이전 화면에서 오늘의 모찌를 골라 주세요."
        />
      )}
      {status === 'error' && <ErrorBanner message={error} />}
    </Screen>
  );
}
export function GenerationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useAppStore(state =>
    state.entries.find(item => item.id === id),
  );
  if (!entry)
    return (
      <Screen back title="오늘의 기록">
        <StatePanel
          title="기록을 찾지 못했어요"
          description="홈에서 기록을 다시 확인해 주세요."
        />
      </Screen>
    );
  const status = entry.generation;
  const home = () => router.dismissTo('/home');
  const detail = () =>
    router.replace({ pathname: '/diary/[id]', params: { id: entry.id } });
  return (
    <Screen
      action={{ icon: 'close', label: '홈으로', onPress: home }}
      footer={
        status === 'generating' ? (
          <Button label="홈에서 기다리기" variant="secondary" onPress={home} />
        ) : (
          <>
            <Button
              label={status === 'failed' ? '다시 그리기' : '기록 자세히 보기'}
              onPress={
                status === 'failed'
                  ? () => {
                      void useAppStore.getState().generateImage(entry.id);
                    }
                  : detail
              }
            />
            <TextButton label="홈으로" onPress={home} />
          </>
        )
      }
    >
      <Heading
        title={
          status === 'generating'
            ? '오늘의 모찌를\n그리고 있어요'
            : status === 'failed'
              ? '그림을 완성하지\n못했어요'
              : '오늘도 한 장 남겼어요'
        }
        description={
          status === 'generating'
            ? '기록은 저장됐어요.\n화면을 나가도 계속 그려요.'
            : status === 'failed'
              ? '기록은 저장돼 있어요.\n그림만 한 번 더 그려 볼게요.'
              : '모찌가 오늘의 장면을 완성했어요.'
        }
      />
      {status === 'ready' ? (
        <DiaryCard entry={entry} />
      ) : (
        <PictureState
          emotion={entry.emotion}
          generating={status === 'generating'}
          tone="sage"
        />
      )}
      {status === 'generating' && <GenerationProgress />}
    </Screen>
  );
}
