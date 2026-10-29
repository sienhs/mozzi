import { create } from 'zustand';
import type { MochiId, PullItem } from '@/types/gacha';
import { mochiOrder, mochis, tiers } from '@/constants/gacha';
import { mockEquipmentService, mockGachaService } from '@/mocks/services';
import { defaultEmotionEquipment, type CompanionId } from '@/types/companion';
import type { Emotion } from '@/types/diary';

// Figma demo values (P-01: 뽑기권 23 · 별조각 140). The server will own these later.
const initialOwned: MochiId[] = [
  'grape',
  'cherry',
  'blueberry',
  'apple',
  'mango',
];
export const initialGachaState = () => ({
  session: 0,
  tickets: 23,
  shards: 140,
  owned: [...initialOwned],
  unseen: [] as MochiId[],
  lastPull: [] as PullItem[],
  pendingDuplicate: null as PullItem | null,
  pulling: false,
  acquiredAt: {} as Partial<Record<MochiId, string>>,
  equippedByEmotion: defaultEmotionEquipment(),
  equipping: false,
  equipmentError: '',
  equipmentVersion: 0,
});
interface GachaState extends ReturnType<typeof initialGachaState> {
  resetSession: () => void;
  pull: (count: number) => Promise<PullItem[]>;
  applyDuplicate: () => void;
  markSeen: (id: MochiId) => void;
  exchange: (id: MochiId) => Promise<void>;
  equip: (emotion: Emotion, id: CompanionId) => Promise<boolean>;
  resetEquipment: () => void;
}
export const exchangeCost = (id: MochiId) =>
  tiers[mochis[id].tier].exchangeCost;
// Cheapest mochi the user hasn't met yet (Figma P-08 shows a single candidate).
export const exchangeCandidate = (owned: MochiId[]) =>
  mochiOrder
    .filter(id => !owned.includes(id))
    .sort((a, b) => exchangeCost(a) - exchangeCost(b))[0];

export const useGachaStore = create<GachaState>((set, get) => ({
  ...initialGachaState(),
  resetSession: () =>
    set(state => ({
      ...initialGachaState(),
      session: state.session + 1,
      equipmentVersion: state.equipmentVersion + 1,
    })),
  pull: async count => {
    const { tickets, owned, pulling, session } = get();
    if (pulling || count < 1 || count > tickets) return [];
    set({ pulling: true });
    try {
      const items = await mockGachaService.pull(count, owned);
      if (get().session !== session) return [];
      const fresh = items.filter(item => item.isNew).map(item => item.id);
      // A single duplicate is shown as shards flying to the chip on Home (P-12),
      // so its shards land only when that animation finishes.
      const deferred = count === 1 && !items[0].isNew ? items[0] : null;
      const earned = deferred
        ? 0
        : items.reduce((sum, item) => sum + item.shards, 0);
      set(state => ({
        tickets: state.tickets - count,
        shards: state.shards + earned,
        owned: [...state.owned, ...fresh],
        unseen: [...state.unseen, ...fresh],
        lastPull: items,
        pendingDuplicate: deferred,
        acquiredAt: {
          ...state.acquiredAt,
          ...Object.fromEntries(
            fresh.map(id => [id, new Date().toISOString()]),
          ),
        },
      }));
      return items;
    } finally {
      if (get().session === session) set({ pulling: false });
    }
  },
  applyDuplicate: () =>
    set(state =>
      state.pendingDuplicate
        ? {
            shards: state.shards + state.pendingDuplicate.shards,
            pendingDuplicate: null,
          }
        : {},
    ),
  markSeen: id =>
    set(state => ({ unseen: state.unseen.filter(item => item !== id) })),
  exchange: async id => {
    const session = get().session;
    const cost = exchangeCost(id);
    if (get().owned.includes(id) || get().shards < cost) return;
    await mockGachaService.exchange(id);
    if (get().session !== session) return;
    set(state => ({
      shards: state.shards - cost,
      owned: [...state.owned, id],
      unseen: [...state.unseen, id],
      acquiredAt: { ...state.acquiredAt, [id]: new Date().toISOString() },
    }));
  },
  equip: async (emotion, id) => {
    const state = get();
    if (state.equipping || state.equippedByEmotion[emotion] === id)
      return false;
    if (id !== 'default' && !state.owned.includes(id)) {
      set({ equipmentError: '보유한 모찌만 장착할 수 있어요.' });
      return false;
    }
    const version = state.equipmentVersion;
    set({ equipping: true, equipmentError: '' });
    try {
      await mockEquipmentService.equip(emotion, id);
      if (get().equipmentVersion !== version) return false;
      set(current => ({
        equippedByEmotion: { ...current.equippedByEmotion, [emotion]: id },
      }));
      return true;
    } catch (error) {
      if (get().equipmentVersion === version)
        set({
          equipmentError:
            error instanceof Error ? error.message : '장착하지 못했어요.',
        });
      return false;
    } finally {
      if (get().equipmentVersion === version) set({ equipping: false });
    }
  },
  resetEquipment: () =>
    set(state => ({
      equippedByEmotion: defaultEmotionEquipment(),
      equipping: false,
      equipmentError: '',
      equipmentVersion: state.equipmentVersion + 1,
    })),
}));
