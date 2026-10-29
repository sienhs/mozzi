import { emotions } from '@/constants/emotions';
import { presetTags } from '@/constants/tags';
import type { ImageRequestSnapshot } from '@/services/imageRequests';
import { tagCategoryOf } from '@/services/tagGateway';
import type {
  DiaryEntry,
  DiaryTag,
  Emotion,
  GenerationStatus,
} from '@/types/diary';
import type {
  DiaryDetail,
  IconCategory,
  ImageStatus,
  MyIcon,
  ServerEmotion,
  ServerWeather,
} from '@/types/server';
import { tagKey } from './tagRules';

// 서버 일기(DiaryDetail)를 화면 공통 모델(DiaryEntry)로 바꾼다. 홈·상세·생성 화면이 같은 변환을 쓴다.
//
// 필드 대응
//   diaryId → id(문자열)·serverId · recordDate → date · emotion(HAPPY) → emotion(happy)
//   content → memo·title(없으면 감정 기본 제목) · myIcons WHAT/WHERE/WHO → tags activity/place/companion
//   image null → notRequested · PENDING → generating · SUCCEEDED → ready(imageUrl) · FAILED → failed
//   imageTags·companionId → 서버에 없다. 그림 요청 때 앱이 보관한 스냅샷에서 온다.
export const toAppEmotion = (emotion: ServerEmotion) =>
  emotion.toLowerCase() as Emotion;
export const toServerEmotion = (emotion: Emotion) =>
  emotion.toUpperCase() as ServerEmotion;
export const fallbackTitle = (emotion: Emotion) =>
  `${emotions[emotion].label} 모찌와 남긴 하루`;
// 서버 날씨는 맑음·흐림·비·눈뿐이다. 바람·안개는 대응 값이 없어 '입력 안 함'으로 보낸다.
const weathers: ServerWeather[] = ['SUNNY', 'CLOUDY', 'RAINY', 'SNOWY'];
export const toServerWeather = (code: string | null): ServerWeather =>
  weathers.includes(code as ServerWeather) ? (code as ServerWeather) : 'NONE';

// 기본 태그와 같은 이름의 아이콘은 기본 태그로 보여 준다 (useTagStore와 같은 규칙).
export function iconTag(icon: MyIcon): DiaryTag {
  const category = tagCategoryOf[icon.category];
  const preset = presetTags.find(
    tag => tag.category === category && tagKey(tag.label) === tagKey(icon.name),
  );
  return preset
    ? { category, code: preset.code, label: preset.label }
    : {
        category,
        code: null,
        label: icon.name,
        customTagId: String(icon.myIconId),
      };
}
const iconOrder: IconCategory[] = ['WHAT', 'WHERE', 'WHO'];
const generationOf = (status: ImageStatus | undefined): GenerationStatus =>
  status === 'PENDING'
    ? 'generating'
    : status === 'SUCCEEDED'
      ? 'ready'
      : status === 'FAILED'
        ? 'failed'
        : 'notRequested';

export function toDiaryEntry(
  detail: DiaryDetail,
  context: {
    today: string;
    canRequestImage?: boolean;
    snapshot?: ImageRequestSnapshot | null;
  },
): DiaryEntry {
  const emotion = toAppEmotion(detail.emotion);
  const generation = generationOf(detail.image?.status);
  const isToday = detail.recordDate === context.today;
  // 그림을 다시 요청할 수 있는지는 서버 판단을 따른다. 지난 기록은 요청할 수 없다.
  const canRequestImage = isToday ? context.canRequestImage : false;
  const snapshot =
    context.snapshot?.diaryId === detail.diaryId ? context.snapshot : null;
  return {
    id: String(detail.diaryId),
    serverId: detail.diaryId,
    date: detail.recordDate,
    emotion,
    tags: iconOrder.flatMap(category => detail.myIcons[category].map(iconTag)),
    imageTags: snapshot?.imageTags,
    companionId: snapshot?.companionId,
    memo: detail.content ?? '',
    title: detail.content ?? fallbackTitle(emotion),
    createdAt: detail.createdAt,
    generation,
    imageUrl: detail.image?.imageUrl ?? null,
    canRequestImage,
    // 한 줄이 아직 없는 오늘 기록만 작성 중이다. 지난 기록은 더 고칠 수 없으니 남은 그대로 완료로 본다.
    status: isToday && detail.content === null ? 'draft' : 'completed',
    // 서버는 FAILED만 알려 준다(유해 판정 여부는 푸시에만 있다). 다시 그릴 수 있는지는 canRequestImage로 정한다.
    failure:
      generation === 'failed'
        ? {
            code: 'IMAGE_FAILED',
            message: '그림을 완성하지 못했어요.',
            retryable: true,
            remainingRetries: canRequestImage ? 1 : 0,
            blockedTags: [],
          }
        : null,
  };
}
