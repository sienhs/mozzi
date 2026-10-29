import { create } from 'zustand';
import { rewardApi, type Reward } from '@/services/rewardApi';

// 받은 뽑기권 알림. 여러 보상이 겹치면 차례로 보여 준다.
interface RewardState {
  queue: Reward[];
  show: (reward: Reward) => void;
  dismiss: () => void;
  // 매일 접속 보상. 앱이 켜지거나 다시 활성화될 때 부른다. 실패해도 다음 활성화 때 다시 묻는다.
  checkDailyLogin: () => Promise<void>;
  resetSession: () => void;
}
let checking: Promise<void> | null = null;
let session = 0;
export const useRewardStore = create<RewardState>((set, get) => ({
  queue: [],
  show: reward => set(state => ({ queue: [...state.queue, reward] })),
  dismiss: () => set(state => ({ queue: state.queue.slice(1) })),
  checkDailyLogin: () => {
    checking ??= (async () => {
      const current = session;
      try {
        const reward = await rewardApi.dailyLogin();
        if (reward && current === session) get().show(reward);
      } catch {
        /* 보상 확인은 화면을 막지 않는다. */
      } finally {
        checking = null;
      }
    })();
    return checking;
  },
  resetSession: () => {
    session += 1;
    set({ queue: [] });
  },
}));
