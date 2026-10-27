export type Emotion = 'happy' | 'calm' | 'neutral' | 'sad' | 'angry';
export type Activity =
  '공부' | '업무' | '운동' | '휴식' | '친구' | '취미' | '가족' | '기타';
export type GenerationStatus = 'generating' | 'ready' | 'failed';
export interface DiaryDraft {
  emotion: Emotion | null;
  activities: Activity[];
  memo: string;
}
export interface DiaryEntry {
  id: string;
  date: string;
  emotion: Emotion;
  activities: Activity[];
  memo: string;
  title: string;
  createdAt: string;
  generation: GenerationStatus;
}
export interface Profile {
  nickname: string;
  email: string;
}
export interface SearchResult {
  answer: string;
  entries: DiaryEntry[];
}
