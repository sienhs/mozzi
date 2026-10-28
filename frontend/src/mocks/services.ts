import { emotions } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import type {
  CustomTag,
  CustomTagCategory,
  DiaryEntry,
  DiaryTag,
  Emotion,
  GenerationRequest,
  SearchResult,
} from '@/types/diary';
import type { MochiId, PullItem } from '@/types/gacha';
import type { CompanionId } from '@/types/companion';
import { mochiOrder, mochis, tierOrder, tiers } from '@/constants/gacha';
import { DiaryGenerationError } from '@/services/diaryErrors';
import { tagKey } from '@/features/diary/tagRules';
import { useMockControls } from './controls';

export const mockDelay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));
export const mockAuthService = {
  async signIn() {
    const failed = useMockControls.getState().consumeFailure('login');
    await mockDelay(650);
    if (failed)
      throw new Error('로그인을 마치지 못했어요. 다시 시도해 주세요.');
    return { email: 'haru@gmail.com' };
  },
};
export const fallbackTitle = (emotion: Emotion) =>
  `${emotions[emotion].label} 모찌와 남긴 하루`;

// 서버 대신 쓰는 일기 Mock. 그림 요청(작성 중 기록 생성) → 그림 완성 대기 → 최종 저장 순서로,
// 서버 요청안(04 문서 B4·B5)과 같은 단계를 흉내 낸다. 그림은 실제로 그리지 않는다.
const RETRY_LIMIT = 3;
const retriesLeft = new Map<string, number>();
const requestedTags = new Map<string, DiaryTag[]>();
function draftEntry(
  request: GenerationRequest,
  tags: DiaryTag[],
  imageTags = tags,
): DiaryEntry {
  const id = `diary-${request.recordDate}`;
  retriesLeft.set(id, RETRY_LIMIT);
  requestedTags.set(id, imageTags);
  return {
    id,
    imageTags,
    date: request.recordDate,
    emotion: request.emotion,
    tags,
    memo: '',
    title: fallbackTitle(request.emotion),
    createdAt: new Date().toISOString(),
    generation: 'generating',
    status: 'draft',
    failure: null,
  };
}
export const mockDiaryService = {
  // POST /diaries — 작성 중 기록과 첫 그림 시도를 만든다.
  async start(
    request: GenerationRequest,
    tags: DiaryTag[],
    _requestKey: string,
    imageTags?: DiaryTag[],
  ): Promise<DiaryEntry> {
    const failed = useMockControls.getState().consumeFailure('start');
    await mockDelay(1000);
    if (failed)
      throw new Error('그림을 부탁하지 못했어요. 고른 태그는 그대로 있어요.');
    return draftEntry(request, tags, imageTags);
  },
  // 다시 작성하기: 재시도 불가 실패였던 기록을 새 기분·태그로 다시 그린다 (CONTRACT: B6).
  async rewrite(
    _id: string,
    request: GenerationRequest,
    tags: DiaryTag[],
    _requestKey: string,
    imageTags?: DiaryTag[],
  ): Promise<DiaryEntry> {
    const failed = useMockControls.getState().consumeFailure('start');
    await mockDelay(1000);
    if (failed)
      throw new Error('그림을 부탁하지 못했어요. 고른 태그는 그대로 있어요.');
    return draftEntry(request, tags, imageTags);
  },
  // GET /diaries/{id}/image 폴링 자리. 완성되면 끝나고, 실패하면 DiaryGenerationError를 던진다.
  async generate(
    context: string | { diaryId: string; companionId: CompanionId },
  ): Promise<void> {
    const id = typeof context === 'string' ? context : context.diaryId;
    const controls = useMockControls.getState();
    const blocked = controls.consumeFailure('generationBlocked');
    const failed = controls.consumeFailure('generation');
    await mockDelay(6000);
    const remainingRetries = retriesLeft.get(id) ?? RETRY_LIMIT;
    if (blocked)
      throw new DiaryGenerationError({
        code: 'CONTENT_BLOCKED',
        message: '이 내용으로는 그림을 그릴 수 없어요.',
        retryable: false,
        remainingRetries,
        blockedTags: (requestedTags.get(id) ?? []).filter(
          tag => !!tag.customTagId || tag.category === 'custom',
        ),
      });
    if (failed)
      throw new DiaryGenerationError({
        code: 'GENERATION_TIMEOUT',
        message: '그림을 완성하지 못했어요.',
        retryable: true,
        remainingRetries,
        blockedTags: [],
      });
  },
  // POST /diaries/{id}/image/retry — 같은 태그로 다시 그린다. 하루 횟수를 다 쓰면 거부한다.
  async retry(id: string, _requestKey: string): Promise<void> {
    const left = retriesLeft.get(id) ?? RETRY_LIMIT;
    if (left <= 0)
      throw new DiaryGenerationError({
        code: 'RETRY_LIMIT_EXCEEDED',
        message: '오늘은 그림을 더 그릴 수 없어요.',
        retryable: true,
        remainingRetries: 0,
        blockedTags: [],
      });
    retriesLeft.set(id, left - 1);
  },
  // POST /diaries/{id}/complete — 한 줄(선택)과 함께 기록을 완료한다 (CONTRACT: B4).
  async complete(
    _id: string,
    memo: string,
    _requestKey: string,
  ): Promise<{ memo: string }> {
    const failed = useMockControls.getState().consumeFailure('complete');
    await mockDelay(1000);
    if (failed)
      throw new Error('저장하지 못했어요. 적은 한 줄은 그대로 있어요.');
    return { memo: memo.trim() };
  },
};

// 계정별 내 태그 저장소 Mock (CONTRACT: B3 /members/me/tags). 같은 키면 새로 만들지 않고 기존 태그를 돌려준다.
let tagServer: CustomTag[] = [];
let tagSequence = 0;
export const mockTagService = {
  async list(): Promise<CustomTag[]> {
    await mockDelay(300);
    return tagServer.map(tag => ({ ...tag }));
  },
  async create(label: string, category: CustomTagCategory): Promise<CustomTag> {
    const failed = useMockControls.getState().consumeFailure('tag');
    await mockDelay(400);
    if (failed)
      throw new Error('태그를 저장하지 못했어요. 다시 시도해 주세요.');
    const key = tagKey(label);
    const existing = tagServer.find(
      tag => tag.category === category && tag.key === key,
    );
    if (existing) return { ...existing };
    tagSequence += 1;
    const tag = {
      id: `custom-${tagSequence}`,
      category,
      label,
      key,
      createdAt: new Date().toISOString(),
    };
    tagServer = [...tagServer, tag];
    return { ...tag };
  },
  async remove(id: string): Promise<void> {
    await mockDelay(300);
    tagServer = tagServer.filter(tag => tag.id !== id);
  },
  // Mock 전용: 서버가 없으니 계정이 바뀌면 저장소를 비운다. 실제 서버는 회원별로 따로 보관한다.
  reset() {
    tagServer = [];
  },
};

// Local, deterministic keyword search. This deliberately does not pretend to call an AI.
// 작성 중(저장 전) 기록은 검색하지 않는다.
export function searchMockEntries(
  question: string,
  allEntries: DiaryEntry[],
): SearchResult {
  const entries = allEntries.filter(entry => entry.status === 'completed');
  const query = question.trim();
  const synonyms: Record<Emotion, string[]> = {
    happy: ['행복', '기뻤', '기쁜', '즐거'],
    calm: ['평온', '편했', '편안', '편했던'],
    neutral: ['보통', '평범'],
    sad: ['우울', '슬펐', '슬픈', '힘들'],
    angry: ['화남', '화났', '화난', '짜증'],
  };
  const emotion = (Object.keys(synonyms) as Emotion[]).find(id =>
    synonyms[id].some(word => query.includes(word)),
  );
  // 긴 라벨부터 찾는다 ('산책'이 '산'보다 먼저).
  const activity = [
    ...new Set(entries.flatMap(entry => entry.tags.map(tag => tag.label))),
  ]
    .sort((a, b) => b.length - a.length)
    .find(label => query.includes(label));
  const labelsOf = (entry: DiaryEntry) => entry.tags.map(tag => tag.label);
  const currentMonth = todayKey().slice(0, 7);
  const monthMatch = query.match(/(\d{1,2})월/);
  const inPeriod = entries.filter(entry => {
    if (query.includes('이번 달')) return entry.date.startsWith(currentMonth);
    if (monthMatch)
      return Number(entry.date.slice(5, 7)) === Number(monthMatch[1]);
    return true;
  });
  const summary = /어떤 기분|많았|많이/.test(query);
  const matches = inPeriod
    .filter(entry => {
      if (emotion) return entry.emotion === emotion;
      if (activity) return labelsOf(entry).includes(activity);
      if (summary) return true;
      return [
        entry.memo,
        entry.title,
        ...labelsOf(entry),
        emotions[entry.emotion].label,
      ].some(text => text.includes(query));
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!matches.length) return { answer: '', entries: [] };
  const counts = matches.reduce<Partial<Record<Emotion, number>>>(
    (result, entry) => {
      result[entry.emotion] = (result[entry.emotion] ?? 0) + 1;
      return result;
    },
    {},
  );
  const most = (Object.keys(counts) as Emotion[]).sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0),
  )[0];
  const answer = summary
    ? `${query.includes('이번 달') ? '이번 달에는' : '남긴 기록에는'} ${emotions[most].label} 모찌가 ${counts[most]}일로 가장 많았어요.`
    : emotion
      ? `${emotions[emotion].label} 모찌를 고른 날이 ${matches.length}일 있었어요.`
      : `${activity ? `${activity}와 함께한` : '찾으시는'} 기록이 ${matches.length}개 있어요.`;
  const tags = [...new Set(matches.flatMap(labelsOf))].slice(0, 2);
  return {
    answer: `${answer}\n${tags.join('과 ')} 기록이 함께였어요.`,
    entries: matches,
  };
}
export const mockSearchService = {
  async search(question: string, entries: DiaryEntry[]) {
    const failed = useMockControls.getState().consumeFailure('search');
    await mockDelay(700);
    if (failed)
      throw new Error('연결이 잠시 불안정해요. 한 번 더 물어봐 주세요.');
    return searchMockEntries(question, entries);
  },
};

// Rolls tiers with the P-05 odds. 전설·신화 prefer unowned mochi, as the sheet promises.
export function rollMochi(
  count: number,
  owned: MochiId[],
  random: () => number = Math.random,
): PullItem[] {
  const have = new Set(owned);
  return Array.from({ length: count }, () => {
    let roll = random() * 100;
    const tier = tierOrder.find(id => (roll -= tiers[id].odds) < 0) ?? 'common';
    const pool = mochiOrder.filter(id => mochis[id].tier === tier);
    const fresh = pool.filter(id => !have.has(id));
    const candidates =
      (tier === 'legend' || tier === 'myth') && fresh.length ? fresh : pool;
    const id = candidates[Math.floor(random() * candidates.length)];
    const isNew = !have.has(id);
    have.add(id);
    return { id, isNew, shards: isNew ? 0 : tiers[tier].duplicateShards };
  });
}
export const mockGachaService = {
  async pull(count: number, owned: MochiId[]): Promise<PullItem[]> {
    const failed = useMockControls.getState().consumeFailure('gacha');
    await mockDelay(600);
    if (failed) throw new Error('뽑기권은 사용되지 않았어요.');
    return rollMochi(count, owned);
  },
  async exchange(id: MochiId): Promise<MochiId> {
    await mockDelay(500);
    return id;
  },
};

// Local demo only: no equip or character-generation endpoint exists in the API contract.
export const mockEquipmentService = {
  async equip(id: CompanionId): Promise<CompanionId> {
    const failed = useMockControls.getState().consumeFailure('equip');
    await mockDelay(450);
    if (failed)
      throw new Error('모찌를 장착하지 못했어요. 다시 시도해 주세요.');
    return id;
  },
};
