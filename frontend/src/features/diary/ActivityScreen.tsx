import { useEffect, useRef } from 'react';
import { router, usePreventRemove } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorBanner, StatePanel } from '@/components/ui/Feedback';
import { Heading, Screen } from '@/components/ui/Screen';
import { TagChip } from '@/components/ui/Selection';
import { AppText } from '@/components/ui/Text';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { activityChoices, chosenActivity, resolveTag } from './tagRules';
import { useRecordGuard } from './useRecordGuard';

export function ActivityScreen() {
  const locked = useRecordGuard();
  const draft = useAppStore(state => state.draft);
  const status = useAppStore(state => state.requestStatus);
  const error = useAppStore(state => state.requestError);
  const library = useTagStore(state => state.tags);
  const busy = status === 'requesting';
  const allowRemove = usePreventRemove(busy);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (locked) return null;
  const choices = activityChoices(draft.tags, library);
  const selected = chosenActivity(draft, library);
  const place = resolveTag(draft.tags.place, library);
  const companions = draft.tags.companions
    .map(id => resolveTag(id, library)?.label)
    .filter(Boolean);
  const weather = resolveTag(draft.tags.weather, library);
  async function draw() {
    const memberId = useAuthStore.getState().member?.memberId;
    if (memberId === undefined) return;
    const result = await useAppStore.getState().startGeneration(memberId);
    if (result && mounted.current) {
      allowRemove();
      router.dismissTo('/home');
      router.push({
        pathname: '/record/generation',
        params: { id: String(result.diaryId) },
      });
    }
  }
  return (
    <Screen
      title="그림으로 남길 장면"
      back
      onBack={() => {
        if (!busy) router.back();
      }}
      footer={
        <Button
          label={busy ? '그림을 부탁하고 있어요' : '그림 그리기'}
          loading={busy}
          disabled={!draft.emotion || !selected}
          onPress={() => void draw()}
        />
      }
    >
      <Heading
        eyebrow="3 / 4"
        title="어떤 장면을 그릴까요?"
        description="앞에서 고른 활동 중 하나를 골라 주세요. 이 활동 하나를 그림으로 남겨요."
      />
      <View
        pointerEvents={busy ? 'none' : 'auto'}
        style={{ gap: 24, opacity: busy ? 0.6 : 1 }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {choices.map(tag => (
            <TagChip
              key={tag.id}
              label={tag.label}
              single
              selected={selected?.id === tag.id}
              onPress={() => useAppStore.getState().selectMainActivity(tag.id)}
            />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="label">함께 담을 장소와 동행</AppText>
          <AppText variant="small">
            어디서 · {place?.label ?? '선택 안 함'}
          </AppText>
          <AppText variant="small">
            누구와 · {companions[0] ?? '선택 안 함'}
          </AppText>
          {companions.length > 1 && (
            <AppText variant="caption">
              그림에는 처음 고른 동행 한 명이 함께 담겨요. 고른 동행은 모두
              기록에 남아요.
            </AppText>
          )}
          {!!weather && (
            <AppText variant="small">날씨 · {weather.label}</AppText>
          )}
          <AppText variant="caption">
            장소와 동행은 앞에서 고른 내용이에요. 바꾸려면 이전 화면으로 돌아가
            주세요.
          </AppText>
        </View>
        {!selected && choices.length > 0 && (
          <AppText variant="caption">
            활동을 하나 골라야 그림을 그릴 수 있어요.
          </AppText>
        )}
        {choices.length === 0 && (
          <StatePanel
            compact
            title="활동 태그를 먼저 골라 주세요"
            description="이전 화면의 무엇을에서 하나 이상 골라 주세요."
          />
        )}
      </View>
      {!draft.emotion && (
        <StatePanel
          compact
          title="기분을 먼저 골라 주세요"
          description="기분 선택 화면으로 돌아가 주세요."
        />
      )}
      {status === 'error' && <ErrorBanner message={error} />}
    </Screen>
  );
}
