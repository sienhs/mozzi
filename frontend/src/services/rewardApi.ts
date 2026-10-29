import { invalidResponse } from '@/types/server';
import { api } from './api';

// 뽑기권 보상 (backend docs/api/gacha.md#뽑기권-지급). 지급은 서버가 하고, 앱은 받은 보상을 알려 주기만 한다.
export type RewardType = 'SIGNUP' | 'DAILY_LOGIN' | 'DAILY_RECORD';
export interface Reward {
  type: RewardType;
  tickets: number;
  // 지급 후 뽑기권 잔액.
  ticketCount: number;
}
const rewardTypes: RewardType[] = ['SIGNUP', 'DAILY_LOGIN', 'DAILY_RECORD'];
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

// POST /diaries 응답의 reward. 일기는 이미 저장됐으므로 모양이 이상하면 알림만 건너뛴다.
export function parseReward(value: unknown): Reward | null {
  const data = value as Partial<Reward> | null | undefined;
  if (
    !data ||
    !rewardTypes.includes(data.type as RewardType) ||
    !isCount(data.tickets) ||
    data.tickets <= 0 ||
    !isCount(data.ticketCount)
  )
    return null;
  return {
    type: data.type as RewardType,
    tickets: data.tickets,
    ticketCount: data.ticketCount,
  };
}

export const rewardApi = {
  // POST /rewards/daily-login. 그날(서울) 첫 호출만 지급하고, 이후 호출은 granted: false다.
  async dailyLogin(): Promise<Reward | null> {
    const { data } = await api.post('/rewards/daily-login');
    if (
      typeof data?.granted !== 'boolean' ||
      !isCount(data?.tickets) ||
      !isCount(data?.ticketCount)
    )
      throw invalidResponse();
    return data.granted && data.tickets > 0
      ? {
          type: 'DAILY_LOGIN',
          tickets: data.tickets,
          ticketCount: data.ticketCount,
        }
      : null;
  },
};
