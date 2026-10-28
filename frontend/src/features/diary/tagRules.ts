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
  GenerationRequest,
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
export function checkCustomTag(
  raw: string,
  library: CustomTag[],
  category: CustomTagCategory = 'activity',
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
  if (library.length >= customTagLimits.maxSaved)
    return {
      kind: 'error',
      message: `추가한 태그는 ${customTagLimits.maxSaved}개까지 보관할 수 있어요.`,
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
export function toImageTags(
  draft: DiaryDraft,
  library: CustomTag[],
): DiaryTag[] {
  const activity = chosenActivity(draft, library);
  if (!activity) return [];
  return [
    snapshotTag(activity),
    ...toDiaryTags(draft.tags, library).filter(
      tag => tag.category !== 'activity',
    ),
  ];
}
export function toGenerationRequest(
  draft: DiaryDraft,
  library: CustomTag[],
  fallbackDate: string,
): GenerationRequest | null {
  const activity = chosenActivity(draft, library);
  if (!draft.emotion || !activity) return null;
  const imageTags = toImageTags(draft, library);
  const code = (id: string | null) => {
    const tag = resolveTag(id, library);
    return tag && 'code' in tag ? tag.code : null;
  };
  return {
    recordDate: draft.recordDate ?? fallbackDate,
    emotion: draft.emotion,
    activities: 'code' in activity ? [activity.code] : [],
    place: code(draft.tags.place),
    companions: draft.tags.companions
      .map(code)
      .filter((value): value is string => !!value),
    weather: code(draft.tags.weather),
    customTagIds: imageTags.flatMap(tag =>
      tag.customTagId ? [tag.customTagId] : [],
    ),
  };
}
// 과거의 별도 내 태그 스냅샷은 같은 이름의 현재 카테고리 태그로 복원한다.
export function selectionFromTags(
  tags: DiaryTag[],
  library: CustomTag[],
): TagSelection {
  let selection = emptySelection();
  for (const snapshot of tags) {
    if (snapshot.category === 'legacy') continue;
    const custom =
      snapshot.code === null
        ? library.find(
            tag =>
              (snapshot.category === 'custom' ||
                tag.category === snapshot.category) &&
              (snapshot.customTagId
                ? tag.id === snapshot.customTagId
                : tag.key === tagKey(snapshot.label)),
          )
        : undefined;
    const tag =
      custom ??
      presetTags.find(
        tag => tag.category === snapshot.category && tag.code === snapshot.code,
      );
    if (tag && !isTagSelected(selection, tag))
      selection = toggleTag(selection, tag);
  }
  return selection;
}
export const tagSummary = (tags: DiaryTag[]) =>
  tags.map(tag => tag.label).join(' · ');
