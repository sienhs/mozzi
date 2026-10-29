import type { CompanionId } from './companion';

export type Emotion = 'happy' | 'calm' | 'neutral' | 'sad' | 'angry';
// notRequested: 서버에 일기는 있는데 그림 요청이 없다 (요청 유실·앱 종료). 다시 보내기로 복구한다.
export type GenerationStatus =
  'notRequested' | 'generating' | 'ready' | 'failed';

// 기본 태그 분류. 그림의 장면 축(무엇을·어디서·누구와·날씨)과 같다.
export type TagCategory = 'activity' | 'place' | 'companion' | 'weather';
export type CustomTagCategory = Exclude<TagCategory, 'weather'>;
export type SelectableTag = PresetTag | CustomTag;
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
  category: CustomTagCategory;
  id: string;
  label: string;
  // 중복 비교용 (정규화 + 영문 소문자).
  key: string;
  createdAt: string;
}
// 이번 기록에서 고른 태그. ID만 담는다.
export interface TagSelection {
  // 고른 활동 목록. 그림으로 남길 활동은 다음 단계에서 별도로 고른다.
  activities: string[];
  place: string | null;
  companions: string[];
  // null이면 서버가 맑음으로 그린다.
  weather: string | null;
}
// 기록에 남는 태그 스냅샷. 내 태그를 지워도 지난 기록의 라벨은 그대로다.
export interface DiaryTag {
  customTagId?: string;
  category: TagCategory | 'custom' | 'legacy';
  code: string | null;
  label: string;
}
export interface DiaryDraft {
  mainActivityId: string | null;
  // 첫 선택 때 고정한다. 자정을 넘겨도 시작한 날의 기록으로 보낸다.
  recordDate: string | null;
  emotion: Emotion | null;
  tags: TagSelection;
  // 오늘의 한 줄. 그림을 확인한 뒤에 쓴다 (선택).
  memo: string;
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
  | 'notRequested'
  | 'editing'
  | 'requesting'
  | 'generating'
  | 'failed'
  | 'reviewing'
  | 'saving'
  | 'completed';
export interface DiaryEntry {
  // 생성 장면에 사용한 태그. 활동 한 가지와 선택한 장소·동행·날씨만 포함한다.
  imageTags?: DiaryTag[];
  // Absent on legacy records; those retain the default character.
  companionId?: CompanionId;
  // 서버 일기 ID. 로컬 샘플 기록에는 없다.
  serverId?: number;
  // 완성된 그림의 주소. 없으면(샘플 기록) 앱에 든 샘플 그림을 보여 준다.
  imageUrl?: string | null;
  // 서버가 그림 (다시) 요청을 받아 줄 상태인지 (GET /home canRequestImage). 모르면 undefined.
  canRequestImage?: boolean;
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
