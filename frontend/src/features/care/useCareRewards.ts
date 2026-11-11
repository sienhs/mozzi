import { create } from 'zustand';
import { todayKey } from '@/constants/date';
import { gachaKeys } from '@/services/gachaApi';
import { queryClient } from '@/services/queryClient';
import { rewardApi, type CareRewardAction } from '@/services/rewardApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRewardStore } from '@/stores/useRewardStore';
import type { CareAction } from './careModel';

const ACTION: Record<CareAction, CareRewardAction> = {
  pet: 'PET',
  feed: 'FEED',
  play: 'PLAY',
};

// sending: 묻는 중 · granted: 방금 받음 · claimed: 오늘 이미 받음 · failed: 응답을 받지 못함(다시 보낼 수 있다).
export type CareRewardOutcome = 'sending' | 'granted' | 'claimed' | 'failed';
interface CareRewardState {
  // `${memberId}:${date}` — 날짜나 회원이 바뀌면 기록을 비운다.
  owner: string;
  outcomes: Partial<Record<CareAction, CareRewardOutcome>>;
  claim: (action: CareAction) => Promise<void>;
}

const ownerOf = (memberId: number, date = todayKey()) => `${memberId}:${date}`;

// 돌보기 보상은 서버가 활동·날짜별로 한 번만 준다. 앱은 끝난 활동을 알리고, 받은 보상을 띄운다.
export const useCareRewardStore = create<CareRewardState>((set, get) => ({
  owner: '',
  outcomes: {},
  claim: async action => {
    const memberId = useAuthStore.getState().member?.memberId;
    if (memberId == null) return;
    const owner = ownerOf(memberId);
    if (get().owner !== owner) set({ owner, outcomes: {} });
    if (get().outcomes[action] === 'sending') return;
    set(state => ({ outcomes: { ...state.outcomes, [action]: 'sending' } }));
    try {
      const result = await rewardApi.care(ACTION[action]);
      const outcome: CareRewardOutcome = result.reward ? 'granted' : 'claimed';
      // 기다리는 사이 자정이 지났어도 서버가 정한 날짜로 기록한다.
      const resultOwner = ownerOf(memberId, result.date);
      set(state =>
        state.owner === resultOwner
          ? { outcomes: { ...state.outcomes, [action]: outcome } }
          : { owner: resultOwner, outcomes: { [action]: outcome } },
      );
      if (result.reward) useRewardStore.getState().show(result.reward);
      void queryClient.invalidateQueries({ queryKey: gachaKeys.all(memberId) });
    } catch {
      set(state =>
        state.owner === owner
          ? { outcomes: { ...state.outcomes, [action]: 'failed' } }
          : state,
      );
    }
  },
}));

// 오늘(서울) 기준의 결과만 돌려준다.
export function useCareRewardOutcome(action: CareAction) {
  const memberId = useAuthStore(state => state.member?.memberId);
  return useCareRewardStore(state =>
    memberId != null && state.owner === ownerOf(memberId)
      ? state.outcomes[action]
      : undefined,
  );
}
