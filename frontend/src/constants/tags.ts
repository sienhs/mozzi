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
// 기본·커스텀을 합쳐 활동 1~3개·장소 최대 1개·동행 최대 2개. 날씨는 선택 사항이다.
export const tagCategories: Record<
  TagCategory,
  { title: string; limit?: string; single: boolean; min: number; max: number }
> = {
  activity: {
    title: '무엇을',
    limit: '3개까지',
    single: false,
    min: 1,
    max: 3,
  },
  place: { title: '어디서', limit: '1개까지', single: true, min: 0, max: 1 },
  companion: {
    title: '누구와',
    limit: '2명까지',
    single: false,
    min: 0,
    max: 2,
  },
  weather: { title: '날씨', limit: '선택', single: true, min: 0, max: 1 },
};
export const customTagLimits = {
  // 서버 내 아이콘 규칙 (POST /my-icons): 이름 10자, 카테고리마다 30개.
  // 서버에는 기본 태그가 없어 기본 태그를 고르면 같은 이름의 아이콘을 만들고, 그것도 30개에 센다.
  maxLength: 10,
  maxPerCategory: 30,
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
