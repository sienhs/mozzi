import { create } from 'zustand';
import { feedbackPrompt } from '@/services/feedbackPrompt';
import type { GachaWallet, MochiCard, PullItem } from '@/types/gacha';
import { gachaApi, gachaKeys } from '@/services/gachaApi';
import { mozziKeys } from '@/services/mozziApi';
import { apiErrorMessage, isUnknownOutcome } from '@/services/authErrors';
import { queryClient } from '@/services/queryClient';
import { prefetchImages } from '@/services/imagePrefetch';
import { cardImageUrls } from '@/components/gacha/CardImage';
import { createRequestKey } from '@/utils/requestKey';

// 뽑기 흐름의 화면 상태. 잔액·도감은 서버(GET /gacha/status, /gacha/collection)가 정하고,
// 여기에는 방금 뽑은 결과와 연출 중인 별조각만 둔다.
export const initialGachaState = () => ({
  session: 0,
  // 서버 잔액. 받기 전에는 null.
  wallet: null as GachaWallet | null,
  lastPull: [] as PullItem[],
  // 1장 뽑기의 중복은 홈에서 별조각이 칩으로 날아가는 연출(P-12)이 끝나야 잔액에 더해 보인다.
  pendingDuplicate: null as PullItem | null,
  pulling: false,
  // 실패한 뽑기를 다시 시도할 때 같은 키를 쓴다. 서버가 이미 처리했으면 그 결과를 돌려준다.
  draw: null as { count: number; key: string } | null,
  drawError: '',
  // 응답을 받지 못해 서버가 처리했는지 모르는 실패.
  drawUnknown: false,
  lastExchange: null as MochiCard | null,
});
interface GachaState extends ReturnType<typeof initialGachaState> {
  resetSession: () => void;
  setWallet: (wallet: GachaWallet) => void;
  pull: (memberId: number, count: number) => Promise<PullItem[]>;
  applyDuplicate: () => void;
  exchange: (memberId: number, cardId: number) => Promise<MochiCard>;
}
const refresh = (memberId: number) => {
  void queryClient.invalidateQueries({ queryKey: gachaKeys.all(memberId) });
  void queryClient.invalidateQueries({ queryKey: mozziKeys.all(memberId) });
};
let exchangeKey: { cardId: number; key: string } | null = null;

export const useGachaStore = create<GachaState>((set, get) => ({
  ...initialGachaState(),
  resetSession: () => {
    exchangeKey = null;
    set(state => ({ ...initialGachaState(), session: state.session + 1 }));
  },
  setWallet: ({ tickets, shards }) => {
    const pending = get().pendingDuplicate;
    set({ wallet: { tickets, shards: shards - (pending?.shards ?? 0) } });
  },
  pull: async (memberId, count) => {
    const { pulling, session } = get();
    if (pulling || count < 1 || count > 10) return [];
    const previous = get().draw;
    const draw =
      previous?.count === count ? previous : { count, key: createRequestKey() };
    set({ pulling: true, draw, drawError: '', drawUnknown: false });
    try {
      const result = await gachaApi.draw(count, draw.key);
      if (get().session !== session) return [];
      const deferred =
        count === 1 && !result.items[0].isNew ? result.items[0] : null;
      void feedbackPrompt.markPulled(memberId);
      set({
        draw: null,
        lastPull: result.items,
        pendingDuplicate: deferred,
        wallet: {
          tickets: result.tickets,
          shards: result.shards - (deferred?.shards ?? 0),
        },
      });
      queryClient.setQueryData(gachaKeys.status(memberId), {
        tickets: result.tickets,
        shards: result.shards,
        collection: result.collection,
      });
      // 개봉 영상이 도는 동안 결과 카드 그림을 받아 둔다(공개할 때 바로 보이게).
      void prefetchImages(
        result.items.flatMap(item => cardImageUrls(item.card.imageUrl, true)),
      );
      refresh(memberId);
      return result.items;
    } catch (error) {
      if (get().session === session)
        set({
          drawError: apiErrorMessage(
            error,
            '뽑기를 시작하지 못했어요. 다시 시도해 주세요.',
          ),
          drawUnknown: isUnknownOutcome(error),
        });
      throw error;
    } finally {
      if (get().session === session) set({ pulling: false });
    }
  },
  applyDuplicate: () =>
    set(state =>
      state.pendingDuplicate && state.wallet
        ? {
            wallet: {
              ...state.wallet,
              shards: state.wallet.shards + state.pendingDuplicate.shards,
            },
            pendingDuplicate: null,
          }
        : { pendingDuplicate: null },
    ),
  exchange: async (memberId, cardId) => {
    const session = get().session;
    if (exchangeKey?.cardId !== cardId)
      exchangeKey = { cardId, key: createRequestKey() };
    const result = await gachaApi.exchange(cardId, exchangeKey.key);
    exchangeKey = null;
    if (get().session === session)
      set(state => ({
        lastExchange: result.card,
        wallet: state.wallet
          ? { ...state.wallet, shards: result.shards }
          : state.wallet,
      }));
    refresh(memberId);
    return result.card;
  },
}));
