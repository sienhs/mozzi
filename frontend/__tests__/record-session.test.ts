import * as SecureStore from 'expo-secure-store';
import { QueryObserver } from '@tanstack/react-query';
import { presetTag } from '@/constants/tags';
import { todayKey } from '@/constants/date';
import { api } from '@/services/api';
import { diaryApi, diaryKeys } from '@/services/diaryApi';
import { imageRequests } from '@/services/imageRequests';
import { queryClient } from '@/services/queryClient';
import { isDraftLocked, useAppStore } from '@/stores/useAppStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { useTagStore } from '@/stores/useTagStore';
import { mozziKeys } from '@/services/mozziApi';
import { emptyPicks } from '@/types/companion';
import { useRewardStore } from '@/stores/useRewardStore';
import type { SelectableTag } from '@/types/diary';
import type { HomeResponse } from '@/types/server';
import {
  createFakeServer,
  defaultIcons,
  fail,
  timeout,
  type FakeServer,
} from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

const MEMBER = 7;
// 날씨는 앱의 고정 태그 ID, 나머지는 내 태그 이름으로 찾는다.
const tag = (key: string): SelectableTag =>
  presetTag(key) ??
  useTagStore.getState().tags.find(item => item.label === key)!;
const store = () => useAppStore.getState();
let server: FakeServer;
let device: Map<string, string>;

beforeEach(async () => {
  server = createFakeServer(todayKey());
  server.signUpIcons();
  api.defaults.adapter = server.adapter;
  // 기기 저장소 (앱을 다시 켜도 남는다).
  device = new Map();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async key => device.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      device.set(key, value);
    });
  queryClient.clear();
  diaryApi.forgetEmoticons();
  store().resetSession();
  useTagStore.getState().resetSession();
  useGachaStore.getState().resetSession();
  useRewardStore.getState().resetSession();
  await useTagStore.getState().load();
});

function pickDay() {
  store().selectEmotion('calm');
  store().toggleTag(tag('요리'));
  store().toggleTag(tag('식사'));
  store().toggleTag(tag('집'));
  store().toggleTag(tag('가족'));
  store().toggleTag(tag('친구'));
  store().toggleTag(tag('weather.rainy'));
  store().selectMainActivity(tag('식사').id);
}
const homeData = () =>
  queryClient.getQueryData<HomeResponse>(diaryKeys.home(MEMBER));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await settle();
  expect(check()).toBe(true);
};
// 홈 화면이 열려 있는 것처럼 홈 조회를 구독한다 (무효화는 구독 중인 조회만 다시 읽는다).
function watchHome() {
  const observer = new QueryObserver(queryClient, {
    queryKey: diaryKeys.home(MEMBER),
    queryFn: diaryApi.home,
  });
  return observer.subscribe(() => undefined);
}

test('one tap creates the diary without a line, then requests the picture with the chosen scene and keeps it on the device', async () => {
  pickDay();
  const first = store().startGeneration(MEMBER);
  const second = store().startGeneration(MEMBER);
  expect(isDraftLocked(store())).toBe(true);
  expect(await second).toBeNull();
  const result = await first;
  await settle();
  expect(result).toEqual({ diaryId: 500, existing: false });
  // 기본 태그는 가입 때 서버가 만든 내 아이콘을 그대로 쓴다. 새로 만들지 않는다.
  expect(server.callsTo('POST', '/my-icons')).toHaveLength(0);
  const icons = Object.fromEntries(
    server.state.icons.map(icon => [icon.name, icon]),
  );
  const [create] = server.callsTo('POST', '/diaries');
  expect(server.callsTo('POST', '/diaries')).toHaveLength(1);
  expect(create.key).toBeTruthy();
  expect(create.body).toEqual({
    emoticonId: 2,
    content: null,
    myIconIds: ['요리', '식사', '집', '가족', '친구'].map(
      name => icons[name].myIconId,
    ),
  });
  const [image] = server.callsTo('POST', '/diaries/500/image');
  expect(image.key).toBeTruthy();
  expect(image.body).toEqual({
    weather: 'RAINY',
    whereMyIconId: icons['집'].myIconId,
    // 동행은 처음 고른 한 명만 그림에 들어간다.
    whoMyIconId: icons['가족'].myIconId,
    whatMyIconId: icons['식사'].myIconId,
  });
  expect(server.state.images.get(500)?.status).toBe('PENDING');
  // 일기는 서버에 고정됐으니 초안을 비운다. 고른 장면은 기기에 남는다.
  expect(store().draft.emotion).toBeNull();
  const saved = await imageRequests.get(MEMBER, 500);
  expect(saved?.body).toEqual(image.body);
  expect(saved?.imageTags.map(item => item.label)).toEqual([
    '식사',
    '집',
    '가족',
    '비',
  ]);
  expect(device.has(`mozzi.image-requests.v1.${MEMBER}`)).toBe(true);
});

test('default tags are ordinary server tags: listed, deletable, and counted toward the limit of thirty', async () => {
  // 기본 태그도 내 태그 목록에 그대로 보인다.
  expect(useTagStore.getState().tags.map(item => item.label)).toEqual(
    defaultIcons.map(([name]) => name),
  );
  const cooking = tag('요리');
  expect(await useTagStore.getState().ensureIcon(cooking)).toBe(
    Number(cooking.id),
  );
  // 지우면 다시 고를 수 없고, 같은 이름으로 다시 만들 수 있다.
  expect(await useTagStore.getState().remove(cooking.id)).toBe(true);
  await expect(useTagStore.getState().ensureIcon(cooking)).rejects.toThrow(
    '지워졌어요',
  );
  expect(await useTagStore.getState().add('요리', 'activity')).toMatchObject({
    kind: 'custom',
  });
  // 기본 활동 8개 + 22개 = 30개.
  for (let i = 0; i < 22; i++) server.icon(`활동${i}`, 'WHAT');
  useTagStore.getState().resetSession();
  await useTagStore.getState().load();
  const posts = server.callsTo('POST', '/my-icons').length;
  const added = await useTagStore.getState().add('새 활동', 'activity');
  expect(added).toEqual({ kind: 'none' });
  expect(useTagStore.getState().error).toContain('30개');
  expect(server.callsTo('POST', '/my-icons')).toHaveLength(posts);
  // 다른 카테고리는 따로 센다.
  expect(await useTagStore.getState().add('새 장소', 'place')).toMatchObject({
    kind: 'custom',
  });
});

test('a failure before the diary exists keeps the choices and resends with the same key; a changed choice gets a new key', async () => {
  pickDay();
  server.next('POST /diaries', (_call, config) =>
    fail(config, 500, 'INTERNAL_ERROR'),
  );
  expect(await store().startGeneration(MEMBER)).toBeNull();
  expect(store().requestStatus).toBe('error');
  expect(store().requestError).toBe('INTERNAL_ERROR 메시지');
  expect(store().draft.tags.activities).toHaveLength(2);
  const firstKey = server.callsTo('POST', '/diaries')[0].key;
  server.next('POST /diaries', (_call, config) => timeout(config));
  // 응답이 끊겼고 서버에도 기록이 없다: 실패로 남기고 같은 키를 유지한다.
  expect(await store().startGeneration(MEMBER)).toBeNull();
  expect(server.callsTo('POST', '/diaries')[1].key).toBe(firstKey);
  store().selectMainActivity(tag('요리').id);
  await store().startGeneration(MEMBER);
  expect(server.callsTo('POST', '/diaries')[2].key).not.toBe(firstKey);
});

test('a lost create response is rechecked on the server and continues to the picture without a duplicate diary', async () => {
  pickDay();
  server.next('POST /diaries', (call, config) => {
    server.process(call, config);
    return timeout(config);
  });
  const result = await store().startGeneration(MEMBER);
  await settle();
  expect(result).toEqual({ diaryId: 500, existing: false });
  expect(server.state.diaries).toHaveLength(1);
  expect(server.callsTo('POST', '/diaries/500/image')).toHaveLength(1);
});

test('a diary made on another device is opened instead of drawing over it', async () => {
  server.state.diaries.push({
    diaryId: 900,
    recordDate: todayKey(),
    emotion: 'HAPPY',
    content: '다른 기기',
    iconIds: [server.icon('독서', 'WHAT').myIconId],
  });
  pickDay();
  expect(await store().startGeneration(MEMBER)).toEqual({
    diaryId: 900,
    existing: true,
  });
  expect(server.callsTo('POST', '/diaries/900/image')).toHaveLength(0);
  expect(store().requestStatus).toBe('idle');
});

test('a picture request without a response is not called a failure; the home is rechecked and a resend keeps the key', async () => {
  pickDay();
  server.next('POST /diaries/500/image', (call, config) => {
    server.process(call, config);
    return timeout(config);
  });
  const stop = watchHome();
  await store().startGeneration(MEMBER);
  await until(() => store().image.status === 'unknown');
  expect(store().image).toMatchObject({ diaryId: 500, status: 'unknown' });
  // 결과를 단정하지 않고 홈을 다시 읽어 그리는 중임을 확인한다.
  await until(() => homeData()?.todayStatus === 'IMAGE_PENDING');
  stop();
  const key = store().image.key;
  // 다시 보내면 같은 키로 보내고, 이미 접수됐다는 409는 실패가 아니다.
  await store().sendImage(MEMBER, 500);
  const calls = server.callsTo('POST', '/diaries/500/image');
  expect(calls[1].key).toBe(key);
  expect(store().image.status).toBe('idle');
});

test('a redraw resends the stored scene and the mochi picked for the chosen mood even after the pick changes; repeated taps share one request', async () => {
  pickDay();
  const mochi = (cardId: number, name: string) => ({
    cardId,
    name,
    tier: 'epic' as const,
    imageUrl: `https://cdn.example.test/cards/${cardId}.png`,
  });
  queryClient.setQueryData(mozziKeys.picks(MEMBER), {
    ...emptyPicks(),
    calm: mochi(202, '사과 모찌'),
    happy: mochi(201, '수박 모찌'),
  });
  await store().startGeneration(MEMBER);
  await settle();
  server.finish(500, 'FAILED');
  queryClient.setQueryData(mozziKeys.picks(MEMBER), {
    ...emptyPicks(),
    calm: mochi(209, '다른 모찌'),
  });
  const first = store().sendImage(MEMBER, 500);
  const second = store().sendImage(MEMBER, 500);
  expect(second).toBe(first);
  await first;
  const calls = server.callsTo('POST', '/diaries/500/image');
  expect(calls).toHaveLength(2);
  expect(calls[1].body).toEqual(calls[0].body);
  expect(calls[1].key).not.toBe(calls[0].key);
  expect(store().requests[500]?.companion?.name).toBe('사과 모찌');
});

test('IMAGE_ONLY_TODAY is shown and the home is read again', async () => {
  pickDay();
  await store().startGeneration(MEMBER);
  await settle();
  server.finish(500, 'FAILED');
  server.state.today = '2099-01-01';
  const stop = watchHome();
  await store().sendImage(MEMBER, 500);
  expect(store().image).toMatchObject({ status: 'error', key: null });
  expect(store().image.error).toBe('IMAGE_ONLY_TODAY 메시지');
  await until(() => homeData()?.todayStatus === 'NOT_RECORDED');
  stop();
});

test('after the app was closed, the stored scene recovers the lost request; without it the activity must be chosen again', async () => {
  pickDay();
  server.next('POST /diaries/500/image', (_call, config) => timeout(config));
  await store().startGeneration(MEMBER);
  await settle();
  expect(server.home().todayStatus).toBe('IMAGE_NOT_REQUESTED');
  // 앱 재시작: 메모리는 비고 기기 저장소만 남는다.
  store().resetSession();
  await store().sendImage(MEMBER, 500);
  const sent = server.callsTo('POST', '/diaries/500/image');
  expect(sent).toHaveLength(2);
  expect(sent[1].body).toEqual(sent[0].body);

  // 기기 저장소도 없으면 대표 활동을 다시 골라야 보낸다.
  server.state.images.delete(500);
  device.clear();
  store().resetSession();
  await queryClient.fetchQuery({
    queryKey: diaryKeys.home(MEMBER),
    queryFn: diaryApi.home,
  });
  await store().sendImage(MEMBER, 500);
  expect(server.callsTo('POST', '/diaries/500/image')).toHaveLength(2);
  const what = server.state.icons.find(icon => icon.name === '요리')!;
  await store().sendImage(MEMBER, 500, what.myIconId);
  const recovered = server.callsTo('POST', '/diaries/500/image')[2];
  expect(recovered.body).toMatchObject({
    whatMyIconId: what.myIconId,
    weather: 'NONE',
  });
});

test('the one-line save writes the trimmed line once and clears the draft', async () => {
  pickDay();
  await store().startGeneration(MEMBER);
  await settle();
  server.finish(500, 'SUCCEEDED');
  // 비어 있으면 보내지 않는다(서버는 빈 한 줄을 400으로 거절한다).
  store().setMemo('   ');
  const before = server.state.calls.length;
  expect(await store().completeDiary(MEMBER, 500)).toBe(false);
  expect(server.state.calls).toHaveLength(before);

  store().setMemo('  비 오는 날  ');
  expect(await store().completeDiary(MEMBER, 500)).toBe(true);
  expect(server.callsTo('PATCH', '/diaries/500/content')).toEqual([
    expect.objectContaining({ body: { content: '비 오는 날' } }),
  ]);
  expect(server.state.diaries[0].content).toBe('비 오는 날');
  expect(store().draft.memo).toBe('');
  expect(store().saveStatus).toBe('idle');
});

test('the one-line memo is capped at the server limit of 50 characters', () => {
  store().setMemo('가'.repeat(80));
  expect(store().draft.memo).toHaveLength(50);
});

test('a lost save answer keeps the line so the same save can be sent again safely', async () => {
  pickDay();
  await store().startGeneration(MEMBER);
  await settle();
  server.finish(500, 'SUCCEEDED');
  server.next('PATCH /diaries/500/content', (call, config) => {
    server.process(call, config);
    timeout(config);
  });
  store().setMemo('비 오는 날');
  expect(await store().completeDiary(MEMBER, 500)).toBe(false);
  expect(store().saveStatus).toBe('error');
  expect(store().saveError).toBe(
    '저장됐는지 확인하지 못했어요. 같은 한 줄로 다시 저장해 주세요.',
  );
  expect(store().draft.memo).toBe('비 오는 날');
  // 서버는 이미 넣었다. 같은 내용 재전송은 200이라 그대로 끝난다.
  expect(await store().completeDiary(MEMBER, 500)).toBe(true);
  expect(server.callsTo('PATCH', '/diaries/500/content')).toHaveLength(2);
  expect(server.state.diaries[0].content).toBe('비 오는 날');
});

test('a line already written on another device shows the server reason and refreshes the diary', async () => {
  pickDay();
  await store().startGeneration(MEMBER);
  await settle();
  server.finish(500, 'SUCCEEDED');
  server.state.diaries[0].content = '다른 기기에서 쓴 한 줄';
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  store().setMemo('비 오는 날');
  expect(await store().completeDiary(MEMBER, 500)).toBe(false);
  expect(store().saveError).toBe('이미 한 줄 일기를 남겼어요.');
  expect(server.state.diaries[0].content).toBe('다른 기기에서 쓴 한 줄');
  // 서버의 한 줄로 화면을 맞추도록 일기 조회를 다시 부른다.
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: diaryKeys.all(MEMBER),
  });
  invalidate.mockRestore();
});

test('an account reset discards late diary, picture and tag responses', async () => {
  pickDay();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  server.next('POST /diaries', async (call, config) => {
    await gate;
    return server.process(call, config);
  });
  const pending = store().startGeneration(MEMBER);
  await settle();
  store().resetSession();
  release();
  expect(await pending).toBeNull();
  expect(server.callsTo('POST', '/diaries/500/image')).toHaveLength(0);
  expect(store().requests).toEqual({});
  expect(store().requestStatus).toBe('idle');

  const added = useTagStore.getState().add('비밀 태그');
  useTagStore.getState().resetSession();
  expect(await added).toEqual({ kind: 'none' });
  expect(useTagStore.getState().tags).toEqual([]);
});

test('same names in different categories remain distinct; deleting the chosen custom activity invalidates the scene', async () => {
  const ids: string[] = [];
  for (const category of ['activity', 'place', 'companion'] as const) {
    const result = await useTagStore.getState().add('모임', category);
    if (result.kind !== 'custom') throw new Error('custom tag not created');
    ids.push(result.id);
    store().selectCustomTag(result.id);
  }
  expect(new Set(ids).size).toBe(3);
  expect(server.state.icons.slice(-3).map(icon => icon.category)).toEqual([
    'WHAT',
    'WHERE',
    'WHO',
  ]);
  store().selectEmotion('calm');
  store().toggleTag(tag('요리'));
  store().selectMainActivity(ids[0]);
  expect(await useTagStore.getState().remove(ids[0])).toBe(true);
  expect(server.callsTo('DELETE', `/my-icons/${ids[0]}`)).toHaveLength(1);
  store().forgetCustomTag(ids[0]);
  expect(store().draft.mainActivityId).toBeNull();
  expect(store().draft.tags.place).toBe(ids[1]);
  expect(await store().startGeneration(MEMBER)).toBeNull();
});

test('the first diary of the day and the first visit of the day show the tickets the server granted, once each', async () => {
  server.state.rewardsOn = true;
  await useRewardStore.getState().checkDailyLogin();
  await useRewardStore.getState().checkDailyLogin();
  expect(useRewardStore.getState().queue).toEqual([
    { type: 'DAILY_LOGIN', tickets: 10, ticketCount: 30 },
  ]);
  expect(server.callsTo('POST', '/rewards/daily-login')).toHaveLength(2);
  useRewardStore.getState().dismiss();
  pickDay();
  await store().startGeneration(MEMBER);
  expect(useRewardStore.getState().queue).toEqual([
    { type: 'DAILY_RECORD', tickets: 10, ticketCount: 40 },
  ]);
  // 로그아웃·계정 전환 때 남은 알림은 버린다.
  useRewardStore.getState().resetSession();
  expect(useRewardStore.getState().queue).toEqual([]);
});
