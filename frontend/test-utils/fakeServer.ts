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

type ServerTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
const duplicateShards: Record<ServerTier, number> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 5,
  LEGENDARY: 15,
  MYTHIC: 40,
};
const card = (
  cardId: number,
  code: string,
  name: string,
  tier: ServerTier,
  emotion: ServerEmotion,
  exchangeCost: number | null = null,
) => ({ cardId, code, name, tier, emotion, exchangeCost });
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
    withdrawn: false,
    // 뽑기권 보상. 기본은 이미 받은 상태라 다른 테스트에 알림이 끼어들지 않는다.
    tickets: 20,
    rewardedDates: new Set<string>(),
    rewardsOn: false,
    // 뽑기: 카드 표, 별조각, 보유 카드, 다음 추첨 결과(카드 ID 순서), 감정별 고른 카드.
    shards: 0,
    cards: [
      card(201, 'S2-04-01', '수박 모찌', 'EPIC', 'HAPPY'),
      card(202, 'S2-08-02', '사과 모찌', 'COMMON', 'CALM'),
      card(203, 'S2-02-01', '천도복숭아 모찌', 'LEGENDARY', 'HAPPY', 200),
      card(204, 'S2-01-04', '딸기 왕관 모찌', 'MYTHIC', 'SAD', 400),
      card(205, 'S2-05-04', '체리 모찌', 'RARE', 'SAD'),
    ],
    owned: new Map<number, { count: number; seen: boolean; at: string }>(),
    drawQueue: [] as number[],
    picks: new Map<ServerEmotion, number>(),
    replays: new Map<string, unknown>(),
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
  const cardView = (cardId: number) => {
    const found = state.cards.find(item => item.cardId === cardId);
    if (!found) return null;
    const mine = state.owned.get(cardId);
    return {
      ...found,
      series: '과일 모찌',
      imageUrl: `https://cdn.example.test/cards/${found.code}.png`,
      owned: !!mine,
      ownedCount: mine?.count ?? 0,
      isNew: !!mine && !mine.seen,
    };
  };
  const status = () => ({
    ticketCount: state.tickets,
    shardCount: state.shards,
    collection: { owned: state.owned.size, total: state.cards.length },
  });
  // 같은 키로 다시 보내면 첫 응답을 돌려준다 (실패는 기록하지 않는다).
  const replay = (
    call: Call,
    config: InternalAxiosRequestConfig,
    run: () => unknown,
  ) => {
    if (!call.key) fail(config, 400, 'INVALID_INPUT');
    const key = `${call.method} ${call.url} ${call.key}`;
    if (!state.replays.has(key)) state.replays.set(key, run());
    return ok(config, state.replays.get(key), 201);
  };
  const gacha = (call: Call, config: InternalAxiosRequestConfig) => {
    const { method, url } = call;
    if (method === 'GET' && url === '/gacha/status')
      return ok(config, status());
    if (method === 'GET' && url === '/gacha/rates')
      return ok(config, {
        rates: (
          [
            ['COMMON', 0.45],
            ['RARE', 0.3],
            ['EPIC', 0.17],
            ['LEGENDARY', 0.07],
            ['MYTHIC', 0.01],
          ] as const
        ).map(([tier, rate]) => ({
          tier,
          rate,
          duplicateShards: duplicateShards[tier],
        })),
      });
    if (method === 'POST' && url === '/gacha/draws')
      return replay(call, config, () => {
        const count: number = call.body?.count;
        if (!Number.isInteger(count) || count < 1 || count > 10)
          fail(config, 400, 'INVALID_INPUT');
        if (state.tickets < count) fail(config, 409, 'NOT_ENOUGH_TICKETS');
        state.tickets -= count;
        const results = Array.from({ length: count }, () => {
          const cardId = state.drawQueue.shift() ?? 202;
          const found = state.cards.find(item => item.cardId === cardId)!;
          const mine = state.owned.get(cardId);
          if (mine) mine.count += 1;
          else
            state.owned.set(cardId, {
              count: 1,
              seen: false,
              at: '2026-10-28T09:00:00+09:00',
            });
          const shardsGained = mine ? duplicateShards[found.tier] : 0;
          state.shards += shardsGained;
          return {
            card: cardView(cardId),
            firstAcquired: !mine,
            shardsGained,
          };
        });
        return { drawId: 9000 + state.calls.length, results, ...status() };
      });
    if (method === 'GET' && url === '/gacha/collection')
      return ok(config, {
        owned: state.owned.size,
        total: state.cards.length,
        shardCount: state.shards,
        cards: state.cards.map(item => cardView(item.cardId)),
      });
    if (method === 'POST' && url === '/gacha/collection/seen') {
      for (const cardId of call.body?.cardIds ?? []) {
        const mine = state.owned.get(cardId);
        if (mine) mine.seen = true;
      }
      return ok(config, '', 204);
    }
    if (method === 'POST' && url === '/gacha/exchanges')
      return replay(call, config, () => {
        const found = state.cards.find(
          item => item.cardId === call.body?.cardId,
        );
        if (!found) fail(config, 404, 'NOT_FOUND');
        if (found.exchangeCost === null)
          fail(config, 409, 'CARD_NOT_EXCHANGEABLE');
        if (state.owned.has(found.cardId))
          fail(config, 409, 'CARD_ALREADY_OWNED');
        if (state.shards < found.exchangeCost)
          fail(config, 409, 'NOT_ENOUGH_SHARDS');
        state.shards -= found.exchangeCost;
        state.owned.set(found.cardId, {
          count: 1,
          seen: false,
          at: '2026-10-28T10:00:00+09:00',
        });
        return {
          card: cardView(found.cardId),
          shardsSpent: found.exchangeCost,
          shardCount: state.shards,
        };
      });
    if (method === 'GET' && url === '/members/me/mozzis') {
      const params = call.params ?? {};
      const cards = [...state.owned.keys()]
        .map(cardId => cardView(cardId)!)
        .filter(
          item =>
            (!params.emotion || item.emotion === params.emotion) &&
            (!params.tier || item.tier === params.tier) &&
            (!params.name || item.name.includes(params.name)),
        )
        .map(item => ({
          cardId: item.cardId,
          name: item.name,
          tier: item.tier,
          emotion: item.emotion,
          imageUrl: item.imageUrl,
          acquiredAt: state.owned.get(item.cardId)!.at,
          equipped: state.picks.get(item.emotion) === item.cardId,
        }));
      if (params.sort === 'NAME')
        cards.sort((a, b) => a.name.localeCompare(b.name));
      return ok(config, { count: cards.length, cards });
    }
    const pick = url.match(/^\/members\/me\/mozzis\/([A-Z]+)$/);
    if (method === 'PUT' && pick) {
      const emotion = pick[1] as ServerEmotion;
      const found = cardView(call.body?.cardId);
      if (!found?.owned) fail(config, 409, 'CARD_NOT_OWNED');
      if (found.emotion !== emotion) fail(config, 400, 'CARD_EMOTION_MISMATCH');
      state.picks.set(emotion, found.cardId);
      return ok(config, '', 204);
    }
    fail(config, 404, 'NOT_FOUND');
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
      const recordKey = `RECORD:${state.today}`;
      let reward = null;
      if (state.rewardsOn && !state.rewardedDates.has(recordKey)) {
        state.rewardedDates.add(recordKey);
        state.tickets += 10;
        reward = {
          type: 'DAILY_RECORD',
          tickets: 10,
          ticketCount: state.tickets,
        };
      }
      return ok(config, { diaryId, recordDate: state.today, reward }, 201);
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
    if (method === 'POST' && url === '/rewards/daily-login') {
      const key = `LOGIN:${state.today}`;
      const granted = state.rewardsOn && !state.rewardedDates.has(key);
      if (granted) {
        state.rewardedDates.add(key);
        state.tickets += 10;
      }
      return ok(config, {
        date: state.today,
        granted,
        tickets: granted ? 10 : 0,
        ticketCount: state.tickets,
      });
    }
    if (url.startsWith('/gacha') || url.startsWith('/members/me/mozzis'))
      return gacha(call, config);
    if (method === 'GET' && url === '/members/me')
      return ok(config, {
        memberId: 7,
        email: 'member@example.com',
        nickname: '회원',
        provider: 'GOOGLE',
        mozzis: (['HAPPY', 'CALM', 'NEUTRAL', 'SAD', 'ANGRY'] as const).map(
          emotion => {
            const picked = cardView(state.picks.get(emotion) ?? 0);
            return {
              emotion,
              selected: picked && {
                cardId: picked.cardId,
                name: picked.name,
                tier: picked.tier,
                imageUrl: picked.imageUrl,
              },
            };
          },
        ),
      });
    if (method === 'DELETE' && url === '/members/me') {
      state.withdrawn = true;
      return ok(config, '', 204);
    }
    if (method === 'GET' && url === '/emotion-search/suggestions')
      return ok(config, {
        suggestions: [
          '마음이 편했던 날을 보여 줘',
          '이번 달엔 어떤 기분이 많았어?',
        ],
      });
    // 감정 검색: '편했'은 평온 기록, '어떤 기분'은 감정 통계, 나머지는 결과 없음으로 답한다.
    if (method === 'POST' && url === '/emotion-search') {
      const question: string = call.body?.question ?? '';
      if (!question.trim() || question.length > 200)
        fail(config, 400, 'INVALID_INPUT');
      const base = {
        searchId: 3000 + state.calls.length,
        question,
        interpretedFilter: {
          from: null,
          to: null,
          emotions: [],
          keyword: null,
        },
      };
      if (question.includes('어떤 기분')) {
        const counts = new Map<ServerEmotion, number>();
        for (const diary of state.diaries)
          counts.set(diary.emotion, (counts.get(diary.emotion) ?? 0) + 1);
        return ok(config, {
          ...base,
          resultType: 'STATS_ONLY',
          answer: '평온 모찌를 고른 날이 가장 많았어요.',
          stats: {
            matchedCount: state.diaries.length,
            emotionCounts: [...counts].map(([emotion, count]) => ({
              emotion,
              count,
            })),
          },
          featured: null,
          diaries: [],
        });
      }
      const found = question.includes('편했')
        ? state.diaries
            .filter(item => item.emotion === 'CALM')
            .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        : [];
      if (!found.length)
        return ok(config, {
          ...base,
          resultType: 'EMPTY',
          answer: null,
          stats: { matchedCount: 0, emotionCounts: null },
          featured: null,
          diaries: [],
        });
      return ok(config, {
        ...base,
        resultType: 'FOUND',
        answer: `평온 모찌를 고른 날이 ${found.length}일 있었어요.`,
        stats: { matchedCount: found.length, emotionCounts: null },
        featured: detail(found[0].diaryId),
        diaries: found.map(item => {
          const full = detail(item.diaryId);
          return {
            diaryId: full.diaryId,
            recordDate: full.recordDate,
            emoticonId: full.emoticonId,
            emotion: full.emotion,
            content: full.content,
            image: full.image,
          };
        }),
      });
    }
    if (method === 'GET' && url === '/diaries/monthly') {
      const yearMonth = call.params?.yearMonth ?? '';
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) fail(config, 400, 'INVALID_INPUT');
      return ok(config, {
        yearMonth,
        items: state.diaries
          .filter(item => item.recordDate.startsWith(`${yearMonth}-`))
          .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
          .map(item => ({
            diaryId: item.diaryId,
            recordDate: item.recordDate,
            emoticonId: emoticonIds[item.emotion],
            emotion: item.emotion,
          })),
      });
    }
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
