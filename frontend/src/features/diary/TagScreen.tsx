import { useEffect, useRef } from 'react';
import { router, usePreventRemove } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorBanner, StatePanel } from '@/components/ui/Feedback';
import { Heading, Screen } from '@/components/ui/Screen';
import { TagChip } from '@/components/ui/Selection';
import {
  presetTagsOf,
  tagCategories,
  tagCategoryOrder,
} from '@/constants/tags';
import type { TagCategory, TagSelection } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import { CustomTagSection } from './CustomTagSection';
import { canSelectTag, isTagSelected } from './tagRules';
import { TagSection } from './TagSection';
import { useRecordGuard } from './useRecordGuard';

function PresetTagSection({
  category,
  selection,
  notice,
}: {
  category: TagCategory;
  selection: TagSelection;
  notice?: string;
}) {
  const rule = tagCategories[category];
  return (
    <TagSection title={rule.title} limit={rule.limit} notice={notice}>
      {presetTagsOf(category).map(tag => (
        <TagChip
          key={tag.id}
          label={tag.label}
          single={rule.single}
          main={category === 'activity' && selection.activities[0] === tag.id}
          selected={isTagSelected(selection, tag)}
          disabled={!canSelectTag(selection, tag)}
          onPress={() => useAppStore.getState().toggleTag(tag)}
        />
      ))}
    </TagSection>
  );
}

// R-02: 태그로 하루를 고른다. 한 줄 일기는 그림을 본 뒤에 쓴다.
export function TagScreen() {
  const locked = useRecordGuard();
  const draft = useAppStore(state => state.draft);
  const requestStatus = useAppStore(state => state.requestStatus);
  const requestError = useAppStore(state => state.requestError);
  const tagNotice = useAppStore(state => state.tagNotice);
  const loadStatus = useTagStore(state => state.loadStatus);
  const busy = requestStatus === 'requesting';
  const disablePrevention = usePreventRemove(busy);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (loadStatus === 'idle') void useTagStore.getState().load();
  }, [loadStatus]);
  if (locked) return null;
  const ready = !!draft.emotion && draft.tags.activities.length > 0;
  async function draw() {
    const entry = await useAppStore.getState().startGeneration();
    if (entry && mounted.current) {
      disablePrevention();
      // 기분·태그 화면을 스택에서 걷어 낸다. 생성 화면에서 뒤로 가면 홈이다.
      router.dismissTo('/home');
      router.push({ pathname: '/record/generation', params: { id: entry.id } });
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
          label={busy ? '그림을 부탁하고 있어요' : '그림 그리기'}
          loading={busy}
          disabled={!ready}
          onPress={() => void draw()}
        />
      }
    >
      <View
        style={{ gap: 28, opacity: busy ? 0.6 : 1 }}
        pointerEvents={busy ? 'none' : 'auto'}
      >
        <Heading
          eyebrow="2 / 3"
          title="오늘은 어떤 하루였나요?"
          description="고른 태그로 모찌가 그림을 그려요."
        />
        {tagCategoryOrder.map(category => (
          <PresetTagSection
            key={category}
            category={category}
            selection={draft.tags}
            notice={category === 'place' ? tagNotice : undefined}
          />
        ))}
        <CustomTagSection selection={draft.tags} disabled={busy} />
      </View>
      {!draft.emotion && (
        <StatePanel
          compact
          title="기분을 먼저 골라 주세요"
          description="이전 화면에서 오늘의 모찌를 골라 주세요."
        />
      )}
      {requestStatus === 'error' && <ErrorBanner message={requestError} />}
    </Screen>
  );
}
