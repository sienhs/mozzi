import {
  customTagLimits,
  presetTag,
  presetTags,
  tagCategories,
  tagCategoryOrder,
} from '@/constants/tags';
import type {
  CustomTag,
  CustomTagCategory,
  DiaryDraft,
  DiaryTag,
  SelectableTag,
  TagCategory,
  TagSelection,
} from '@/types/diary';

export const emptySelection = (): TagSelection => ({
  activities: [],
  place: null,
  companions: [],
  weather: null,
});
export function selectedIds(selection: TagSelection, category: TagCategory) {
  if (category === 'activity') return selection.activities;
  if (category === 'companion') return selection.companions;
  const id = selection[category];
  return id ? [id] : [];
}
export function resolveTag(
  id: string | null,
  library: CustomTag[],
): SelectableTag | undefined {
  return id ? (presetTag(id) ?? library.find(tag => tag.id === id)) : undefined;
}
export const isTagSelected = (selection: TagSelection, tag: SelectableTag) =>
  selectedIds(selection, tag.category).includes(tag.id);
export function canSelectTag(selection: TagSelection, tag: SelectableTag) {
  const rule = tagCategories[tag.category];
  return (
    isTagSelected(selection, tag) ||
    rule.single ||
    selectedIds(selection, tag.category).length < rule.max
  );
}
export function toggleTag(
  selection: TagSelection,
  tag: SelectableTag,
): TagSelection {
  if (!canSelectTag(selection, tag)) return selection;
  if (tag.category === 'place' || tag.category === 'weather')
    return {
      ...selection,
      [tag.category]: selection[tag.category] === tag.id ? null : tag.id,
    };
  const key = tag.category === 'activity' ? 'activities' : 'companions';
  const list = selection[key];
  return {
    ...selection,
    [key]: list.includes(tag.id)
      ? list.filter(id => id !== tag.id)
      : [...list, tag.id],
  };
}
export const selectCustomTag = (selection: TagSelection, tag: CustomTag) =>
  isTagSelected(selection, tag) ? selection : toggleTag(selection, tag);
export function removeSelectedTag(
  selection: TagSelection,
  id: string,
): TagSelection {
  return {
    activities: selection.activities.filter(value => value !== id),
    place: selection.place === id ? null : selection.place,
    companions: selection.companions.filter(value => value !== id),
    weather: selection.weather === id ? null : selection.weather,
  };
}
export function normalizeTagLabel(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export const tagKey = (label: string) => normalizeTagLabel(label).toLowerCase();
export const labelLength = (label: string) => Array.from(label).length;
export type CustomTagCheck =
  | { kind: 'create'; label: string; key: string }
  | { kind: 'reuse'; id: string }
  | { kind: 'preset'; tag: (typeof presetTags)[number] }
  | { kind: 'error'; message: string };
// used: 서버에 이미 있는 그 카테고리의 아이콘 수 (기본 태그용 아이콘 포함).
export function checkCustomTag(
  raw: string,
  library: CustomTag[],
  category: CustomTagCategory = 'activity',
  used = library.filter(tag => tag.category === category).length,
): CustomTagCheck {
  const label = normalizeTagLabel(raw);
  if (!label) return { kind: 'error', message: '태그를 입력해 주세요.' };
  const key = tagKey(label);
  const preset = presetTags.find(
    tag => tag.category === category && tagKey(tag.label) === key,
  );
  if (preset) return { kind: 'preset', tag: preset };
  const existing = library.find(
    tag => tag.category === category && tag.key === key,
  );
  if (existing) return { kind: 'reuse', id: existing.id };
  if (labelLength(label) > customTagLimits.maxLength)
    return {
      kind: 'error',
      message: `${customTagLimits.maxLength}자까지 쓸 수 있어요.`,
    };
  if (used >= customTagLimits.maxPerCategory)
    return {
      kind: 'error',
      message: `태그는 카테고리마다 ${customTagLimits.maxPerCategory}개까지 만들 수 있어요. 자주 고른 기본 태그도 함께 세요.`,
    };
  return { kind: 'create', label, key };
}
export function snapshotTag(tag: SelectableTag): DiaryTag {
  return 'code' in tag
    ? { category: tag.category, code: tag.code, label: tag.label }
    : {
        category: tag.category,
        code: null,
        label: tag.label,
        customTagId: tag.id,
      };
}
export function toDiaryTags(
  selection: TagSelection,
  library: CustomTag[],
): DiaryTag[] {
  return tagCategoryOrder.flatMap(category =>
    selectedIds(selection, category)
      .map(id => resolveTag(id, library))
      .filter((tag): tag is SelectableTag => !!tag && tag.category === category)
      .map(snapshotTag),
  );
}
export function activityChoices(selection: TagSelection, library: CustomTag[]) {
  return selection.activities
    .map(id => resolveTag(id, library))
    .filter(
      (tag): tag is SelectableTag => !!tag && tag.category === 'activity',
    );
}
export function chosenActivity(draft: DiaryDraft, library: CustomTag[]) {
  return activityChoices(draft.tags, library).find(
    tag => tag.id === draft.mainActivityId,
  );
}
// 기록에 남길 태그와 그림의 장면을 분리한다. 활동은 사용자가 명시적으로 고른 하나만 남긴다.
// 서버 그림 요청은 장소·동행을 하나씩만 받으므로 동행은 처음 고른 한 명만 그림에 들어간다.
export function toImageTags(
  draft: DiaryDraft,
  library: CustomTag[],
): DiaryTag[] {
  const activity = chosenActivity(draft, library);
  if (!activity) return [];
  const companion = draft.tags.companions[0] ?? null;
  return [
    snapshotTag(activity),
    ...toDiaryTags(
      { ...draft.tags, companions: companion ? [companion] : [] },
      library,
    ).filter(tag => tag.category !== 'activity'),
  ];
}
export const tagSummary = (tags: DiaryTag[]) =>
  tags.map(tag => tag.label).join(' · ');
