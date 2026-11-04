import { cardImageUrls, cardThumbUrl } from '@/components/gacha/CardImage';
import { companionEmotionSource, companionName } from '@/constants/companions';
import { emotions } from '@/constants/emotions';
import { api } from '@/services/api';
import { parseCard, parseDraw } from '@/services/gachaApi';
import { mozziApi, parsePicks } from '@/services/mozziApi';
import { createFakeServer } from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));
const defaultAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = defaultAdapter;
});
const card = {
  cardId: 141,
  code: 'S2-04-01',
  name: '수박 모찌',
  tier: 'EPIC',
  emotion: 'HAPPY',
  series: '과일 모찌',
  imageUrl: 'https://cdn.example.test/cards/S2-04-01.png',
  owned: true,
  ownedCount: 2,
  isNew: false,
  exchangeCost: null,
};

test('server cards map their tier and emotion and reject malformed ones', () => {
  expect(parseCard(card)).toMatchObject({
    cardId: 141,
    tier: 'epic',
    emotion: 'happy',
    exchangeCost: null,
  });
  expect(
    parseCard({ ...card, tier: 'MYTHIC', exchangeCost: 400 }),
  ).toMatchObject({ tier: 'myth', exchangeCost: 400 });
  expect(() => parseCard({ ...card, tier: 'SUPER' })).toThrow();
  expect(() => parseCard({ ...card, emotion: 'TIRED' })).toThrow();
  expect(() => parseCard({ ...card, imageUrl: '' })).toThrow();
});

test('a draw response must hold one result per ticket used', () => {
  const body = {
    drawId: 9001,
    results: [{ card, firstAcquired: false, shardsGained: 5 }],
    ticketCount: 13,
    shardCount: 145,
    collection: { owned: 10, total: 100 },
  };
  expect(parseDraw(body, 1)).toMatchObject({
    tickets: 13,
    shards: 145,
    items: [{ isNew: false, shards: 5 }],
  });
  expect(() => parseDraw(body, 2)).toThrow();
});

test('picks fill every emotion and unpicked ones mean the default mochi', () => {
  const picks = parsePicks({
    memberId: 7,
    mozzis: [
      {
        emotion: 'SAD',
        selected: {
          cardId: 141,
          name: '수박 모찌',
          tier: 'EPIC',
          imageUrl: card.imageUrl,
        },
      },
      { emotion: 'HAPPY', selected: null },
    ],
  });
  expect(picks.sad?.cardId).toBe(141);
  expect(picks.happy).toBeNull();
  expect(picks.calm).toBeNull();
  expect(companionName(picks.sad)).toBe('수박 모찌');
  expect(companionName(picks.happy)).toBe('기본 모찌');
  expect(companionEmotionSource(picks.sad, 'sad')).toEqual({
    uri: card.imageUrl,
  });
  expect(companionEmotionSource(null, 'happy')).toBe(emotions.happy.source);
  expect(companionEmotionSource(null, 'happy', true)).toBe(emotions.happy.face);
  expect(() => parsePicks({ memberId: 7 })).toThrow();
});

test('owned mozzi filters and picks go to the server in its format', async () => {
  const server = createFakeServer('2026-10-28');
  server.state.owned.set(205, {
    count: 1,
    seen: true,
    at: '2026-10-25T09:00:00+09:00',
  });
  api.defaults.adapter = server.adapter;
  const list = await mozziApi.owned({
    emotion: 'sad',
    tier: 'rare',
    name: ' 체리 ',
    sort: 'name',
  });
  expect(server.callsTo('GET', '/members/me/mozzis')[0].params).toEqual({
    sort: 'NAME',
    emotion: 'SAD',
    tier: 'RARE',
    name: '체리',
  });
  expect(list).toMatchObject([
    { cardId: 205, emotion: 'sad', tier: 'rare', equipped: false },
  ]);
  await mozziApi.choose('sad', 205);
  expect(server.callsTo('PUT', '/members/me/mozzis/SAD')[0].body).toEqual({
    cardId: 205,
  });
  await expect(mozziApi.choose('happy', 205)).rejects.toBeDefined();
});

test('card thumbnails sit next to the S3 original as GACHA/thumb/<name>.webp', () => {
  const base = 'https://mozzi-dev.s3.ap-northeast-2.amazonaws.com';
  expect(
    cardThumbUrl(`${base}/GACHA/S1-01-01_mozzi_mythic_001_happy_r2.png`),
  ).toBe(`${base}/GACHA/thumb/S1-01-01_mozzi_mythic_001_happy_r2.webp`);
  // 기본 모찌·다른 경로는 썸네일이 없어 원본을 그대로 쓴다.
  expect(cardThumbUrl(`${base}/basic/happy.png`)).toBeNull();
  expect(
    cardThumbUrl('https://cdn.example.test/cards/S2-04-01.png'),
  ).toBeNull();
  expect(cardImageUrls(`${base}/GACHA/a.png`)).toEqual([
    `${base}/GACHA/thumb/a.webp`,
  ]);
  expect(cardImageUrls(`${base}/GACHA/a.png`, true)).toEqual([
    `${base}/GACHA/a.png`,
    `${base}/GACHA/thumb/a.webp`,
  ]);
});
