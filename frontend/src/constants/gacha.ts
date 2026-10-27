import type { ImageSourcePropType } from 'react-native';
import type { MochiId, Tier } from '@/types/gacha';
import { colors } from '@/theme/tokens';

// Figma 05 · P-05 "등급별 획득 확률" (시즌 2 · 과일 / 1회 뽑기 기준).
export const tierOrder: Tier[] = ['common', 'rare', 'epic', 'legend', 'myth'];
export const tiers: Record<
  Tier,
  {
    label: string;
    odds: number;
    duplicateShards: number;
    // Mock assumption: Figma only shows 영웅 = 50. The rest scale from it.
    exchangeCost: number;
    color: string;
    badge: string;
  }
> = {
  common: {
    label: '일반',
    odds: 45,
    duplicateShards: 1,
    exchangeCost: 10,
    color: colors.muted,
    badge: colors.gachaCream,
  },
  rare: {
    label: '희귀',
    odds: 30,
    duplicateShards: 2,
    exchangeCost: 20,
    color: colors.gachaBlue,
    badge: colors.gachaBlueSoft,
  },
  epic: {
    label: '영웅',
    odds: 17,
    duplicateShards: 5,
    exchangeCost: 50,
    color: colors.gachaViolet,
    badge: colors.gachaVioletSoft,
  },
  legend: {
    label: '전설',
    odds: 6.5,
    duplicateShards: 15,
    exchangeCost: 150,
    color: colors.gachaGoldInk,
    badge: colors.gachaCream,
  },
  myth: {
    label: '신화',
    odds: 1.5,
    duplicateShards: 40,
    exchangeCost: 400,
    color: colors.gachaRose,
    badge: colors.gachaRoseSoft,
  },
};
export const season = '시즌 2 · 과일';
// Collection order follows Figma P-06.
export const mochiOrder: MochiId[] = [
  'strawberry-crown',
  'peach',
  'watermelon',
  'grape',
  'cherry',
  'blueberry',
  'apple',
  'mango',
];
// Keep these static require calls: Metro must discover every PNG at build time.
export const mochis: Record<
  MochiId,
  { name: string; tier: Tier; source: ImageSourcePropType }
> = {
  'strawberry-crown': {
    name: '딸기 왕관',
    tier: 'myth',
    source: require('../../assets/gacha/mochi-strawberry-crown.png'),
  },
  peach: {
    name: '천도복숭아',
    tier: 'legend',
    source: require('../../assets/gacha/mochi-peach.png'),
  },
  watermelon: {
    name: '수박',
    tier: 'epic',
    source: require('../../assets/gacha/mochi-watermelon.png'),
  },
  grape: {
    name: '포도',
    tier: 'epic',
    source: require('../../assets/gacha/mochi-grape.png'),
  },
  cherry: {
    name: '체리',
    tier: 'rare',
    source: require('../../assets/gacha/mochi-cherry.png'),
  },
  blueberry: {
    name: '블루베리',
    tier: 'rare',
    source: require('../../assets/gacha/mochi-blueberry.png'),
  },
  apple: {
    name: '사과',
    tier: 'common',
    source: require('../../assets/gacha/mochi-apple.png'),
  },
  mango: {
    name: '망고',
    tier: 'common',
    source: require('../../assets/gacha/mochi-mango.png'),
  },
};
export const gachaArt = {
  room: require('../../assets/gacha/jar-night-room.png'),
  opening: require('../../assets/gacha/jar-night-room-with-mochi.png'),
  mochi: require('../../assets/gacha/mochi-malang-default.png'),
  error: require('../../assets/gacha/mochi-malang-error.png'),
  frame: require('../../assets/gacha/reward-card-frame.png'),
  star: require('../../assets/gacha/reward-star.png'),
};
export const mochiName = (id: MochiId) => `${mochis[id].name} 모찌`;
