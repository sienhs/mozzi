import type { DiaryTag, PresetTag, TagCategory } from '@/types/diary';

// 기본 태그 목록 (일기 생성 개편 설계 §5-1 제안). 최종 목록·표시명은 기획·디자인에서 정한다.
// CONTRACT: B2 — 서버 GET /meta가 생기면 이 상수 대신 서버 값을 쓰고, 상수는 실패 시 대체값으로 남긴다.
// 지금 AI 규칙(prompt_rules.yaml v1)에 없는 태그도 들어 있다. 프롬프트 규칙 추가는 AI 쪽 요청(AI-1)이다.
const catalog: Record<TagCategory, [code: string, label: string][]> = {
  activity: [
    ['STUDYING', '공부'],
    ['WORK', '일하기'],
    ['EXERCISE', '운동'],
    ['WALK', '산책'],
    ['RESTING', '휴식'],
    ['NAP', '낮잠'],
    ['EATING', '식사'],
    ['COOKING', '요리'],
    ['BAKING', '베이킹'],
    ['CLEANING', '청소'],
    ['LAUNDRY', '빨래'],
    ['SHOPPING', '쇼핑'],
    ['READING', '독서'],
    ['WRITING', '글쓰기'],
    ['DRAWING', '그림 그리기'],
    ['MUSIC', '음악 듣기'],
    ['MOVIE', '영화 보기'],
    ['GAMING', '게임'],
    ['PHOTO', '사진 찍기'],
    ['CHATTING', '수다 떨기'],
    ['GARDENING', '식물 가꾸기'],
    ['SHOW', '공연·전시'],
    ['HIKING', '등산'],
    ['TRAVELING', '여행'],
    ['COMMUTE', '출퇴근·이동'],
  ],
  place: [
    ['HOME', '집'],
    ['CAFE', '카페'],
    ['OFFICE', '회사'],
    ['SCHOOL', '학교'],
    ['LIBRARY', '도서관'],
    ['RESTAURANT', '식당'],
    ['PARK', '공원'],
    ['NEIGHBORHOOD', '동네'],
    ['BEACH', '바다'],
    ['MOUNTAIN', '산'],
    ['TRAVEL_SPOT', '여행지'],
  ],
  companion: [
    ['FRIEND', '친구'],
    ['FAMILY', '가족'],
    ['PARTNER', '연인'],
    ['COWORKER', '동료'],
    ['CHILD', '아이'],
    ['PUPPY', '강아지'],
    ['KITTEN', '고양이'],
    ['BUNNY', '토끼'],
    ['HAMSTER', '햄스터'],
  ],
  weather: [
    ['SUNNY', '맑음'],
    ['CLOUDY', '흐림'],
    ['RAINY', '비'],
    ['SNOWY', '눈'],
    ['WINDY', '바람'],
    ['FOGGY', '안개'],
  ],
};

export const tagCategoryOrder: TagCategory[] = [
  'activity',
  'place',
  'companion',
  'weather',
];
// 개수 범위는 AI 규격(활동 1~3, 첫 번째가 메인 · 동행 최대 2)에 맞춘다. 날씨는 선택이고 없으면 맑음.
export const tagCategories: Record<
  TagCategory,
  { title: string; limit?: string; single: boolean; min: number; max: number }
> = {
  activity: {
    title: '무엇을 했나요',
    limit: '3개까지',
    single: false,
    min: 1,
    max: 3,
  },
  place: { title: '어디서', single: true, min: 0, max: 1 },
  companion: {
    title: '누구와',
    limit: '2명까지',
    single: false,
    min: 0,
    max: 2,
  },
  weather: { title: '날씨', single: true, min: 0, max: 1 },
};
export const customTagLimits = {
  title: '내 태그',
  limit: '3개까지',
  // 이번 기록에서 고를 수 있는 수.
  maxSelected: 3,
  // 라벨 길이(글자 수)와 계정당 개수. 서버 상한이 정해지면 맞춘다 (CONTRACT: B3).
  maxLength: 10,
  maxSaved: 20,
};

export const presetTags: PresetTag[] = tagCategoryOrder.flatMap(category =>
  catalog[category].map(([code, label]) => ({
    id: `${category}.${code.toLowerCase()}`,
    code,
    category,
    label,
  })),
);
const byId = new Map(presetTags.map(tag => [tag.id, tag]));
export const presetTag = (id: string) => byId.get(id);
export const presetTagsOf = (category: TagCategory) =>
  presetTags.filter(tag => tag.category === category);

// 카테고리 간 조합 제한 없이 자유롭게 선택한다.

// 개편 전 활동 8개 (공부·업무·운동·휴식·친구·취미·가족·기타). 지난 기록의 표시·검색용이다.
// 취미·기타는 새 체계에 대응이 없어 legacy 태그로 남긴다.
const legacyActivities: Record<string, string | null> = {
  공부: 'activity.studying',
  업무: 'activity.work',
  운동: 'activity.exercise',
  휴식: 'activity.resting',
  친구: 'companion.friend',
  가족: 'companion.family',
  취미: null,
  기타: null,
};
export function legacyActivityTag(label: string): DiaryTag {
  const tag = legacyActivities[label]
    ? presetTag(legacyActivities[label]!)
    : null;
  return tag
    ? { category: tag.category, code: tag.code, label: tag.label }
    : { category: 'legacy', code: null, label };
}
