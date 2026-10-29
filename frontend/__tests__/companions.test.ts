import { companions, companionEmotionSource } from '@/constants/companions';
import { presetTag } from '@/constants/tags';
import {
  filterOwnedCompanions,
  ownedCompanionIds,
} from '@/features/mypage/ownedCompanions';
import { useMockControls } from '@/mocks/controls';
import {
  mockDiaryService,
  mockEquipmentService,
  mockGachaService,
} from '@/mocks/services';
import { initialGachaState, useGachaStore } from '@/stores/useGachaStore';
import { emptyDraft, useAppStore } from '@/stores/useAppStore';
import { setAuthPreview } from '@/mocks/authPreview';
import { useAuthStore } from '@/stores/useAuthStore';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T03:00:00Z'));
  useMockControls.getState().reset();
  useGachaStore.setState(initialGachaState());
  setAuthPreview();
  useAppStore.getState().resetSession();
  useAppStore.setState({
    draft: emptyDraft(),
    saveStatus: 'idle',
    saveError: '',
  });
});
afterEach(async () => {
  await jest.runOnlyPendingTimersAsync();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('default is always owned, unowned characters cannot be equipped, and re-equipping sends no request', async () => {
  expect(ownedCompanionIds([])).toEqual(['default']);
  const request = jest.spyOn(mockEquipmentService, 'equip');
  expect(await useGachaStore.getState().equip('happy', 'default')).toBe(false);
  expect(
    await useGachaStore.getState().equip('happy', 'strawberry-crown'),
  ).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
});

test('equip failure keeps the existing character, supports retry, and rejects concurrent requests', async () => {
  const request = jest.spyOn(mockEquipmentService, 'equip');
  useMockControls.getState().failNext('equip');
  const failure = useGachaStore.getState().equip('happy', 'grape');
  await jest.advanceTimersByTimeAsync(450);
  expect(await failure).toBe(false);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
  expect(useGachaStore.getState().equipmentError).toContain('다시 시도');
  const retry = useGachaStore.getState().equip('happy', 'grape');
  expect(await useGachaStore.getState().equip('happy', 'cherry')).toBe(false);
  await jest.advanceTimersByTimeAsync(450);
  expect(await retry).toBe(true);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('grape');
  expect(request).toHaveBeenCalledTimes(2);
  expect(useGachaStore.getState().owned).toContain('grape');
  const reset = useGachaStore.getState().equip('happy', 'default');
  await jest.advanceTimersByTimeAsync(450);
  expect(await reset).toBe(true);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
});

test('new draws and exchanges record real acquisition times without automatically equipping', async () => {
  jest
    .spyOn(mockGachaService, 'pull')
    .mockResolvedValue([{ id: 'strawberry-crown', isNew: true, shards: 0 }]);
  await useGachaStore.getState().pull(1);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
  expect(useGachaStore.getState().acquiredAt['strawberry-crown']).toBe(
    new Date().toISOString(),
  );
  const acquired = useGachaStore.getState().acquiredAt['strawberry-crown'];
  jest
    .spyOn(mockGachaService, 'pull')
    .mockResolvedValue([{ id: 'strawberry-crown', isNew: false, shards: 40 }]);
  await useGachaStore.getState().pull(1);
  expect(useGachaStore.getState().acquiredAt['strawberry-crown']).toBe(
    acquired,
  );
  const exchange = useGachaStore.getState().exchange('watermelon');
  await jest.advanceTimersByTimeAsync(500);
  await exchange;
  expect(useGachaStore.getState().acquiredAt.watermelon).toBe(
    new Date().toISOString(),
  );
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
});

test('generation snapshots the emotion companion before the request; retries preserve it and legacy records', async () => {
  const oldRecords = useAppStore.getState().entries;
  const oldRecord = oldRecords.find(item => item.date !== '2026-10-28')!;
  const original = { ...oldRecord };
  const generate = jest.spyOn(mockDiaryService, 'generate');
  useGachaStore.setState({
    equippedByEmotion: {
      ...initialGachaState().equippedByEmotion,
      happy: 'grape',
    },
  });
  useAppStore.getState().selectEmotion('happy');
  useAppStore.getState().toggleTag(presetTag('activity.walk')!);
  useAppStore
    .getState()
    .selectMainActivity(useAppStore.getState().draft.tags.activities[0]);
  useMockControls.getState().failNext('generation');
  const save = useAppStore.getState().startGeneration();
  useGachaStore.setState({
    equippedByEmotion: {
      ...initialGachaState().equippedByEmotion,
      happy: 'cherry',
    },
  });
  await jest.advanceTimersByTimeAsync(1000);
  const saved = (await save)!;
  expect(saved.companionId).toBe('grape');
  expect(generate).toHaveBeenCalledWith({
    diaryId: saved.id,
    companionId: 'grape',
  });
  expect(
    useAppStore.getState().entries.find(item => item.id === oldRecord.id),
  ).toEqual(original);
  await jest.advanceTimersByTimeAsync(6000);
  expect(
    useAppStore.getState().entries.find(entry => entry.id === saved.id)
      ?.generation,
  ).toBe('failed');
  const retry = useAppStore.getState().generateImage(saved.id);
  await jest.advanceTimersByTimeAsync(6000);
  await retry;
  expect(generate).toHaveBeenLastCalledWith({
    diaryId: saved.id,
    companionId: 'grape',
  });
  expect(generate).toHaveBeenCalledTimes(2);
});

test('equipping alone never starts image generation and logout ignores pending equip responses', async () => {
  const generate = jest.spyOn(mockDiaryService, 'generate');
  const equip = useGachaStore.getState().equip('happy', 'grape');
  await useAuthStore.getState().signOut();
  await jest.advanceTimersByTimeAsync(450);
  expect(await equip).toBe(false);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('default');
  expect(generate).not.toHaveBeenCalled();
});

test('search, category, tier and sort compose using only owned characters and known dates', () => {
  const state = useGachaStore.getState();
  const acquiredAt = {
    grape: '2026-10-26T00:00:00Z',
    apple: '2026-10-28T00:00:00Z',
  };
  expect(
    filterOwnedCompanions({
      ...state,
      acquiredAt,
      category: 'fruit',
      tier: 'epic',
      query: '포도',
    }),
  ).toEqual(['grape']);
  expect(
    filterOwnedCompanions({
      ...state,
      acquiredAt,
      category: 'halloween',
      tier: 'legend',
    }),
  ).toEqual([]);
  expect(filterOwnedCompanions({ ...state, acquiredAt }).slice(0, 2)).toEqual([
    'apple',
    'grape',
  ]);
  expect(
    filterOwnedCompanions({ ...state, acquiredAt, sort: 'oldest' }).slice(0, 2),
  ).toEqual(['grape', 'apple']);
  expect(filterOwnedCompanions({ ...state, query: '딸기' })).toEqual([]);
  expect(state.acquiredAt).toEqual({});
  expect(companions.default.category).toBeNull();
});

test('a session reset invalidates the old equip without cancelling a new session equip', async () => {
  const oldRequest = useGachaStore.getState().equip('happy', 'grape');
  const version = useGachaStore.getState().equipmentVersion;
  useGachaStore.getState().resetSession();
  expect(useGachaStore.getState().equipmentVersion).toBeGreaterThan(version);
  const newRequest = useGachaStore.getState().equip('happy', 'cherry');
  await jest.advanceTimersByTimeAsync(450);
  expect(await oldRequest).toBe(false);
  expect(await newRequest).toBe(true);
  expect(useGachaStore.getState().equippedByEmotion.happy).toBe('cherry');
  expect(useGachaStore.getState().equipping).toBe(false);
});

test('each emotion has an independent slot and the same companion can fill multiple slots', async () => {
  const request = jest.spyOn(mockEquipmentService, 'equip');
  const happy = useGachaStore.getState().equip('happy', 'grape');
  await jest.advanceTimersByTimeAsync(450);
  expect(await happy).toBe(true);
  const sad = useGachaStore.getState().equip('sad', 'cherry');
  await jest.advanceTimersByTimeAsync(450);
  expect(await sad).toBe(true);
  const calm = useGachaStore.getState().equip('calm', 'grape');
  await jest.advanceTimersByTimeAsync(450);
  expect(await calm).toBe(true);
  expect(useGachaStore.getState().equippedByEmotion).toEqual({
    happy: 'grape',
    calm: 'grape',
    neutral: 'default',
    sad: 'cherry',
    angry: 'default',
  });
  expect(request).toHaveBeenLastCalledWith('calm', 'grape');
  useAppStore.getState().selectEmotion('sad');
  useAppStore.getState().toggleTag(presetTag('activity.walk')!);
  useAppStore
    .getState()
    .selectMainActivity(useAppStore.getState().draft.tags.activities[0]);
  const save = useAppStore.getState().startGeneration();
  await jest.advanceTimersByTimeAsync(1000);
  expect((await save)?.companionId).toBe('cherry');
  useGachaStore.getState().resetEquipment();
  expect(Object.values(useGachaStore.getState().equippedByEmotion)).toEqual(
    Array(5).fill('default'),
  );
});

test('emotion artwork uses a supplied remote image and falls back only for missing emotions', () => {
  const image = { uri: 'https://example.com/grape-sad.png' };
  const previous = companions.grape.emotionSources;
  try {
    companions.grape.emotionSources = { sad: image };
    expect(companionEmotionSource('grape', 'sad')).toBe(image);
    expect(companionEmotionSource('grape', 'happy')).toBe(
      companions.grape.source,
    );
  } finally {
    companions.grape.emotionSources = previous;
  }
});
