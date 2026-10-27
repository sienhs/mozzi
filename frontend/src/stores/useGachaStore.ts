import { create } from 'zustand';
import type { MochiId, PullItem } from '@/types/gacha';
import { mochiOrder, mochis, tiers } from '@/constants/gacha';
import { mockGachaService } from '@/mocks/services';

// Figma demo values (P-01: 뽑기권 23 · 별조각 140). The server will own these later.
const initialOwned: MochiId[] = [
  'grape',
  'cherry',
  'blueberry',
  'apple',
  'mango',
];
export const initialGachaState = () => ({
  tickets: 23,
  shards: 140,
  owned: [...initialOwned],
  unseen: [] as MochiId[],
  lastPull: [] as PullItem[],
  pendingDuplicate: null as PullItem | null,
  pulling: false,
});
interface GachaState extends ReturnType<typeof initialGachaState> {
  pull: (count: number) => Promise<PullItem[]>;
  applyDuplicate: () => void;
  markSeen: (id: MochiId) => void;
  exchange: (id: MochiId) => Promise<void>;
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
  pull: async count => {
    const { tickets, owned, pulling } = get();
    if (pulling || count < 1 || count > tickets) return [];
    set({ pulling: true });
    try {
      const items = await mockGachaService.pull(count, owned);
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
      }));
      return items;
    } finally {
      set({ pulling: false });
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
    const cost = exchangeCost(id);
    if (get().owned.includes(id) || get().shards < cost) return;
    await mockGachaService.exchange(id);
    set(state => ({
      shards: state.shards - cost,
      owned: [...state.owned, id],
      unseen: [...state.unseen, id],
    }));
  },
}));
