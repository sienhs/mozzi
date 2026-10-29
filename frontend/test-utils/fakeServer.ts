import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  DiaryDetail,
  IconCategory,
  ImageRequestBody,
  ImageStatus,
  MyIcon,
  ServerEmotion,
} from '@/types/server';

// 테스트용 백엔드. backend의 실제 규칙(docs/api/diary.md·home.md, DiaryImageService, HomeService)을 따른다.
// 응답을 끊거나(타임아웃) 오류를 끼워 넣을 수 있다.
export interface Call {
  method: string;
  url: string;
  params?: Record<string, string>;
  body?: any;
  key?: string;
}
type Override = (call: Call, config: InternalAxiosRequestConfig) => unknown;
const emoticonIds: Record<ServerEmotion, number> = {
  HAPPY: 1,
  CALM: 2,
  NEUTRAL: 3,
  SAD: 4,
  ANGRY: 5,
};
export const ok = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ data, config, status, statusText: String(status), headers: {} });
export function fail(
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
): never {
  throw new AxiosError(
    code,
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    ok(
      config,
      { code, message: `${code} 메시지`, fieldErrors: null, ...extra },
      status,
    ),
  );
}
// 서버가 처리했는지 모르는 실패 (응답 없음).
export function timeout(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('timeout', 'ECONNABORTED', config);
}

export function createFakeServer(today: string) {
  let iconId = 100;
  const state = {
    today,
    icons: [] as MyIcon[],
    diaries: [] as {
      diaryId: number;
      recordDate: string;
      emotion: ServerEmotion;
      content: string | null;
      iconIds: number[];
    }[],
    images: new Map<
      number,
      { status: ImageStatus; failures: number; body: ImageRequestBody }
    >(),
    calls: [] as Call[],
    overrides: new Map<string, Override[]>(),
  };
  const icon = (name: string, category: IconCategory) => {
    const created = {
      myIconId: ++iconId,
      name,
      category,
      createdAt: '2026-10-26T09:00:00+09:00',
    };
    state.icons.push(created);
    return created;
  };
  const detail = (diaryId: number): DiaryDetail => {
    const diary = state.diaries.find(item => item.diaryId === diaryId)!;
    const icons = state.icons.filter(item =>
      diary.iconIds.includes(item.myIconId),
    );
    const image = state.images.get(diaryId);
    return {
      diaryId,
      recordDate: diary.recordDate,
      emoticonId: emoticonIds[diary.emotion],
      emotion: diary.emotion,
      content: diary.content,
      myIcons: {
        WHERE: icons.filter(item => item.category === 'WHERE'),
        WHO: icons.filter(item => item.category === 'WHO'),
        WHAT: icons.filter(item => item.category === 'WHAT'),
      },
      image: image
        ? {
            status: image.status,
            imageUrl:
              image.status === 'SUCCEEDED'
                ? `https://cdn.example.test/diary/${diaryId}.webp`
                : null,
          }
        : null,
      createdAt: `${diary.recordDate}T21:12:00+09:00`,
      updatedAt: `${diary.recordDate}T21:12:00+09:00`,
    };
  };
  const home = () => {
    const todayDiary = state.diaries.find(
      item => item.recordDate === state.today,
    );
    const recent = state.diaries
      .filter(item => item.recordDate < state.today)
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];
    const image = todayDiary && state.images.get(todayDiary.diaryId);
    const todayStatus = !todayDiary
      ? 'NOT_RECORDED'
      : !image
        ? 'IMAGE_NOT_REQUESTED'
        : image.status === 'PENDING'
          ? 'IMAGE_PENDING'
          : image.status === 'SUCCEEDED'
            ? 'COMPLETED'
            : 'IMAGE_FAILED';
    const hasWhat =
      !!todayDiary &&
      state.icons.some(
        item =>
          item.category === 'WHAT' &&
          todayDiary.iconIds.includes(item.myIconId),
      );
    return {
      today: state.today,
      todayStatus,
      todayDiary: todayDiary ? detail(todayDiary.diaryId) : null,
      canRequestImage:
        hasWhat &&
        (!image || (image.status === 'FAILED' && image.failures < 3)),
      recentDiary: recent ? detail(recent.diaryId) : null,
    };
  };
  const route = (call: Call, config: InternalAxiosRequestConfig) => {
    const { method, url } = call;
    if (method === 'GET' && url === '/emoticons')
      return ok(config, {
        items: Object.entries(emoticonIds).map(([emotion, emoticonId]) => ({
          emoticonId,
          emotion,
          imageUrl: `https://cdn.example.test/${emotion}.webp`,
        })),
      });
    if (method === 'GET' && url === '/my-icons')
      return ok(config, {
        items: state.icons.filter(
          item => item.category === call.params?.category,
        ),
      });
    if (method === 'POST' && url === '/my-icons') {
      const { name, category } = call.body;
      if (state.icons.filter(item => item.category === category).length >= 9)
        fail(config, 409, 'MY_ICON_LIMIT_EXCEEDED');
      return ok(config, icon(name, category), 201);
    }
    const remove = url.match(/^\/my-icons\/(\d+)$/);
    if (method === 'DELETE' && remove) {
      state.icons = state.icons.filter(
        item => item.myIconId !== Number(remove[1]),
      );
      return ok(config, '', 204);
    }
    if (method === 'POST' && url === '/diaries') {
      if (!call.key) fail(config, 400, 'INVALID_INPUT');
      const existing = state.diaries.find(
        item => item.recordDate === state.today,
      );
      if (existing)
        fail(config, 409, 'DIARY_ALREADY_EXISTS', {
          diaryId: existing.diaryId,
        });
      const emotion = (Object.keys(emoticonIds) as ServerEmotion[]).find(
        id => emoticonIds[id] === call.body.emoticonId,
      )!;
      const diaryId = 500 + state.diaries.length;
      state.diaries.push({
        diaryId,
        recordDate: state.today,
        emotion,
        content: call.body.content,
        iconIds: call.body.myIconIds,
      });
      return ok(config, { diaryId, recordDate: state.today }, 201);
    }
    const image = url.match(/^\/diaries\/(\d+)\/image$/);
    if (method === 'POST' && image) {
      const diaryId = Number(image[1]);
      const diary = state.diaries.find(item => item.diaryId === diaryId);
      if (!diary) fail(config, 404, 'NOT_FOUND');
      if (diary.recordDate !== state.today)
        fail(config, 400, 'IMAGE_ONLY_TODAY');
      const current = state.images.get(diaryId);
      if (current && current.status !== 'FAILED')
        fail(config, 409, 'IMAGE_ALREADY_REQUESTED');
      if (current && current.failures >= 3)
        fail(config, 429, 'RETRY_LIMIT_EXCEEDED');
      if (!diary.iconIds.includes(call.body.whatMyIconId))
        fail(config, 400, 'INVALID_INPUT');
      state.images.set(diaryId, {
        status: 'PENDING',
        failures: current?.failures ?? 0,
        body: call.body,
      });
      return ok(config, { diaryId, imageStatus: 'PENDING' }, 202);
    }
    if (method === 'GET' && url === '/home') return ok(config, home());
    if (method === 'GET' && url === '/diaries/daily') {
      const diary = state.diaries.find(
        item => item.recordDate === call.params?.date,
      );
      if (!diary) fail(config, 404, 'NOT_FOUND');
      return ok(config, detail(diary.diaryId));
    }
    fail(config, 404, 'NOT_FOUND');
  };
  return {
    state,
    adapter: async (config: InternalAxiosRequestConfig) => {
      const call: Call = {
        method: (config.method ?? 'get').toUpperCase(),
        url: config.url ?? '',
        params: config.params,
        body:
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data,
        key: config.headers?.get?.('Idempotency-Key') as string | undefined,
      };
      state.calls.push(call);
      const queued = state.overrides.get(`${call.method} ${call.url}`);
      const override = queued?.shift();
      if (override) return override(call, config) as any;
      return route(call, config);
    },
    // 다음 한 번의 요청을 바꾼다. 실제 처리(route) 후 응답만 끊는 것도 된다.
    next(endpoint: string, override: Override) {
      const list = state.overrides.get(endpoint) ?? [];
      list.push(override);
      state.overrides.set(endpoint, list);
    },
    process: (call: Call, config: InternalAxiosRequestConfig) =>
      route(call, config),
    icon,
    // 오늘 이전 기록을 넣는다.
    addDiary(
      recordDate: string,
      emotion: ServerEmotion,
      content: string | null,
      names: [string, IconCategory][],
      imageStatus: ImageStatus | null = 'SUCCEEDED',
    ) {
      const diaryId = 500 + state.diaries.length;
      state.diaries.push({
        diaryId,
        recordDate,
        emotion,
        content,
        iconIds: names.map(([name, category]) => icon(name, category).myIconId),
      });
      if (imageStatus)
        state.images.set(diaryId, {
          status: imageStatus,
          failures: imageStatus === 'FAILED' ? 1 : 0,
          body: {} as ImageRequestBody,
        });
      return diaryId;
    },
    // AI 서버 결과가 도착했다.
    finish(diaryId: number, status: 'SUCCEEDED' | 'FAILED') {
      const image = state.images.get(diaryId)!;
      state.images.set(diaryId, {
        ...image,
        status,
        failures: image.failures + (status === 'FAILED' ? 1 : 0),
      });
    },
    detail,
    home,
    callsTo: (method: string, url: string) =>
      state.calls.filter(call => call.method === method && call.url === url),
  };
}
export type FakeServer = ReturnType<typeof createFakeServer>;
