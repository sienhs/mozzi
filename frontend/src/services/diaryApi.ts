import { isAxiosError } from 'axios';
import {
  invalidResponse,
  parseDiaryDetail,
  parseHome,
  parseMonthly,
  parseSummary,
  type DiaryDetail,
  type DiarySummary,
  type HomeResponse,
  type ImageRequestBody,
  type MonthlyItem,
  type ServerEmotion,
} from '@/types/server';
import { api } from './api';
import { AuthError, errorBody, errorCode } from './authErrors';
import { parseReward, type Reward } from './rewardApi';

// 일기·그림 API (backend docs/api/diary.md, home.md). 화면과 스토어는 이 파일만 부른다.
// 일기 생성 → 그림 요청 순서이고, 그림 결과는 GET /home·/diaries/daily의 image로 확인한다(SSE 없음).
export const DIARY_IMAGE_ONLY_TODAY = 'IMAGE_ONLY_TODAY';
export const DIARY_IMAGE_ALREADY_REQUESTED = 'IMAGE_ALREADY_REQUESTED';

// 한 줄 일기는 비어 있는 일기에 한 번만 넣는다. 이미 다른 한 줄이 있으면 409.
export const DIARY_CONTENT_ALREADY_WRITTEN = 'DIARY_CONTENT_ALREADY_WRITTEN';

// TanStack Query 키. 회원 ID를 넣어 계정이 바뀌면 다른 캐시를 쓰게 한다(로그아웃 때는 queryClient.clear).
export const diaryKeys = {
  all: (memberId: number) => ['diary', memberId] as const,
  home: (memberId: number) => ['diary', memberId, 'home'] as const,
  daily: (memberId: number, date: string) =>
    ['diary', memberId, 'daily', date] as const,
  monthly: (memberId: number, yearMonth: string) =>
    ['diary', memberId, 'monthly', yearMonth] as const,
  list: (memberId: number) => ['diary', memberId, 'list'] as const,
};

export class DiaryExistsError extends AuthError {
  constructor(
    readonly diaryId: number,
    message: string,
  ) {
    super('DIARY_ALREADY_EXISTS', message);
  }
}

let emoticons: Promise<Record<ServerEmotion, number>> | null = null;
async function loadEmoticons() {
  const { data } = await api.get('/emoticons');
  if (!Array.isArray(data?.items)) throw invalidResponse();
  const ids: Partial<Record<ServerEmotion, number>> = {};
  for (const item of data.items)
    if (
      Number.isSafeInteger(item?.emoticonId) &&
      typeof item?.emotion === 'string'
    )
      ids[item.emotion as ServerEmotion] = item.emoticonId;
  return ids as Record<ServerEmotion, number>;
}

export const diaryApi = {
  // 감정 → 이모티콘 ID. 서버가 미리 등록한 고정 값이라 한 번만 받는다(실패하면 다음에 다시 받는다).
  async emoticonId(emotion: ServerEmotion): Promise<number> {
    emoticons ??= loadEmoticons();
    let ids: Record<ServerEmotion, number>;
    try {
      ids = await emoticons;
    } catch (error) {
      emoticons = null;
      throw error;
    }
    const id = ids[emotion];
    if (!id) {
      emoticons = null;
      throw invalidResponse();
    }
    return id;
  },
  forgetEmoticons() {
    emoticons = null;
  },
  // POST /diaries. 날짜는 서버가 오늘로 정한다. 이미 있으면 DiaryExistsError(diaryId 포함).
  async create(
    body: { emoticonId: number; content: string | null; myIconIds: number[] },
    requestKey: string,
  ): Promise<{ diaryId: number; recordDate: string; reward: Reward | null }> {
    try {
      const { data } = await api.post('/diaries', body, {
        headers: { 'Idempotency-Key': requestKey },
      });
      if (
        !Number.isSafeInteger(data?.diaryId) ||
        typeof data?.recordDate !== 'string'
      )
        throw invalidResponse();
      return {
        diaryId: data.diaryId,
        recordDate: data.recordDate,
        // 그날 첫 일기면 뽑기권 보상이 함께 온다. 같은 키로 다시 보내면 첫 응답(보상 포함)이 그대로 온다.
        reward: parseReward(data.reward),
      };
    } catch (error) {
      const conflict = isAxiosError(error) ? error.response?.data : undefined;
      if (
        errorCode(error) === 'DIARY_ALREADY_EXISTS' &&
        Number.isSafeInteger(conflict?.diaryId)
      )
        throw new DiaryExistsError(
          conflict.diaryId,
          errorBody(error)?.message ?? '오늘은 이미 기록을 남겼어요.',
        );
      throw error;
    }
  },
  // POST /diaries/{id}/image. 202면 접수(PENDING). 결과는 조회로 확인한다.
  async requestImage(
    diaryId: number,
    body: ImageRequestBody,
    requestKey: string,
  ): Promise<void> {
    await api.post(`/diaries/${diaryId}/image`, body, {
      headers: { 'Idempotency-Key': requestKey },
    });
  },
  async home(): Promise<HomeResponse> {
    const { data } = await api.get('/home');
    return parseHome(data);
  },
  // 그 날짜에 일기가 없으면 null.
  async daily(date: string): Promise<DiaryDetail | null> {
    try {
      const { data } = await api.get('/diaries/daily', { params: { date } });
      return parseDiaryDetail(data);
    } catch (error) {
      if (errorCode(error) === 'NOT_FOUND') return null;
      throw error;
    }
  },
  // GET /diaries 한 페이지(최신순). 홈에서 옆으로 밀어 지난 기록을 넘겨 볼 때 쓴다.
  async page(
    cursor: string | null,
    size = 10,
  ): Promise<{ items: DiarySummary[]; nextCursor: string | null }> {
    const { data } = await api.get('/diaries', {
      params: cursor ? { cursor, size } : { size },
    });
    if (
      !Array.isArray(data?.items) ||
      (data.nextCursor != null && typeof data.nextCursor !== 'string')
    )
      throw invalidResponse();
    return {
      items: data.items.map(parseSummary),
      nextCursor: data.nextCursor ?? null,
    };
  },
  // GET /diaries/monthly. 캘린더용으로 일기를 쓴 날의 감정만 준다. yearMonth는 YYYY-MM.
  async monthly(yearMonth: string): Promise<MonthlyItem[]> {
    const { data } = await api.get('/diaries/monthly', {
      params: { yearMonth },
    });
    return parseMonthly(data, yearMonth);
  },
  // PATCH /diaries/{id}/content. 그림을 본 뒤 쓴 한 줄을 넣는다(최대 50자, 빈 값은 400).
  // 같은 내용을 다시 보내면 200이라 응답을 못 받았을 때 그대로 다시 보내도 된다.
  async saveContent(diaryId: number, content: string): Promise<string> {
    const { data } = await api.patch(`/diaries/${diaryId}/content`, {
      content,
    });
    if (data?.diaryId !== diaryId || typeof data?.content !== 'string')
      throw invalidResponse();
    return data.content;
  },
};
