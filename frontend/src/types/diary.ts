import type { CompanionId } from './companion';

export type Emotion = 'happy' | 'calm' | 'neutral' | 'sad' | 'angry';
export type GenerationStatus = 'generating' | 'ready' | 'failed';

// 기본 태그 분류. 그림의 장면 축(무엇을·어디서·누구와·날씨)과 같다.
export type TagCategory = 'activity' | 'place' | 'companion' | 'weather';
export interface PresetTag {
  // 앱 안에서 바뀌지 않는 ID ('activity.cooking').
  id: string;
  // 서버·AI로 보내는 코드 ('COOKING'). CONTRACT: B2 — 서버 목록이 정해지면 /meta 값으로 바뀐다.
  code: string;
  category: TagCategory;
  label: string;
}
// 사용자가 만든 내 태그. 계정별로 서버에 저장한다 (CONTRACT: B3).
export interface CustomTag {
  id: string;
  label: string;
  // 중복 비교용 (정규화 + 영문 소문자).
  key: string;
  createdAt: string;
}
// 이번 기록에서 고른 태그. ID만 담는다.
export interface TagSelection {
  // 누른 순서. 첫 번째가 대표 활동.
  activities: string[];
  place: string | null;
  companions: string[];
  // null이면 서버가 맑음으로 그린다.
  weather: string | null;
  custom: string[];
}
// 기록에 남는 태그 스냅샷. 내 태그를 지워도 지난 기록의 라벨은 그대로다.
export interface DiaryTag {
  category: TagCategory | 'custom' | 'legacy';
  code: string | null;
  label: string;
}
export interface DiaryDraft {
  // 첫 선택 때 고정한다. 자정을 넘겨도 시작한 날의 기록으로 보낸다.
  recordDate: string | null;
  emotion: Emotion | null;
  tags: TagSelection;
  // 오늘의 한 줄. 그림을 확인한 뒤에 쓴다 (선택).
  memo: string;
}
// 그림 요청 값. 프롬프트 문장은 만들지 않고 코드와 내 태그 ID만 보낸다 (CONTRACT: B1).
export interface GenerationRequest {
  recordDate: string;
  emotion: Emotion;
  activities: string[];
  place: string | null;
  companions: string[];
  weather: string | null;
  customTagIds: string[];
}
export interface GenerationFailure {
  code: string;
  message: string;
  // false면 같은 태그로 다시 그려도 소용없다 (유해 판정 등) → 다시 작성하기.
  retryable: boolean;
  remainingRetries: number;
  blockedTags: DiaryTag[];
}
export type RecordPhase =
  | 'editing'
  | 'requesting'
  | 'generating'
  | 'failed'
  | 'reviewing'
  | 'saving'
  | 'completed';
export interface DiaryEntry {
  // Absent on legacy records; those retain the default character.
  companionId?: CompanionId;
  id: string;
  date: string;
  emotion: Emotion;
  tags: DiaryTag[];
  memo: string;
  title: string;
  createdAt: string;
  generation: GenerationStatus;
  // 그림이 완성돼도 사용자가 저장하기 전에는 draft다.
  status: 'draft' | 'completed';
  failure: GenerationFailure | null;
}
export interface SearchResult {
  answer: string;
  entries: DiaryEntry[];
}
