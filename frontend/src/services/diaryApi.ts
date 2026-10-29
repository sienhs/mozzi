import { isAxiosError } from 'axios';
import {
  invalidResponse,
  parseDiaryDetail,
  parseHome,
  parseMonthly,
  type DiaryDetail,
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

// 그림 요청의 필수값 characterId. 서버는 이 값을 저장만 하고, 그림에는 그 감정에 고른 모찌
// (PUT /members/me/mozzis)를 그린다. 그래서 고정값을 보낸다.
export const PROVISIONAL_CHARACTER_ID = 1;

// 그림 뒤에 쓰는 한 줄을 저장할 API가 아직 없다 (일기 수정 API 없음, 백엔드 추가 예정).
// 생기기 전까지 저장 버튼은 막고, 성공한 것처럼 처리하지 않는다.
export const CONTENT_SAVE_SUPPORTED = false;

// TanStack Query 키. 회원 ID를 넣어 계정이 바뀌면 다른 캐시를 쓰게 한다(로그아웃 때는 queryClient.clear).
export const diaryKeys = {
  all: (memberId: number) => ['diary', memberId] as const,
  home: (memberId: number) => ['diary', memberId, 'home'] as const,
  daily: (memberId: number, date: string) =>
    ['diary', memberId, 'daily', date] as const,
  monthly: (memberId: number, yearMonth: string) =>
    ['diary', memberId, 'monthly', yearMonth] as const,
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
  // GET /diaries/monthly. 캘린더용으로 일기를 쓴 날의 감정만 준다. yearMonth는 YYYY-MM.
  async monthly(yearMonth: string): Promise<MonthlyItem[]> {
    const { data } = await api.get('/diaries/monthly', {
      params: { yearMonth },
    });
    return parseMonthly(data, yearMonth);
  },
  // 그림을 본 뒤 쓴 한 줄 저장. 서버 API가 생기면 여기만 구현한다.
  async saveContent(
    _diaryId: number,
    _content: string,
    _requestKey: string,
  ): Promise<never> {
    throw new AuthError(
      'NOT_SUPPORTED',
      '한 줄 저장은 서버에서 준비 중이에요. 그림은 이미 저장됐어요.',
    );
  },
};
