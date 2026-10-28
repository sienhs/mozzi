import type { MochiId } from './gacha';

export type CompanionId = 'default' | MochiId;
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
