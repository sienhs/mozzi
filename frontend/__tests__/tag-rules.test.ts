import { presetTag, presetTagsOf } from '@/constants/tags';
import {
  activityChoices,
  canSelectTag,
  checkCustomTag,
  emptySelection,
  removeSelectedTag,
  selectionFromTags,
  toDiaryTags,
  toGenerationRequest,
  toImageTags,
  toggleTag,
} from '@/features/diary/tagRules';
import { emptyDraft } from '@/stores/useAppStore';
import type { CustomTag, CustomTagCategory, TagSelection } from '@/types/diary';
const tag = (id: string) => presetTag(id)!;
const pick = (...ids: string[]) =>
  ids.reduce(
    (selection, id) => toggleTag(selection, tag(id)),
    emptySelection(),
  );
const custom = (
  id: string,
  label: string,
  category: CustomTagCategory = 'activity',
): CustomTag => ({
  id,
  label,
  category,
  key: label.toLowerCase(),
  createdAt: '2026-10-28T00:00:00Z',
});

test('preset and custom activities share the three-choice limit; selected tags remain removable', () => {
  const a = custom('a', '악기 연습');
  const selection = toggleTag(pick('activity.cooking', 'activity.walk'), a);
  expect(canSelectTag(selection, tag('activity.music'))).toBe(false);
  expect(canSelectTag(selection, custom('b', '수영'))).toBe(false);
  expect(toggleTag(selection, custom('b', '수영'))).toBe(selection);
  expect(toggleTag(selection, a).activities).toEqual([
    'activity.cooking',
    'activity.walk',
  ]);
});
test('custom places replace preset places and share the single-choice limit', () => {
  const place = custom('place-1', '연습실', 'place');
  const selected = toggleTag(pick('place.home'), place);
  expect(selected.place).toBe(place.id);
  expect(toggleTag(selected, place).place).toBeNull();
  expect(toggleTag(selected, tag('place.cafe')).place).toBe('place.cafe');
});
test('preset and custom companions share two choices; weather remains optional and single choice', () => {
  const companion = custom('who', '동아리 친구', 'companion');
  const selection = toggleTag(pick('companion.friend'), companion);
  expect(canSelectTag(selection, tag('companion.family'))).toBe(false);
  expect(toggleTag(selection, companion).companions).toEqual([
    'companion.friend',
  ]);
  expect(pick('weather.rainy', 'weather.snowy').weather).toBe('weather.snowy');
  expect(emptySelection().weather).toBeNull();
});
test('all activities and companions allow all places without clearing another category', () => {
  for (const activity of presetTagsOf('activity'))
    for (const companion of presetTagsOf('companion')) {
      const selected = pick(activity.id, companion.id, 'place.home');
      for (const place of presetTagsOf('place'))
        expect(canSelectTag(selected, place)).toBe(true);
      expect(toggleTag(selected, tag('weather.rainy')).place).toBe(
        'place.home',
      );
    }
});
test('normalization and duplicate matching operate within the selected category', () => {
  const library = [custom('a', 'Cake'), custom('b', 'Cake', 'place')];
  expect(checkCustomTag('  생일\n 케이크 ', library)).toEqual({
    kind: 'create',
    label: '생일 케이크',
    key: '생일 케이크',
  });
  expect(checkCustomTag(' cake ', library)).toEqual({ kind: 'reuse', id: 'a' });
  expect(checkCustomTag(' cake ', library, 'place')).toEqual({
    kind: 'reuse',
    id: 'b',
  });
  expect(checkCustomTag(' cake ', library, 'companion').kind).toBe('create');
  expect(checkCustomTag('요리', library)).toEqual({
    kind: 'preset',
    tag: tag('activity.cooking'),
  });
  expect(checkCustomTag('요리', library, 'place').kind).toBe('create');
  expect(checkCustomTag(' ', library).kind).toBe('error');
  expect(checkCustomTag('열한글자가넘는긴태그예요', library).kind).toBe(
    'error',
  );
  const full = Array.from({ length: 20 }, (_, i) =>
    custom('c' + i, '태그' + i),
  );
  expect(checkCustomTag('새 태그', full).kind).toBe('error');
});
test('generation requires an explicit activity from the selected list even if only one was picked', () => {
  const draft = {
    ...emptyDraft(),
    emotion: 'calm' as const,
    tags: pick('activity.walk'),
  };
  expect(toGenerationRequest(draft, [], '2026-10-28')).toBeNull();
  expect(
    toGenerationRequest(
      { ...draft, mainActivityId: 'activity.work' },
      [],
      '2026-10-28',
    ),
  ).toBeNull();
  expect(
    toGenerationRequest(
      { ...draft, mainActivityId: 'activity.walk' },
      [],
      '2026-10-28',
    ),
  ).toMatchObject({ activities: ['WALK'], weather: null });
});
test('only one chosen activity is sent; all record tags and the fixed place and companions remain separate', () => {
  const tags = pick(
    'activity.studying',
    'activity.walk',
    'activity.eating',
    'place.park',
    'companion.friend',
  );
  const draft = {
    ...emptyDraft(),
    emotion: 'calm' as const,
    tags,
    mainActivityId: 'activity.walk',
    memo: '보내지 않는 한 줄',
  };
  expect(toGenerationRequest(draft, [], '2026-10-28')).toEqual({
    recordDate: '2026-10-28',
    emotion: 'calm',
    activities: ['WALK'],
    place: 'PARK',
    companions: ['FRIEND'],
    weather: null,
    customTagIds: [],
  });
  expect(toImageTags(draft, []).map(tag => tag.label)).toEqual([
    '산책',
    '공원',
    '친구',
  ]);
  expect(toDiaryTags(tags, []).map(tag => tag.label)).toEqual([
    '공부',
    '산책',
    '식사',
    '공원',
    '친구',
  ]);
});
test('a chosen custom activity is the sole image activity; other custom activities are excluded from the request', () => {
  const a = custom('a', '악기 연습'),
    b = custom('b', '독서 모임');
  const p = custom('p', '연습실', 'place'),
    c = custom('c', '동아리 친구', 'companion');
  const library = [a, b, p, c];
  const tags = library.reduce<TagSelection>(
    (selection, value) => toggleTag(selection, value),
    pick('activity.walk', 'companion.friend'),
  );
  const draft = {
    ...emptyDraft(),
    emotion: 'happy' as const,
    tags,
    mainActivityId: a.id,
  };
  expect(activityChoices(tags, library).map(tag => tag.id)).toEqual([
    'activity.walk',
    'a',
    'b',
  ]);
  expect(toGenerationRequest(draft, library, '2026-10-28')).toMatchObject({
    activities: [],
    place: null,
    companions: ['FRIEND'],
    customTagIds: ['a', 'p', 'c'],
  });
  expect(toImageTags(draft, library).map(tag => tag.label)).toEqual([
    '악기 연습',
    '연습실',
    '친구',
    '동아리 친구',
  ]);
  expect(
    toGenerationRequest(
      { ...draft, mainActivityId: 'activity.walk' },
      library,
      '2026-10-28',
    )?.customTagIds,
  ).toEqual(['p', 'c']);
});
test('custom snapshots retain category and identity; deleted tags do not come back when rewriting', () => {
  const library = [
    custom('a', '악기 연습'),
    custom('p', '연습실', 'place'),
    custom('c', '친척', 'companion'),
  ];
  const selected = library.reduce(toggleTag, emptySelection());
  const snapshot = toDiaryTags(selected, library);
  expect(snapshot).toEqual(
    library.map(tag => ({
      category: tag.category,
      code: null,
      label: tag.label,
      customTagId: tag.id,
    })),
  );
  expect(selectionFromTags(snapshot, library)).toEqual(selected);
  expect(selectionFromTags(snapshot, [])).toEqual(emptySelection());
  expect(removeSelectedTag(selected, 'p').place).toBeNull();
});
