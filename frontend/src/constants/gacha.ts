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
  // P-02 개봉 연출 영상 (Vidu Q3 Pro로 생성, 소리 없음, 720×1080 · 24fps · 5.04초).
  openingVideo: require('../../assets/gacha/opening-myth.mp4'),
  // 영상의 첫 프레임: 영상이 준비되기 전과 동작 줄이기에서 보여 준다.
  openingPoster: require('../../assets/gacha/opening-first-frame.jpg'),
  mochi: require('../../assets/gacha/mochi-malang-default.png'),
  error: require('../../assets/gacha/mochi-malang-error.png'),
  frame: require('../../assets/gacha/reward-card-frame.png'),
  star: require('../../assets/gacha/reward-star.png'),
};
export const mochiName = (id: MochiId) => `${mochis[id].name} 모찌`;

export interface OpeningClip {
  source: number;
  poster: ImageSourcePropType;
  duration: number;
  startAt: number;
  flashAt: number;
  beats: readonly {
    at: number;
    strength: 'light' | 'medium' | 'heavy';
  }[];
}

// 로컬 영상의 실제 프레임 기준(초). 기본 파일의 기존 이름은 그대로 보존한다.
// 새 영상도 같은 닫힌 병 이미지에서 시작하므로 포스터를 공유한다.
export const openingClips = {
  basic: {
    source: gachaArt.openingVideo,
    poster: gachaArt.openingPoster,
    duration: 5.04,
    startAt: 0,
    flashAt: 4.6,
    beats: [
      { at: 1.5, strength: 'light' },
      { at: 3.0, strength: 'medium' },
      { at: 3.38, strength: 'heavy' },
    ],
  },
  legend: {
    source: require('../../assets/gacha/opening-legend.mp4'),
    poster: gachaArt.openingPoster,
    duration: 6.04,
    startAt: 0,
    // 금빛 분출과 후광을 보여 준 뒤 결과로 이동한다.
    flashAt: 5.65,
    beats: [
      { at: 1.65, strength: 'light' },
      { at: 3.8, strength: 'medium' },
      { at: 4.12, strength: 'heavy' },
    ],
  },
  myth: {
    source: require('../../assets/gacha/opening-mythic.mp4'),
    poster: gachaArt.openingPoster,
    duration: 7.04,
    startAt: 0,
    // 은하 전조뿐 아니라 개봉 후 오로라·궤도 고리도 충분히 보여 준다.
    flashAt: 6.65,
    beats: [
      { at: 2.4, strength: 'light' },
      { at: 3.85, strength: 'medium' },
      { at: 5.2, strength: 'heavy' },
    ],
  },
} as const satisfies Record<string, OpeningClip>;

// API 연결 후에도 확정된 결과의 최고 등급만 전달하면 같은 재생 경로를 쓴다.
export function getOpeningClip(tier: Tier): OpeningClip {
  if (tier === 'legend') return openingClips.legend;
  if (tier === 'myth') return openingClips.myth;
  // 기존 일반·희귀의 빠른 개봉은 유지하고, 영웅은 기본 영상을 전부 재생한다.
  return {
    ...openingClips.basic,
    startAt: tier === 'common' || tier === 'rare' ? 3 : 0,
  };
}

export const highestTier = (ids: MochiId[]): Tier =>
  ids.reduce<Tier>(
    (best, id) =>
      tierOrder.indexOf(mochis[id].tier) > tierOrder.indexOf(best)
        ? mochis[id].tier
        : best,
    'common',
  );
