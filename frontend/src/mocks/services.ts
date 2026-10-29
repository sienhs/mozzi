import { emotions } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import type { DiaryEntry, Emotion, SearchResult } from '@/types/diary';
import type { MochiId, PullItem } from '@/types/gacha';
import type { CompanionId } from '@/types/companion';
import { mochiOrder, mochis, tierOrder, tiers } from '@/constants/gacha';
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
  async equip(
    emotion: Emotion,
    id: CompanionId,
  ): Promise<{ emotion: Emotion; companionId: CompanionId }> {
    const failed = useMockControls.getState().consumeFailure('equip');
    await mockDelay(450);
    if (failed)
      throw new Error('모찌를 장착하지 못했어요. 다시 시도해 주세요.');
    return { emotion, companionId: id };
  },
};
