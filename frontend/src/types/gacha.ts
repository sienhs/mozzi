export type Tier = 'common' | 'rare' | 'epic' | 'legend' | 'myth';
export type MochiId =
  | 'strawberry-crown'
  | 'peach'
  | 'watermelon'
  | 'grape'
  | 'cherry'
  | 'blueberry'
  | 'apple'
  | 'mango';
export interface PullItem {
  id: MochiId;
  isNew: boolean;
  // Shards granted when the mochi was already owned; 0 for a new one.
  shards: number;
}
export interface PullResult {
  items: PullItem[];
  tickets: number;
  shards: number;
}
