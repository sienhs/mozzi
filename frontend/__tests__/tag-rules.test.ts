import { presetTag, presetTags, presetTagsOf } from '@/constants/tags';
import {
  activityChoices,
  canSelectTag,
  checkCustomTag,
  chosenActivity,
  emptySelection,
  removeSelectedTag,
  toDiaryTags,
  toImageTags,
  toggleTag,
} from '@/features/diary/tagRules';
import { emptyDraft } from '@/stores/useAppStore';
import type {
  CustomTag,
  CustomTagCategory,
  SelectableTag,
  TagSelection,
} from '@/types/diary';
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
// 가입 때 서버가 만들어 둔 기본 태그 (내 아이콘).
const library: CustomTag[] = [
  custom('studying', '공부'),
  custom('walk', '산책'),
  custom('eating', '식사'),
  custom('cooking', '요리'),
  custom('reading', '독서'),
  custom('home', '집', 'place'),
  custom('cafe', '카페', 'place'),
  custom('park', '공원', 'place'),
  custom('family', '가족', 'companion'),
  custom('friend', '친구', 'companion'),
];
const tag = (id: string): SelectableTag =>
  presetTag(id) ?? library.find(item => item.id === id)!;
const pick = (...ids: string[]) =>
  ids.reduce(
    (selection, id) => toggleTag(selection, tag(id)),
    emptySelection(),
  );

test('activities share the three-choice limit; selected tags remain removable', () => {
  const selection = pick('cooking', 'walk', 'studying');
  expect(canSelectTag(selection, tag('reading'))).toBe(false);
  expect(toggleTag(selection, tag('reading'))).toBe(selection);
  expect(toggleTag(selection, tag('studying')).activities).toEqual([
    'cooking',
    'walk',
  ]);
});
test('only weather is fixed in the app and matches the server weather values', () => {
  expect(presetTags.every(item => item.category === 'weather')).toBe(true);
  expect(presetTagsOf('activity')).toEqual([]);
  expect(presetTagsOf('weather').map(item => item.code)).toEqual([
    'SUNNY',
    'CLOUDY',
    'RAINY',
    'SNOWY',
  ]);
});
test('places share the single-choice limit', () => {
  const selected = pick('home');
  expect(toggleTag(selected, tag('cafe')).place).toBe('cafe');
  expect(toggleTag(selected, tag('home')).place).toBeNull();
});
test('companions share two choices; weather remains optional and single choice', () => {
  const extra = custom('club', '동아리 친구', 'companion');
  const selection = pick('friend', 'family');
  expect(canSelectTag(selection, extra)).toBe(false);
  expect(toggleTag(selection, tag('family')).companions).toEqual(['friend']);
  expect(pick('weather.rainy', 'weather.snowy').weather).toBe('weather.snowy');
  expect(emptySelection().weather).toBeNull();
});
test('choosing weather does not clear another category', () => {
  const selected = pick('cooking', 'family', 'home');
  expect(toggleTag(selected, tag('weather.rainy')).place).toBe('home');
});
test('normalization and duplicate matching operate within the selected category', () => {
  const tags = [custom('a', 'Cake'), custom('b', 'Cake', 'place')];
  expect(checkCustomTag('  생일\n 케이크 ', tags)).toEqual({
    kind: 'create',
    label: '생일 케이크',
    key: '생일 케이크',
  });
  expect(checkCustomTag(' cake ', tags)).toEqual({ kind: 'reuse', id: 'a' });
  expect(checkCustomTag(' cake ', tags, 'place')).toEqual({
    kind: 'reuse',
    id: 'b',
  });
  expect(checkCustomTag(' cake ', tags, 'companion').kind).toBe('create');
  // 기본 태그도 내 태그라 같은 이름은 그 태그를 다시 고른다.
  expect(checkCustomTag('요리', library)).toEqual({
    kind: 'reuse',
    id: 'cooking',
  });
  // 기본 태그를 지웠으면 같은 이름으로 다시 만들 수 있다.
  expect(checkCustomTag('요리', []).kind).toBe('create');
  expect(checkCustomTag(' ', tags).kind).toBe('error');
  expect(checkCustomTag('열한글자가넘는긴태그예요', tags).kind).toBe('error');
  // 서버 한도: 카테고리마다 30개. 기본 태그도 센다.
  const full = Array.from({ length: 30 }, (_, i) =>
    custom('c' + i, '태그' + i),
  );
  expect(checkCustomTag('새 태그', full).kind).toBe('error');
  expect(checkCustomTag('새 태그', full, 'place').kind).toBe('create');
  expect(checkCustomTag('새 태그', [], 'activity', 30).kind).toBe('error');
});
test('generation requires an explicit activity from the selected list even if only one was picked', () => {
  const draft = {
    ...emptyDraft(),
    emotion: 'calm' as const,
    tags: pick('walk'),
  };
  expect(chosenActivity(draft, library)).toBeUndefined();
  expect(toImageTags(draft, library)).toEqual([]);
  expect(
    chosenActivity({ ...draft, mainActivityId: 'studying' }, library),
  ).toBeUndefined();
  expect(toImageTags({ ...draft, mainActivityId: 'walk' }, library)).toEqual([
    { category: 'activity', code: null, label: '산책', customTagId: 'walk' },
  ]);
});
test('only one chosen activity and the first companion form the picture; all record tags remain separate', () => {
  const tags = pick(
    'studying',
    'walk',
    'eating',
    'park',
    'friend',
    'family',
    'weather.rainy',
  );
  const draft = {
    ...emptyDraft(),
    emotion: 'calm' as const,
    tags,
    mainActivityId: 'walk',
    memo: '보내지 않는 한 줄',
  };
  // 서버 그림 요청은 동행을 하나만 받는다.
  expect(toImageTags(draft, library).map(item => item.label)).toEqual([
    '산책',
    '공원',
    '친구',
    '비',
  ]);
  expect(toDiaryTags(tags, library).map(item => item.label)).toEqual([
    '공부',
    '산책',
    '식사',
    '공원',
    '친구',
    '가족',
    '비',
  ]);
});
test('a chosen activity is the sole image activity; other activities stay out of the picture', () => {
  const a = custom('a', '악기 연습'),
    b = custom('b', '독서 모임');
  const p = custom('p', '연습실', 'place'),
    c = custom('c', '동아리 친구', 'companion');
  const all = [...library, a, b, p, c];
  const tags = [a, b, p, c].reduce<TagSelection>(
    (selection, value) => toggleTag(selection, value),
    pick('walk', 'friend'),
  );
  const draft = {
    ...emptyDraft(),
    emotion: 'happy' as const,
    tags,
    mainActivityId: a.id,
  };
  expect(activityChoices(tags, all).map(item => item.id)).toEqual([
    'walk',
    'a',
    'b',
  ]);
  expect(toImageTags(draft, all)).toEqual([
    { category: 'activity', code: null, label: '악기 연습', customTagId: 'a' },
    { category: 'place', code: null, label: '연습실', customTagId: 'p' },
    {
      category: 'companion',
      code: null,
      label: '친구',
      customTagId: 'friend',
    },
  ]);
  expect(
    toImageTags({ ...draft, mainActivityId: 'walk' }, all).map(
      item => item.label,
    ),
  ).toEqual(['산책', '연습실', '친구']);
});
test('snapshots retain category and identity; removing a tag clears its selection', () => {
  const tags = [
    custom('a', '악기 연습'),
    custom('p', '연습실', 'place'),
    custom('c', '친척', 'companion'),
  ];
  const selected = tags.reduce(toggleTag, emptySelection());
  const snapshot = toDiaryTags(selected, tags);
  expect(snapshot).toEqual(
    tags.map(item => ({
      category: item.category,
      code: null,
      label: item.label,
      customTagId: item.id,
    })),
  );
  expect(removeSelectedTag(selected, 'p').place).toBeNull();
});
