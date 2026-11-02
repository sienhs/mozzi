import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  CozyButton as Button,
  CozyScreen as Screen,
} from '@/components/ui/CozyUI';
import { StatePanel } from '@/components/ui/Feedback';
import { Heading } from '@/components/ui/Screen';
import { TagChip } from '@/components/ui/Selection';
import {
  presetTagsOf,
  tagCategories,
  tagCategoryOrder,
} from '@/constants/tags';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import { CustomTagSection } from './CustomTagSection';
import { activityChoices, canSelectTag, isTagSelected } from './tagRules';
import { TagSection } from './TagSection';
import { useRecordGuard } from './useRecordGuard';

export function TagScreen() {
  const locked = useRecordGuard();
  const draft = useAppStore(state => state.draft);
  const tags = useTagStore(state => state.tags);
  const loadStatus = useTagStore(state => state.loadStatus);
  useEffect(() => {
    if (loadStatus === 'idle') void useTagStore.getState().load();
  }, [loadStatus]);
  if (locked) return null;
  const ready = !!draft.emotion && activityChoices(draft.tags, tags).length > 0;
  return (
    <Screen
      title="오늘의 기록"
      back
      footer={
        <Button
          label="다음"
          disabled={!ready}
          onPress={() => router.push('/record/activity')}
        />
      }
    >
      <Heading eyebrow="2 / 4" title="오늘은 어떤 하루였나요?" />
      <View style={{ gap: 28 }}>
        {tagCategoryOrder.map(category => {
          const rule = tagCategories[category];
          return (
            <TagSection key={category} title={rule.title} limit={rule.limit}>
              {/* 날씨만 앱의 고정 목록이다. 나머지는 서버의 내 태그(기본 태그 포함)를 보여 준다. */}
              {presetTagsOf(category).map(tag => (
                <TagChip
                  key={tag.id}
                  label={tag.label}
                  single={rule.single}
                  selected={isTagSelected(draft.tags, tag)}
                  disabled={!canSelectTag(draft.tags, tag)}
                  onPress={() => useAppStore.getState().toggleTag(tag)}
                />
              ))}
              {category !== 'weather' && (
                <CustomTagSection category={category} selection={draft.tags} />
              )}
            </TagSection>
          );
        })}
      </View>
      {!draft.emotion && (
        <StatePanel
          compact
          title="기분을 먼저 골라 주세요"
          description="이전 화면에서 오늘의 모찌를 골라 주세요."
        />
      )}
    </Screen>
  );
}
