import { invalidResponse, type ServerEmotion } from '@/types/server';
import type {
  CollectionResponse,
  DrawResult,
  GachaStatus,
  MochiCard,
  Tier,
  TierRate,
} from '@/types/gacha';
import type { Emotion } from '@/types/diary';
import { api } from './api';

// 모찌 뽑기·도감·교환 API (backend docs/api/gacha.md). 추첨은 서버만 한다.
export type ServerTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
const tierOf: Record<ServerTier, Tier> = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legend',
  MYTHIC: 'myth',
};
export const serverTier = (tier: Tier) =>
  (Object.keys(tierOf) as ServerTier[]).find(key => tierOf[key] === tier)!;
const serverEmotions: ServerEmotion[] = [
  'HAPPY',
  'CALM',
  'NEUTRAL',
  'SAD',
  'ANGRY',
];
type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isText = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();

export function parseTier(value: unknown): Tier {
  if (typeof value !== 'string' || !(value in tierOf)) throw invalidResponse();
  return tierOf[value as ServerTier];
}
export function parseEmotion(value: unknown): Emotion {
  if (!serverEmotions.includes(value as ServerEmotion)) throw invalidResponse();
  return (value as string).toLowerCase() as Emotion;
}
export function parseCard(value: unknown): MochiCard {
  if (
    !isObject(value) ||
    !isId(value.cardId) ||
    !isText(value.code) ||
    !isText(value.name) ||
    !isText(value.imageUrl) ||
    typeof value.owned !== 'boolean' ||
    !isCount(value.ownedCount) ||
    typeof value.isNew !== 'boolean' ||
    (value.exchangeCost !== null && !isCount(value.exchangeCost))
  )
    throw invalidResponse();
  return {
    cardId: value.cardId,
    code: value.code,
    name: value.name,
    tier: parseTier(value.tier),
    emotion: parseEmotion(value.emotion),
    series: typeof value.series === 'string' ? value.series : '',
    imageUrl: value.imageUrl,
    owned: value.owned,
    ownedCount: value.ownedCount,
    isNew: value.isNew,
    exchangeCost: value.exchangeCost as number | null,
  };
}
function parseCollectionCount(value: unknown) {
  if (!isObject(value) || !isCount(value.owned) || !isCount(value.total))
    throw invalidResponse();
  return { owned: value.owned, total: value.total };
}
export function parseStatus(value: unknown): GachaStatus {
  if (
    !isObject(value) ||
    !isCount(value.ticketCount) ||
    !isCount(value.shardCount)
  )
    throw invalidResponse();
  return {
    tickets: value.ticketCount,
    shards: value.shardCount,
    collection: parseCollectionCount(value.collection),
  };
}
export function parseDraw(value: unknown, count: number): DrawResult {
  const status = parseStatus(value);
  const data = value as Data;
  if (!Array.isArray(data.results) || data.results.length !== count)
    throw invalidResponse();
  return {
    ...status,
    items: data.results.map(result => {
      if (
        !isObject(result) ||
        typeof result.firstAcquired !== 'boolean' ||
        !isCount(result.shardsGained)
      )
        throw invalidResponse();
      return {
        card: parseCard(result.card),
        isNew: result.firstAcquired,
        shards: result.shardsGained,
      };
    }),
  };
}

export const gachaApi = {
  async status() {
    const { data } = await api.get('/gacha/status');
    return parseStatus(data);
  },
  async rates(): Promise<TierRate[]> {
    const { data } = await api.get('/gacha/rates');
    if (!isObject(data) || !Array.isArray(data.rates)) throw invalidResponse();
    return data.rates.map(item => {
      if (
        !isObject(item) ||
        typeof item.rate !== 'number' ||
        item.rate < 0 ||
        item.rate > 1 ||
        !isCount(item.duplicateShards)
      )
        throw invalidResponse();
      return {
        tier: parseTier(item.tier),
        rate: item.rate,
        duplicateShards: item.duplicateShards,
      };
    });
  },
  // POST /gacha/draws. 같은 키로 다시 보내면 첫 결과를 돌려준다(뽑기권은 한 번만 쓴다).
  async draw(count: number, requestKey: string) {
    const { data } = await api.post(
      '/gacha/draws',
      { count },
      { headers: { 'Idempotency-Key': requestKey } },
    );
    return parseDraw(data, count);
  },
  async collection(): Promise<CollectionResponse> {
    const { data } = await api.get('/gacha/collection');
    if (
      !isObject(data) ||
      !isCount(data.owned) ||
      !isCount(data.total) ||
      !isCount(data.shardCount) ||
      !Array.isArray(data.cards)
    )
      throw invalidResponse();
    return {
      owned: data.owned,
      total: data.total,
      shards: data.shardCount,
      cards: data.cards.map(parseCard),
    };
  },
  // 도감에서 본 카드의 NEW 표시를 지운다.
  async seen(cardIds: number[]) {
    await api.post('/gacha/collection/seen', { cardIds });
  },
  // POST /gacha/exchanges. 전설·신화 중 아직 없는 카드만 교환할 수 있다.
  async exchange(cardId: number, requestKey: string) {
    const { data } = await api.post(
      '/gacha/exchanges',
      { cardId },
      { headers: { 'Idempotency-Key': requestKey } },
    );
    if (!isObject(data) || !isCount(data.shardCount)) throw invalidResponse();
    return { card: parseCard(data.card), shards: data.shardCount };
  },
};
export const gachaKeys = {
  all: (memberId: number) => ['gacha', memberId] as const,
  status: (memberId: number) => ['gacha', memberId, 'status'] as const,
  rates: (memberId: number) => ['gacha', memberId, 'rates'] as const,
  collection: (memberId: number) => ['gacha', memberId, 'collection'] as const,
};
