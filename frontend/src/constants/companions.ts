import type { ImageSourcePropType } from 'react-native';
import { gachaArt, mochiOrder, mochis } from './gacha';
import { emotions } from './emotions';
import type { Emotion } from '@/types/diary';
import type { Tier } from '@/types/gacha';
import type { CompanionId, MochiCategory } from '@/types/companion';

export const mochiCategories: { id: MochiCategory; label: string }[] = [
  { id: 'animal', label: '동물' },
  { id: 'plant', label: '식물' },
  { id: 'weather', label: '날씨' },
  { id: 'night-sky', label: '밤하늘' },
  { id: 'stationery', label: '기록실 문구' },
  { id: 'fruit', label: '과일' },
  { id: 'halloween', label: '할로윈' },
  { id: 'christmas', label: '크리스마스' },
];

export interface Companion {
  id: CompanionId;
  name: string;
  category: MochiCategory | null;
  tier: Tier;
  source: ImageSourcePropType;
  description: string;
  // Non-default emotion sets are intentionally empty until real artwork is supplied.
  emotionSources: Partial<Record<Emotion, ImageSourcePropType>>;
}
const descriptions: Record<Exclude<CompanionId, 'default'>, string> = {
  'strawberry-crown': '달콤한 오늘을 함께 그릴 친구',
  peach: '포근한 마음을 나누는 복숭아 친구',
  watermelon: '시원한 웃음을 건네는 수박 친구',
  grape: '작은 즐거움을 모으는 포도 친구',
  cherry: '반짝이는 순간을 함께하는 체리 친구',
  blueberry: '차분한 하루를 응원하는 블루베리 친구',
  apple: '싱그러운 시작을 함께하는 사과 친구',
  mango: '따뜻한 햇살을 닮은 망고 친구',
};
const defaultCompanion: Companion = {
  id: 'default',
  name: '기본 모찌',
  category: null,
  tier: 'common',
  source: gachaArt.mochi,
  description: '언제나 곁에 있는 말랑한 친구',
  emotionSources: Object.fromEntries(
    Object.entries(emotions).map(([key, value]) => [key, value.source]),
  ),
};
export const companions: Record<CompanionId, Companion> = {
  default: defaultCompanion,
  ...Object.fromEntries(
    mochiOrder.map(id => [
      id,
      {
        id,
        name: `${mochis[id].name} 모찌`,
        tier: mochis[id].tier,
        category: 'fruit',
        source: mochis[id].source,
        description: descriptions[id],
        emotionSources: {},
      },
    ]),
  ),
} as Record<CompanionId, Companion>;

export function isCompanionId(id: string): id is CompanionId {
  return Object.prototype.hasOwnProperty.call(companions, id);
}

export function companionEmotionSource(
  id: CompanionId,
  emotion: Emotion,
  small = false,
) {
  if (id === 'default' && small) return emotions[emotion].face;
  return companions[id].emotionSources[emotion] ?? companions[id].source;
}
