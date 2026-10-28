import { presetTag, presetTagsOf } from '@/constants/tags';
import {
  canSelectTag,
  checkCustomTag,
  clearBlockedPlace,
  emptySelection,
  selectionFromTags,
  toDiaryTags,
  toGenerationRequest,
  toggleCustomTag,
  toggleTag,
} from '@/features/diary/tagRules';
import type { CustomTag, TagSelection } from '@/types/diary';

const tag = (id: string) => {
  const found = presetTag(id);
  if (!found) throw new Error(`unknown tag ${id}`);
  return found;
};
const pick = (...ids: string[]) =>
  ids.reduce<TagSelection>(
    (selection, id) => toggleTag(selection, tag(id)),
    emptySelection(),
  );
const custom = (id: string, label: string): CustomTag => ({
  id,
  label,
  key: label.toLowerCase(),
  createdAt: '2026-10-26T00:00:00Z',
});

test('activities stop at three, and dropping the first one promotes the next to main', () => {
  const three = pick('activity.cooking', 'activity.eating', 'activity.music');
  expect(canSelectTag(three, tag('activity.reading'))).toBe(false);
  expect(toggleTag(three, tag('activity.reading'))).toBe(three);
  const dropped = toggleTag(three, tag('activity.cooking'));
  expect(dropped.activities).toEqual(['activity.eating', 'activity.music']);
  expect(canSelectTag(dropped, tag('activity.reading'))).toBe(true);
});

test('place and weather hold one choice: another replaces it, the same one clears it', () => {
  const home = pick('place.home');
  expect(toggleTag(home, tag('place.cafe')).place).toBe('place.cafe');
  expect(toggleTag(home, tag('place.home')).place).toBeNull();
  expect(pick('weather.rainy', 'weather.snowy').weather).toBe('weather.snowy');
});

test('at most two companions can come along', () => {
  const two = pick('companion.friend', 'companion.puppy');
  expect(canSelectTag(two, tag('companion.family'))).toBe(false);
  expect(canSelectTag(two, tag('companion.friend'))).toBe(true);
});

test('every activity and companion permits every place, and changing them keeps the chosen place', () => {
  for (const activity of presetTagsOf('activity')) {
    for (const companion of presetTagsOf('companion')) {
      const selection = pick(activity.id, companion.id, 'place.home');
      for (const place of presetTagsOf('place')) {
        expect(canSelectTag(selection, place)).toBe(true);
      }
      expect(clearBlockedPlace(selection)).toEqual({
        selection,
        cleared: false,
      });
    }
  }
  expect(toggleTag(pick('place.home'), tag('activity.walk')).place).toBe(
    'place.home',
  );
});

test('custom tag input is normalised, duplicates reuse the saved tag, and preset names pick the preset', () => {
  const library = [
    custom('custom-1', '오므라이스'),
    custom('custom-2', 'Cake'),
  ];
  expect(checkCustomTag('  생일\n  케이크 ', library)).toEqual({
    kind: 'create',
    label: '생일 케이크',
    key: '생일 케이크',
  });
  expect(checkCustomTag('   ', library)).toMatchObject({ kind: 'error' });
  expect(checkCustomTag('열한글자가넘는긴태그예요', library)).toMatchObject({
    kind: 'error',
  });
  expect(checkCustomTag(' cake ', library)).toEqual({
    kind: 'reuse',
    id: 'custom-2',
  });
  expect(checkCustomTag('요리', library)).toEqual({
    kind: 'preset',
    tag: tag('activity.cooking'),
  });
  const full = Array.from({ length: 20 }, (_, i) =>
    custom(`custom-${i}`, `태그${i}`),
  );
  expect(checkCustomTag('새 태그', full)).toMatchObject({ kind: 'error' });
});

test('no more than three custom tags go into one record', () => {
  const selection = ['a', 'b', 'c', 'd'].reduce(
    (current, id) => toggleCustomTag(current, id),
    emptySelection(),
  );
  expect(selection.custom).toEqual(['a', 'b', 'c']);
});

test('the picture request carries codes only — main activity first, unpicked place and weather as null, custom tag ids, no one-line diary', () => {
  const library = [custom('custom-1', '오므라이스')];
  const tags = toggleCustomTag(
    pick('activity.music', 'activity.cooking', 'companion.family'),
    'custom-1',
  );
  const request = toGenerationRequest(
    {
      recordDate: '2026-10-26',
      emotion: 'calm',
      tags,
      memo: '그림 뒤에 쓰는 한 줄',
    },
    library,
    '2026-10-26',
  );
  expect(request).toEqual({
    recordDate: '2026-10-26',
    emotion: 'calm',
    activities: ['MUSIC', 'COOKING'],
    place: null,
    companions: ['FAMILY'],
    weather: null,
    customTagIds: ['custom-1'],
  });
  // 활동이 없으면 그림을 요청하지 않는다.
  expect(
    toGenerationRequest(
      { recordDate: null, emotion: 'calm', tags: emptySelection(), memo: '' },
      library,
      '2026-10-26',
    ),
  ).toBeNull();
});

test('a record keeps a label snapshot that restores the same choices, minus custom tags deleted since', () => {
  const library = [custom('custom-1', '오므라이스')];
  const selection = toggleCustomTag(
    pick('activity.cooking', 'place.home', 'weather.rainy'),
    'custom-1',
  );
  const snapshot = toDiaryTags(selection, library);
  expect(snapshot.map(item => item.label)).toEqual([
    '요리',
    '집',
    '비',
    '오므라이스',
  ]);
  expect(selectionFromTags(snapshot, library)).toEqual(selection);
  expect(selectionFromTags(snapshot, []).custom).toEqual([]);
});
