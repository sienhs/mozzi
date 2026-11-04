import { AuthError } from '@/services/authErrors';

// 서버 응답 그대로의 모양 (backend docs/api). 화면은 이 타입을 직접 쓰지 않고 features/diary/serverDiary.ts에서 DiaryEntry로 바꾼다.
export type ServerEmotion = 'HAPPY' | 'CALM' | 'NEUTRAL' | 'SAD' | 'ANGRY';
export type IconCategory = 'WHERE' | 'WHO' | 'WHAT';
export type ImageStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type TodayStatus =
  | 'NOT_RECORDED'
  | 'IMAGE_NOT_REQUESTED'
  | 'IMAGE_PENDING'
  | 'COMPLETED'
  | 'IMAGE_FAILED';
export type ServerWeather = 'NONE' | 'SUNNY' | 'CLOUDY' | 'RAINY' | 'SNOWY';
export type TermsType = 'TERMS' | 'PRIVACY';

export interface MyIcon {
  myIconId: number;
  name: string;
  category: IconCategory;
  createdAt: string;
}
export interface DiaryImage {
  status: ImageStatus;
  // SUCCEEDED일 때만 값이 있다.
  imageUrl: string | null;
}
export interface DiaryDetail {
  diaryId: number;
  recordDate: string;
  emoticonId: number;
  emotion: ServerEmotion;
  content: string | null;
  myIcons: Record<IconCategory, MyIcon[]>;
  // 그림을 요청하기 전이면 null.
  image: DiaryImage | null;
  createdAt: string;
  updatedAt: string;
}
export interface HomeResponse {
  today: string;
  todayStatus: TodayStatus;
  todayDiary: DiaryDetail | null;
  canRequestImage: boolean;
  recentDiary: DiaryDetail | null;
}
// 목록·검색 결과의 일기 한 줄 (DiarySummary). 아이콘은 오지 않는다.
export interface DiarySummary {
  diaryId: number;
  recordDate: string;
  emotion: ServerEmotion;
  content: string | null;
  image: DiaryImage | null;
}
export type SearchResultType = 'FOUND' | 'EMPTY' | 'STATS_ONLY';
// POST /emotion-search (backend docs/api/emotion-search.md).
export interface SearchResponse {
  question: string;
  resultType: SearchResultType;
  // EMPTY면 null.
  answer: string | null;
  // STATS_ONLY일 때만 감정별 날 수가 온다.
  emotionCounts: { emotion: ServerEmotion; count: number }[];
  // 큰 카드 1장. FOUND일 때만 있다.
  featured: DiaryDetail | null;
  diaries: DiarySummary[];
  // 서버가 질문을 해석한 조건. 화면에 "이렇게 찾았어요"로 보여 준다. 형식이 어긋나면 null(답은 그대로 쓴다).
  filter: SearchFilter | null;
  // 조건에 맞은 기록 수. 없으면 null.
  matchedCount: number | null;
}
export interface SearchFilter {
  from: string | null;
  to: string | null;
  emotions: ServerEmotion[];
  keyword: string | null;
}
// GET /diaries/monthly의 한 칸. 일기를 쓴 날만 온다(한 줄·그림은 없다).
export interface MonthlyItem {
  diaryId: number;
  recordDate: string;
  emotion: ServerEmotion;
}
export interface MetaResponse {
  termsVersions: Record<TermsType, string>;
  minSupportedVersion: string;
  latestVersion: string;
}
// 그림 요청 본문 (POST /diaries/{id}/image).
export interface ImageRequestBody {
  weather: ServerWeather;
  whereMyIconId: number | null;
  whoMyIconId: number | null;
  whatMyIconId: number;
}

export const iconCategories: IconCategory[] = ['WHAT', 'WHERE', 'WHO'];
const emotions: ServerEmotion[] = ['HAPPY', 'CALM', 'NEUTRAL', 'SAD', 'ANGRY'];
const imageStatuses: ImageStatus[] = ['PENDING', 'SUCCEEDED', 'FAILED'];
const todayStatuses: TodayStatus[] = [
  'NOT_RECORDED',
  'IMAGE_NOT_REQUESTED',
  'IMAGE_PENDING',
  'COMPLETED',
  'IMAGE_FAILED',
];
// major.minor.patch, 앞자리 0 없음 (backend AppVersionProperties.SEMVER).
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const invalidResponse = () =>
  new AuthError(
    'INVALID_RESPONSE',
    '서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  );
type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && DATE.test(value);
const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const oneOf = <T extends string>(values: T[], value: unknown): value is T =>
  values.includes(value as T);

export function parseMyIcon(value: unknown): MyIcon {
  if (
    !isObject(value) ||
    !isId(value.myIconId) ||
    typeof value.name !== 'string' ||
    !oneOf(iconCategories, value.category) ||
    !isInstant(value.createdAt)
  )
    throw invalidResponse();
  return {
    myIconId: value.myIconId,
    name: value.name,
    category: value.category,
    createdAt: value.createdAt,
  };
}
export function parseMyIconList(value: unknown): MyIcon[] {
  if (!isObject(value) || !Array.isArray(value.items)) throw invalidResponse();
  return value.items.map(parseMyIcon);
}
function parseImage(value: unknown): DiaryImage | null {
  if (value === null) return null;
  if (
    !isObject(value) ||
    !oneOf(imageStatuses, value.status) ||
    (value.imageUrl !== null && typeof value.imageUrl !== 'string') ||
    // 완성된 그림에는 주소가 있어야 한다. 없으면 고정 샘플로 대신하지 않고 응답 오류로 본다.
    (value.status === 'SUCCEEDED' && !value.imageUrl)
  )
    throw invalidResponse();
  return {
    status: value.status,
    imageUrl: value.status === 'SUCCEEDED' ? (value.imageUrl as string) : null,
  };
}
export function parseDiaryDetail(value: unknown): DiaryDetail {
  if (
    !isObject(value) ||
    !isId(value.diaryId) ||
    !isDate(value.recordDate) ||
    !isId(value.emoticonId) ||
    !oneOf(emotions, value.emotion) ||
    (value.content !== null && typeof value.content !== 'string') ||
    !isObject(value.myIcons) ||
    !isInstant(value.createdAt) ||
    !isInstant(value.updatedAt)
  )
    throw invalidResponse();
  const icons = value.myIcons;
  const myIcons = Object.fromEntries(
    iconCategories.map(category => {
      const list = icons[category];
      if (!Array.isArray(list)) throw invalidResponse();
      return [category, list.map(parseMyIcon)];
    }),
  ) as Record<IconCategory, MyIcon[]>;
  return {
    diaryId: value.diaryId,
    recordDate: value.recordDate,
    emoticonId: value.emoticonId,
    emotion: value.emotion,
    content: value.content as string | null,
    myIcons,
    image: parseImage(value.image),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
export function parseHome(value: unknown): HomeResponse {
  if (
    !isObject(value) ||
    !isDate(value.today) ||
    !oneOf(todayStatuses, value.todayStatus) ||
    typeof value.canRequestImage !== 'boolean'
  )
    throw invalidResponse();
  const todayDiary =
    value.todayDiary === null ? null : parseDiaryDetail(value.todayDiary);
  const recentDiary =
    value.recentDiary === null ? null : parseDiaryDetail(value.recentDiary);
  // 상태와 오늘 일기가 서로 맞지 않으면 어느 화면을 그릴지 정할 수 없다.
  if ((value.todayStatus === 'NOT_RECORDED') !== (todayDiary === null))
    throw invalidResponse();
  if (todayDiary && todayDiary.recordDate !== value.today)
    throw invalidResponse();
  return {
    today: value.today,
    todayStatus: value.todayStatus,
    todayDiary,
    canRequestImage: value.canRequestImage,
    recentDiary,
  };
}
export function parseSummary(value: unknown): DiarySummary {
  if (
    !isObject(value) ||
    !isId(value.diaryId) ||
    !isDate(value.recordDate) ||
    !oneOf(emotions, value.emotion) ||
    (value.content !== null && typeof value.content !== 'string')
  )
    throw invalidResponse();
  return {
    diaryId: value.diaryId,
    recordDate: value.recordDate,
    emotion: value.emotion,
    content: value.content as string | null,
    image: parseImage(value.image),
  };
}
const resultTypes: SearchResultType[] = ['FOUND', 'EMPTY', 'STATS_ONLY'];
// 해석 조건은 보여 주기만 하므로 어긋나도 응답 전체를 버리지 않는다.
function parseFilter(value: unknown): SearchFilter | null {
  if (!isObject(value)) return null;
  const date = (item: unknown) => (isDate(item) ? item : null);
  const list = Array.isArray(value.emotions) ? value.emotions : [];
  return {
    from: date(value.from),
    to: date(value.to),
    emotions: list.filter((item): item is ServerEmotion =>
      oneOf(emotions, item),
    ),
    keyword:
      typeof value.keyword === 'string' && value.keyword.trim()
        ? value.keyword.trim()
        : null,
  };
}
export function parseSearch(value: unknown): SearchResponse {
  if (
    !isObject(value) ||
    typeof value.question !== 'string' ||
    !oneOf(resultTypes, value.resultType) ||
    (value.answer !== null && typeof value.answer !== 'string') ||
    !Array.isArray(value.diaries)
  )
    throw invalidResponse();
  const stats = isObject(value.stats) ? value.stats : {};
  const counts = Array.isArray(stats.emotionCounts) ? stats.emotionCounts : [];
  const emotionCounts = counts.map(item => {
    if (
      !isObject(item) ||
      !oneOf(emotions, item.emotion) ||
      !Number.isSafeInteger(item.count)
    )
      throw invalidResponse();
    return { emotion: item.emotion, count: item.count as number };
  });
  const featured =
    value.featured === null || value.featured === undefined
      ? null
      : parseDiaryDetail(value.featured);
  // 결과가 있다는데 보여 줄 기록이나 답이 없으면 화면을 그릴 수 없다.
  if (value.resultType === 'FOUND' && (!featured || !value.answer))
    throw invalidResponse();
  if (value.resultType === 'STATS_ONLY' && !value.answer)
    throw invalidResponse();
  return {
    question: value.question,
    resultType: value.resultType,
    answer: value.resultType === 'EMPTY' ? null : (value.answer as string),
    emotionCounts,
    featured: value.resultType === 'FOUND' ? featured : null,
    diaries:
      value.resultType === 'FOUND' ? value.diaries.map(parseSummary) : [],
    filter: parseFilter(value.interpretedFilter),
    matchedCount: Number.isSafeInteger(stats.matchedCount)
      ? (stats.matchedCount as number)
      : null,
  };
}
export function parseSuggestions(value: unknown): string[] {
  if (
    !isObject(value) ||
    !Array.isArray(value.suggestions) ||
    value.suggestions.some(item => typeof item !== 'string' || !item.trim())
  )
    throw invalidResponse();
  return value.suggestions as string[];
}
export function parseMonthly(value: unknown, yearMonth: string): MonthlyItem[] {
  if (
    !isObject(value) ||
    value.yearMonth !== yearMonth ||
    !Array.isArray(value.items)
  )
    throw invalidResponse();
  return value.items.map(item => {
    if (
      !isObject(item) ||
      !isId(item.diaryId) ||
      !isDate(item.recordDate) ||
      !item.recordDate.startsWith(`${yearMonth}-`) ||
      !oneOf(emotions, item.emotion)
    )
      throw invalidResponse();
    return {
      diaryId: item.diaryId,
      recordDate: item.recordDate,
      emotion: item.emotion,
    };
  });
}
export function parseMeta(value: unknown): MetaResponse {
  if (
    !isObject(value) ||
    !isObject(value.termsVersions) ||
    typeof value.minSupportedVersion !== 'string' ||
    typeof value.latestVersion !== 'string' ||
    !SEMVER.test(value.minSupportedVersion) ||
    !SEMVER.test(value.latestVersion)
  )
    throw invalidResponse();
  const versions = value.termsVersions;
  const version = (type: TermsType) => {
    const found = versions[type];
    // 버전이 빠졌으면 어떤 본문에 동의하는지 알 수 없다. 기본값으로 채우지 않는다.
    if (typeof found !== 'string' || !found.trim()) throw invalidResponse();
    return found;
  };
  return {
    termsVersions: { TERMS: version('TERMS'), PRIVACY: version('PRIVACY') },
    minSupportedVersion: value.minSupportedVersion,
    latestVersion: value.latestVersion,
  };
}
