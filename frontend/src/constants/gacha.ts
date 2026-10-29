import type { ImageSourcePropType } from 'react-native';
import type { Tier } from '@/types/gacha';

// 등급 표시(이름·색). 확률·별조각·교환가는 서버 값(GET /gacha/rates, 카드의 exchangeCost)을 쓴다.
export const tierOrder: Tier[] = ['common', 'rare', 'epic', 'legend', 'myth'];
export const tiers: Record<
  Tier,
  { label: string; color: string; badge: string }
> = {
  common: { label: '일반', color: '#596273', badge: '#EDF0F4' },
  rare: { label: '희귀', color: '#1764D1', badge: '#E8F1FF' },
  epic: { label: '영웅', color: '#8535CD', badge: '#F3E8FF' },
  legend: { label: '전설', color: '#B95600', badge: '#FFF0D6' },
  myth: { label: '신화', color: '#D22364', badge: '#FFE5EF' },
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

export const highestTier = (list: Tier[]): Tier =>
  list.reduce<Tier>(
    (best, tier) =>
      tierOrder.indexOf(tier) > tierOrder.indexOf(best) ? tier : best,
    'common',
  );
