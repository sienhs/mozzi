import type { ImageSource } from 'expo-image';
import type { Tier } from '@/types/gacha';

// 등급 표시(이름·색). 확률·별조각·교환가는 서버 값(GET /gacha/rates, 카드의 exchangeCost)을 쓴다.
export const tierOrder: Tier[] = [
  'basic',
  'common',
  'rare',
  'epic',
  'legend',
  'myth',
];
export const tiers: Record<
  Tier,
  { label: string; color: string; badge: string }
> = {
  basic: { label: '기본', color: '#7A7166', badge: '#F2EFEA' },
  common: { label: '일반', color: '#596273', badge: '#EDF0F4' },
  rare: { label: '희귀', color: '#1764D1', badge: '#E8F1FF' },
  epic: { label: '영웅', color: '#8535CD', badge: '#F3E8FF' },
  legend: { label: '전설', color: '#B95600', badge: '#FFF0D6' },
  myth: { label: '신화', color: '#D22364', badge: '#FFE5EF' },
};
export const gachaArt = {
  room: require('../../assets/gacha/jar-night-room.png'),
  mochi: require('../../assets/gacha/mochi-malang-default.png'),
  error: require('../../assets/gacha/mochi-malang-error.png'),
  frame: require('../../assets/gacha/reward-card-frame.png'),
  star: require('../../assets/gacha/reward-star.png'),
};

// P-02 개봉 연출. 세로 1080×1920, 무음, 이미 1.5배속으로 만든 영상이라 재생 속도는 1.0이다.
// 앞 3초(intro) 뒤 한 번의 입력을 기다리고, 남은 11초(continuation)를 잇는다.
// intro와 시작·대기 이미지는 세 등급이 같은 파일이라 하나만 둔다.
export interface OpeningClip {
  intro: number;
  continuation: number;
  // 영상이 준비되기 전에 보여 준다(intro의 첫 프레임).
  start: ImageSource | number;
  // 입력을 기다리는 동안, continuation 첫 프레임이 뜨기 전까지 보여 준다.
  touch: ImageSource | number;
  // 마지막 장면. 결과로 넘어갈 때와 재생 실패 시 보여 준다.
  end: ImageSource | number;
}
export const OPENING_INTRO_SECONDS = 3;
export const OPENING_CONTINUATION_SECONDS = 11;
// 영상 밖 여백. 9:16이 아닌 화면에서 장면 가장자리의 따뜻한 갈색과 이어지게 한다.
export const OPENING_BACKDROP = '#B98A72';

const shared = {
  intro: require('../../assets/gacha/opening/intro.mp4'),
  start: require('../../assets/gacha/opening/start.png'),
  touch: require('../../assets/gacha/opening/touch.png'),
};
export const openingClips = {
  base: {
    ...shared,
    continuation: require('../../assets/gacha/opening/base-continuation.mp4'),
    end: require('../../assets/gacha/opening/base-end.png'),
  },
  // 서류에서 황금빛 줄기, 눈 확대 장면에서 금빛 반사와 섬광.
  legend: {
    ...shared,
    continuation: require('../../assets/gacha/opening/legend-continuation.mp4'),
    end: require('../../assets/gacha/opening/legend-end.png'),
  },
  // 서류에서 붉은빛, 눈 확대 장면에서 붉은 섬광.
  myth: {
    ...shared,
    continuation: require('../../assets/gacha/opening/myth-continuation.mp4'),
    end: require('../../assets/gacha/opening/myth-end.png'),
  },
} as const satisfies Record<string, OpeningClip>;

// 서버가 확정한 결과의 최고 등급으로 고른다. 일반·희귀·영웅은 기본 연출을 처음부터 전부 재생한다.
export function getOpeningClip(tier: Tier): OpeningClip {
  if (tier === 'legend') return openingClips.legend;
  if (tier === 'myth') return openingClips.myth;
  return openingClips.base;
}

export const highestTier = (list: Tier[]): Tier =>
  list.reduce<Tier>(
    (best, tier) =>
      tierOrder.indexOf(tier) > tierOrder.indexOf(best) ? tier : best,
    'common',
  );
