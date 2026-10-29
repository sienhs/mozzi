import type { MochiId } from './gacha';
import type { Emotion } from './diary';

export type CompanionId = 'default' | MochiId;
export type EmotionEquipment = Record<Emotion, CompanionId>;
export const defaultEmotionEquipment = (): EmotionEquipment => ({
  happy: 'default',
  calm: 'default',
  neutral: 'default',
  sad: 'default',
  angry: 'default',
});
export type MochiCategory =
  | 'animal'
  | 'plant'
  | 'weather'
  | 'night-sky'
  | 'stationery'
  | 'fruit'
  | 'halloween'
  | 'christmas';
export type CompanionSort = 'recent' | 'oldest' | 'name';
