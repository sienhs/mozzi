import {
  customTagLimits,
  presetTag,
  presetTags,
  tagCategories,
  tagCategoryOrder,
} from '@/constants/tags';
import type {
  CustomTag,
  DiaryDraft,
  DiaryTag,
  GenerationRequest,
  PresetTag,
  TagCategory,
  TagSelection,
} from '@/types/diary';

// 태그 선택 규칙. 상태가 없는 함수만 둔다 — 스토어와 화면이 같은 규칙을 쓴다.
export const emptySelection = (): TagSelection => ({
  activities: [],
  place: null,
  companions: [],
  weather: null,
  custom: [],
});

export function selectedIds(selection: TagSelection, category: TagCategory) {
  if (category === 'activity') return selection.activities;
  if (category === 'companion') return selection.companions;
  const id = selection[category];
  return id ? [id] : [];
}
export const isTagSelected = (selection: TagSelection, tag: PresetTag) =>
  selectedIds(selection, tag.category).includes(tag.id);

export const mainActivity = (selection: TagSelection) =>
  selection.activities[0] ? presetTag(selection.activities[0]) : undefined;

const codesOf = (ids: string[]) =>
  ids.map(id => presetTag(id)?.code).filter((code): code is string => !!code);

// 칩을 누를 수 있는지. 이미 고른 칩은 언제든 해제할 수 있다.
export function canSelectTag(selection: TagSelection, tag: PresetTag) {
  if (isTagSelected(selection, tag)) return true;
  const rule = tagCategories[tag.category];
  return rule.single || selectedIds(selection, tag.category).length < rule.max;
}

export function toggleTag(
  selection: TagSelection,
  tag: PresetTag,
): TagSelection {
  if (!canSelectTag(selection, tag)) return selection;
  if (tag.category === 'place' || tag.category === 'weather') {
    const key = tag.category;
    return { ...selection, [key]: selection[key] === tag.id ? null : tag.id };
  }
  const key = tag.category === 'activity' ? 'activities' : 'companions';
  const list = selection[key];
  return {
    ...selection,
    [key]: list.includes(tag.id)
      ? list.filter(id => id !== tag.id)
      : [...list, tag.id],
  };
}

// 활동·동행을 바꿔도 장소 선택은 유지한다. 카테고리 사이 조합 제한은 없다.
export function clearBlockedPlace(selection: TagSelection) {
  return { selection, cleared: false };
}

export function toggleCustomTag(
  selection: TagSelection,
  id: string,
): TagSelection {
  if (selection.custom.includes(id))
    return {
      ...selection,
      custom: selection.custom.filter(item => item !== id),
    };
  if (selection.custom.length >= customTagLimits.maxSelected) return selection;
  return { ...selection, custom: [...selection.custom, id] };
}
export const selectCustomTag = (selection: TagSelection, id: string) =>
  selection.custom.includes(id) ? selection : toggleCustomTag(selection, id);

// 내 태그 입력 정규화: 줄바꿈·제어문자 제거 → 연속 공백 한 칸 → 앞뒤 공백 제거.
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
  | { kind: 'preset'; tag: PresetTag }
  | { kind: 'error'; message: string };
export function checkCustomTag(
  raw: string,
  library: CustomTag[],
): CustomTagCheck {
  const label = normalizeTagLabel(raw);
  if (!label) return { kind: 'error', message: '태그를 입력해 주세요.' };
  const key = tagKey(label);
  const preset = presetTags.find(tag => tagKey(tag.label) === key);
  if (preset) return { kind: 'preset', tag: preset };
  const existing = library.find(tag => tag.key === key);
  if (existing) return { kind: 'reuse', id: existing.id };
  if (labelLength(label) > customTagLimits.maxLength)
    return {
      kind: 'error',
      message: `${customTagLimits.maxLength}자까지 쓸 수 있어요.`,
    };
  if (library.length >= customTagLimits.maxSaved)
    return {
      kind: 'error',
      message: `내 태그는 ${customTagLimits.maxSaved}개까지 만들 수 있어요.`,
    };
  return { kind: 'create', label, key };
}

const customOf = (selection: TagSelection, library: CustomTag[]) =>
  selection.custom
    .map(id => library.find(tag => tag.id === id))
    .filter((tag): tag is CustomTag => !!tag);

// 기록에 남길 태그 스냅샷. 순서: 무엇을(대표 먼저) → 어디서 → 누구와 → 날씨 → 내 태그.
export function toDiaryTags(
  selection: TagSelection,
  library: CustomTag[],
): DiaryTag[] {
  const presets = tagCategoryOrder
    .flatMap(category => selectedIds(selection, category))
    .map(id => presetTag(id))
    .filter((tag): tag is PresetTag => !!tag)
    .map(tag => ({ category: tag.category, code: tag.code, label: tag.label }));
  return [
    ...presets,
    ...customOf(selection, library).map(tag => ({
      category: 'custom' as const,
      code: null,
      label: tag.label,
    })),
  ];
}

// 그림 요청 값. 문장형 프롬프트와 한 줄 일기는 넣지 않는다. 고르지 않은 장소·날씨는 null로 보내고
// 기본값(집·맑음)은 서버가 적용한다 (CONTRACT: B1·B8).
export function toGenerationRequest(
  draft: DiaryDraft,
  library: CustomTag[],
  fallbackDate: string,
): GenerationRequest | null {
  if (!draft.emotion || !draft.tags.activities.length) return null;
  const code = (id: string | null) => (id && presetTag(id)?.code) || null;
  return {
    recordDate: draft.recordDate ?? fallbackDate,
    emotion: draft.emotion,
    activities: codesOf(draft.tags.activities),
    place: code(draft.tags.place),
    companions: codesOf(draft.tags.companions),
    weather: code(draft.tags.weather),
    customTagIds: customOf(draft.tags, library).map(tag => tag.id),
  };
}

// 다시 작성하기(재시도 불가 실패) 때 기록의 태그로 선택을 되살린다. 지워진 내 태그는 빠진다.
export function selectionFromTags(
  tags: DiaryTag[],
  library: CustomTag[],
): TagSelection {
  let selection = emptySelection();
  for (const tag of tags) {
    if (tag.category === 'custom') {
      const found = library.find(item => item.key === tagKey(tag.label));
      if (found) selection = selectCustomTag(selection, found.id);
    } else if (tag.category !== 'legacy') {
      const preset = presetTags.find(
        item => item.category === tag.category && item.code === tag.code,
      );
      if (preset && !isTagSelected(selection, preset))
        selection = toggleTag(selection, preset);
    }
  }
  return selection;
}

export const tagSummary = (tags: DiaryTag[]) =>
  tags.map(tag => tag.label).join(' · ');
