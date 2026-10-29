import { invalidResponse } from '@/types/server';
import {
  emptyPicks,
  type Companion,
  type CompanionSort,
  type EmotionPicks,
  type OwnedMozzi,
} from '@/types/companion';
import type { Emotion } from '@/types/diary';
import type { Tier } from '@/types/gacha';
import { api } from './api';
import { parseEmotion, parseTier, serverTier } from './gachaApi';

// 마이페이지 감정별 대표 모찌 (GET /members/me의 mozzis, GET·PUT /members/me/mozzis).
// 고른 모찌는 그 감정의 일기 그림에 서버가 그려 넣는다.
type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function parseCompanion(value: unknown): Companion {
  if (
    !isObject(value) ||
    !Number.isSafeInteger(value.cardId) ||
    typeof value.name !== 'string' ||
    typeof value.imageUrl !== 'string' ||
    !value.imageUrl
  )
    throw invalidResponse();
  return {
    cardId: value.cardId as number,
    name: value.name,
    tier: parseTier(value.tier),
    imageUrl: value.imageUrl,
  };
}
export function parsePicks(value: unknown): EmotionPicks {
  if (!isObject(value) || !Array.isArray(value.mozzis)) throw invalidResponse();
  const picks = emptyPicks();
  for (const item of value.mozzis) {
    if (!isObject(item)) throw invalidResponse();
    picks[parseEmotion(item.emotion)] =
      item.selected === null ? null : parseCompanion(item.selected);
  }
  return picks;
}
const sorts: Record<CompanionSort, string> = {
  recent: 'RECENT',
  oldest: 'OLDEST',
  name: 'NAME',
};
export interface OwnedQuery {
  emotion?: Emotion;
  tier?: Tier | null;
  name?: string;
  sort?: CompanionSort;
}
export const mozziApi = {
  async picks(): Promise<EmotionPicks> {
    const { data } = await api.get('/members/me');
    return parsePicks(data);
  },
  async owned(query: OwnedQuery = {}): Promise<OwnedMozzi[]> {
    const params: Record<string, string> = {
      sort: sorts[query.sort ?? 'recent'],
    };
    if (query.emotion) params.emotion = query.emotion.toUpperCase();
    if (query.tier) params.tier = serverTier(query.tier);
    if (query.name?.trim()) params.name = query.name.trim();
    const { data } = await api.get('/members/me/mozzis', { params });
    if (!isObject(data) || !Array.isArray(data.cards)) throw invalidResponse();
    return data.cards.map(item => {
      if (
        !isObject(item) ||
        typeof item.equipped !== 'boolean' ||
        typeof item.acquiredAt !== 'string'
      )
        throw invalidResponse();
      return {
        ...parseCompanion(item),
        emotion: parseEmotion(item.emotion),
        acquiredAt: item.acquiredAt,
        equipped: item.equipped,
      };
    });
  },
  // PUT /members/me/mozzis/{emotion}. 그 감정의, 가지고 있는 모찌만 고를 수 있다.
  async choose(emotion: Emotion, cardId: number) {
    await api.put(`/members/me/mozzis/${emotion.toUpperCase()}`, { cardId });
  },
};
export const mozziKeys = {
  all: (memberId: number) => ['mozzi', memberId] as const,
  picks: (memberId: number) => ['mozzi', memberId, 'picks'] as const,
  owned: (memberId: number, query: OwnedQuery) =>
    ['mozzi', memberId, 'owned', query] as const,
};
