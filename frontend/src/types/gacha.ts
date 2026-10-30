import type { Emotion } from './diary';

export type Tier = 'basic' | 'common' | 'rare' | 'epic' | 'legend' | 'myth';
// 모찌 카드 (backend docs/api/gacha.md "Card"). 카드마다 감정이 하나이고, 그림은 서버가 주는 공개 이미지다.
export interface MochiCard {
  cardId: number;
  code: string;
  name: string;
  tier: Tier;
  emotion: Emotion;
  series: string;
  imageUrl: string;
  owned: boolean;
  ownedCount: number;
  // 얻은 뒤 도감에서 아직 보지 않은 카드.
  isNew: boolean;
  // 별조각 교환가. 일반·희귀·영웅은 교환할 수 없어 null.
  exchangeCost: number | null;
}
export interface PullItem {
  card: MochiCard;
  // 처음 얻은 카드. 중복이면 shards만큼 별조각을 받았다.
  isNew: boolean;
  shards: number;
}
export interface GachaWallet {
  tickets: number;
  shards: number;
}
export interface GachaStatus extends GachaWallet {
  collection: { owned: number; total: number };
}
export interface TierRate {
  tier: Tier;
  // 0~1
  rate: number;
  duplicateShards: number;
}
export interface DrawResult extends GachaStatus {
  items: PullItem[];
}
export interface CollectionResponse {
  owned: number;
  total: number;
  shards: number;
  cards: MochiCard[];
}
