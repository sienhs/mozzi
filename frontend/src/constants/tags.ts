import type {
  CustomTagCategory,
  DiaryTag,
  PresetTag,
  TagCategory,
} from '@/types/diary';

// 무엇을·어디서·누구와 태그는 모두 서버의 내 아이콘(/my-icons)이다. 기본 태그(공부·집·가족 등)도
// 가입할 때 서버가 내 아이콘으로 만들어 두므로 앱에는 목록이 없고, 사용자가 지울 수도 있다.
// 날씨만 앱에 둔다. 서버 그림 요청의 weather 값(맑음·흐림·비·눈)과 같은 고정 목록이다.
const weatherCatalog: [code: string, label: string][] = [
  ['SUNNY', '맑음'],
  ['CLOUDY', '흐림'],
  ['RAINY', '비'],
  ['SNOWY', '눈'],
];

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
  // 서버 내 아이콘 규칙 (POST /my-icons): 이름 10자, 카테고리마다 30개. 기본 태그도 30개에 센다.
  maxLength: 10,
  maxPerCategory: 30,
};

export const presetTags: PresetTag[] = weatherCatalog.map(([code, label]) => ({
  id: `weather.${code.toLowerCase()}`,
  code,
  category: 'weather',
  label,
}));
const byId = new Map(presetTags.map(tag => [tag.id, tag]));
export const presetTag = (id: string) => byId.get(id);
export const presetTagsOf = (category: TagCategory) =>
  presetTags.filter(tag => tag.category === category);

// 카테고리 간 조합 제한 없이 자유롭게 선택한다.

// 개편 전 활동 8개 (공부·업무·운동·휴식·친구·취미·가족·기타). 지난 기록의 표시·검색용이다.
// 취미·기타는 새 체계에 대응이 없어 legacy 태그로 남긴다.
const legacyActivities: Record<string, CustomTagCategory | null> = {
  공부: 'activity',
  업무: 'activity',
  운동: 'activity',
  휴식: 'activity',
  친구: 'companion',
  가족: 'companion',
  취미: null,
  기타: null,
};
export const legacyActivityTag = (label: string): DiaryTag => ({
  category: legacyActivities[label] ?? 'legacy',
  code: null,
  label,
});
