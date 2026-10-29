import { create } from 'zustand';
import type {
  DiaryDraft,
  DiaryEntry,
  Emotion,
  SelectableTag,
  RecordPhase,
} from '@/types/diary';
import type { HomeResponse, ImageRequestBody } from '@/types/server';
import { createMockEntries } from '@/mocks/diaries';
import {
  CONTENT_SAVE_SUPPORTED,
  DIARY_IMAGE_ALREADY_REQUESTED,
  DiaryExistsError,
  PROVISIONAL_CHARACTER_ID,
  diaryApi,
  diaryKeys,
} from '@/services/diaryApi';
import {
  apiErrorMessage,
  errorCode,
  isUnknownOutcome,
} from '@/services/authErrors';
import {
  imageRequests,
  type ImageRequestSnapshot,
} from '@/services/imageRequests';
import { queryClient } from '@/services/queryClient';
import { todayKey } from '@/constants/date';
import {
  emptySelection,
  activityChoices,
  chosenActivity,
  removeSelectedTag,
  resolveTag,
  selectCustomTag,
  toImageTags,
  toggleTag,
} from '@/features/diary/tagRules';
import {
  iconTag,
  toAppEmotion,
  toServerEmotion,
  toServerWeather,
} from '@/features/diary/serverDiary';
import { createRequestKey } from '@/utils/requestKey';
import { useRewardStore } from './useRewardStore';
import { useTagStore } from './useTagStore';
import { mozziKeys } from '@/services/mozziApi';
import type { EmotionPicks } from '@/types/companion';
import type { Reward } from '@/services/rewardApi';

export const MEMO_MAX_LENGTH = 100;
export const MEMO_MAX_LINES = 3;
export const emptyDraft = (): DiaryDraft => ({
  mainActivityId: null,
  recordDate: null,
  emotion: null,
  tags: emptySelection(),
  memo: '',
});
// 그림 (다시) 요청 한 건의 진행 상태. unknown: 응답을 받지 못해 서버가 받았는지 모른다(홈 재조회로 확인).
export interface ImageAction {
  diaryId: number | null;
  status: 'idle' | 'sending' | 'unknown' | 'error';
  error: string;
  // Idempotency-Key. 응답을 못 받아 다시 보낼 때만 같은 값을 쓴다.
  key: string | null;
}
export type StartResult = { diaryId: number; existing: boolean };
interface AppState {
  draft: DiaryDraft;
  // 캘린더·검색이 아직 쓰는 로컬 샘플 기록. 오늘 기록·홈·상세는 서버(TanStack Query)에서 온다.
  entries: DiaryEntry[];
  // 일기 생성(그림 요청 전 단계) 상태.
  requestStatus: 'idle' | 'requesting' | 'error';
  requestError: string;
  requestKey: string | null;
  image: ImageAction;
  // 그림 요청 때 고른 장면·모찌 (diaryId별). 다시 그리기·다시 보내기에 그대로 쓴다.
  // null은 기기에서 찾아봤지만 없다는 뜻이다(키가 없으면 아직 확인 전).
  requests: Record<string, ImageRequestSnapshot | null>;
  // 한 줄 저장 상태. 그림 성공과는 별개다.
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string;
  saveKey: string | null;
  tagNotice: string;
  session: number;
  resetSession: () => void;
  resetDraft: () => void;
  selectEmotion: (emotion: Emotion) => void;
  toggleTag: (tag: SelectableTag) => void;
  toggleCustomTag: (id: string) => void;
  selectCustomTag: (id: string) => void;
  forgetCustomTag: (id: string) => void;
  selectMainActivity: (id: string) => void;
  setMemo: (memo: string) => void;
  // 일기를 만들고 이어서 그림을 요청한다. 일기가 만들어지면 결과 화면으로 넘어간다.
  startGeneration: (memberId: number) => Promise<StartResult | null>;
  // 다시 그리기(실패) · 다시 보내기(요청 유실). 보관한 장면이 없으면 whatMyIconId를 사용자가 다시 고른다.
  sendImage: (
    memberId: number,
    diaryId: number,
    whatMyIconId?: number,
  ) => Promise<void>;
  loadRequest: (memberId: number, diaryId: number) => Promise<void>;
  completeDiary: (memberId: number, diaryId: number) => Promise<boolean>;
}
// 일기 생성 요청 중에는 기분·태그를 바꾸지 않는다. 만들어진 뒤에는 초안이 비워지고 기록 화면은 useRecordGuard가 막는다.
export const isDraftLocked = (state: Pick<AppState, 'requestStatus'>) =>
  state.requestStatus === 'requesting';
export function entryPhase(entry: DiaryEntry, saving: boolean): RecordPhase {
  if (entry.status === 'completed') return 'completed';
  if (entry.generation === 'notRequested') return 'notRequested';
  if (entry.generation === 'generating') return 'generating';
  if (entry.generation === 'failed') return 'failed';
  return saving ? 'saving' : 'reviewing';
}
// 다시 그리기는 서버가 받아 줄 때만(실패 3번 미만, 오늘 기록, 무엇을 아이콘이 남아 있음).
export const canRetry = (entry: DiaryEntry) =>
  entry.generation === 'failed' &&
  entry.status === 'draft' &&
  (!entry.failure ||
    (entry.failure.retryable && entry.failure.remainingRetries > 0));
export const canResend = (entry: DiaryEntry) =>
  entry.generation === 'notRequested' &&
  entry.status === 'draft' &&
  entry.canRequestImage !== false;
export const limitMemo = (memo: string) =>
  memo
    .split('\n')
    .slice(0, MEMO_MAX_LINES)
    .join('\n')
    .slice(0, MEMO_MAX_LENGTH);

const idleImage = (): ImageAction => ({
  diaryId: null,
  status: 'idle',
  error: '',
  key: null,
});
const initialRecordState = () => ({
  draft: emptyDraft(),
  requestStatus: 'idle' as const,
  requestError: '',
  requestKey: null,
  saveStatus: 'idle' as const,
  saveError: '',
  saveKey: null,
  tagNotice: '',
});
// 감정별로 고른 모찌 (마이페이지에서 받은 값). 아직 받지 않았으면 기본 모찌.
const pickedCompanion = (memberId: number, emotion: Emotion) =>
  queryClient.getQueryData<EmotionPicks>(mozziKeys.picks(memberId))?.[
    emotion
  ] ?? null;
const refreshDiaries = (memberId: number) =>
  queryClient.invalidateQueries({ queryKey: diaryKeys.all(memberId) });
// 응답을 받지 못했을 때 서버에 오늘 일기가 생겼는지 직접 확인한다.
const fetchHome = (memberId: number) =>
  queryClient
    .fetchQuery({
      queryKey: diaryKeys.home(memberId),
      queryFn: diaryApi.home,
      staleTime: 0,
    })
    .catch((): HomeResponse | null => null);
const sending = new Map<number, Promise<void>>();

export const useAppStore = create<AppState>((set, get) => {
  const editDraft = (update: (draft: DiaryDraft) => Partial<DiaryDraft>) => {
    if (isDraftLocked(get())) return;
    set(state => ({
      draft: { ...state.draft, ...update(state.draft) },
      // 고른 내용이 바뀌면 다른 요청이므로 새 Idempotency-Key를 쓴다.
      requestKey: null,
    }));
  };
  const remember = async (memberId: number, snapshot: ImageRequestSnapshot) => {
    await imageRequests.save(memberId, snapshot);
    set(state => ({
      requests: { ...state.requests, [snapshot.diaryId]: snapshot },
    }));
  };
  return {
    ...initialRecordState(),
    entries: createMockEntries(),
    image: idleImage(),
    requests: {},
    session: 0,
    resetSession: () => {
      sending.clear();
      imageRequests.resetMemory();
      set(state => ({
        ...initialRecordState(),
        entries: createMockEntries(),
        image: idleImage(),
        requests: {},
        session: state.session + 1,
      }));
    },
    resetDraft: () => set(initialRecordState()),
    selectEmotion: emotion =>
      editDraft(draft => ({
        emotion,
        recordDate: draft.recordDate ?? todayKey(),
      })),
    toggleTag: tag => {
      if (isDraftLocked(get())) return;
      const next = toggleTag(get().draft.tags, tag);
      if (next === get().draft.tags) return;
      editDraft(draft => ({
        tags: next,
        mainActivityId:
          draft.mainActivityId && next.activities.includes(draft.mainActivityId)
            ? draft.mainActivityId
            : null,
      }));
      set({ tagNotice: '' });
    },
    toggleCustomTag: id => {
      const tag = useTagStore.getState().tags.find(tag => tag.id === id);
      if (tag) get().toggleTag(tag);
    },
    selectCustomTag: id => {
      const tag = useTagStore.getState().tags.find(tag => tag.id === id);
      if (tag) editDraft(draft => ({ tags: selectCustomTag(draft.tags, tag) }));
    },
    forgetCustomTag: id =>
      editDraft(draft => ({
        tags: removeSelectedTag(draft.tags, id),
        mainActivityId:
          draft.mainActivityId === id ? null : draft.mainActivityId,
      })),
    selectMainActivity: id => {
      if (get().draft.mainActivityId === id) return;
      if (
        !activityChoices(get().draft.tags, useTagStore.getState().tags).some(
          tag => tag.id === id,
        )
      )
        return;
      editDraft(() => ({ mainActivityId: id }));
    },
    setMemo: memo => {
      if (get().saveStatus === 'saving') return;
      set(state => ({
        draft: { ...state.draft, memo: limitMemo(memo) },
        saveKey: null,
      }));
    },
    startGeneration: async memberId => {
      const state = get();
      if (state.requestStatus === 'requesting') return null;
      const library = useTagStore.getState().tags;
      const { draft } = state;
      const main = chosenActivity(draft, library);
      if (!draft.emotion || !main) return null;
      const requestKey = state.requestKey ?? createRequestKey();
      const session = state.session;
      set({ requestStatus: 'requesting', requestError: '', requestKey });
      const fail = (error: unknown) => {
        if (get().session === session)
          set({
            requestStatus: 'error',
            requestError: apiErrorMessage(
              error,
              '그림을 부탁하지 못했어요. 고른 태그는 그대로 있어요.',
            ),
          });
        return null;
      };
      // 고른 태그를 서버 아이콘으로 바꾼다. 일기에는 고른 태그 전체를, 그림에는 대표 활동 하나와 장소·첫 번째 동행을 쓴다.
      const place = resolveTag(draft.tags.place, library);
      const companions = draft.tags.companions
        .map(id => resolveTag(id, library))
        .filter((tag): tag is SelectableTag => !!tag);
      const selected = [...activityChoices(draft.tags, library)];
      if (place) selected.push(place);
      selected.push(...companions);
      const weather = resolveTag(draft.tags.weather, library);
      let body: ImageRequestBody;
      let created: {
        diaryId: number;
        recordDate: string;
        reward?: Reward | null;
      } | null = null;
      try {
        const ids = new Map<string, number>();
        for (const tag of selected)
          ids.set(tag.id, await useTagStore.getState().ensureIcon(tag));
        body = {
          characterId: PROVISIONAL_CHARACTER_ID,
          weather: toServerWeather(
            weather && 'code' in weather ? weather.code : null,
          ),
          whereMyIconId: place ? ids.get(place.id)! : null,
          whoMyIconId: companions[0] ? ids.get(companions[0].id)! : null,
          whatMyIconId: ids.get(main.id)!,
        };
        const emoticonId = await diaryApi.emoticonId(
          toServerEmotion(draft.emotion),
        );
        if (get().session !== session) return null;
        try {
          created = await diaryApi.create(
            {
              emoticonId,
              content: null,
              myIconIds: [...new Set(ids.values())],
            },
            requestKey,
          );
        } catch (error) {
          if (!(error instanceof DiaryExistsError) && !isUnknownOutcome(error))
            throw error;
          // 이미 있거나 응답이 끊겼다. 앞서 보낸 이 요청으로 만들어진 일기면 이어서 그림을 요청하고,
          // 다른 기기에서 만든 일기면 그 기록으로 보낸다.
          const home = await fetchHome(memberId);
          if (get().session !== session) return null;
          const diary = home?.todayDiary;
          const ours =
            !!diary &&
            home?.todayStatus === 'IMAGE_NOT_REQUESTED' &&
            diary.myIcons.WHAT.some(
              icon => icon.myIconId === body.whatMyIconId,
            );
          if (diary && ours)
            created = { diaryId: diary.diaryId, recordDate: diary.recordDate };
          else if (diary) {
            set({ ...initialRecordState() });
            return { diaryId: diary.diaryId, existing: true };
          } else throw error;
        }
      } catch (error) {
        return fail(error);
      }
      if (get().session !== session) return null;
      // 그날 첫 일기면 서버가 뽑기권을 지급했다.
      if (created.reward) useRewardStore.getState().show(created.reward);
      const imageTags = toImageTags(draft, library);
      await remember(memberId, {
        diaryId: created.diaryId,
        recordDate: created.recordDate,
        body,
        // 서버는 그 감정에 고른 모찌를 그린다. 생성 중 화면에도 같은 모찌를 보여 준다.
        companion: pickedCompanion(memberId, draft.emotion),
        imageTags,
      });
      if (get().session !== session) return null;
      // 일기는 이제 서버에 고정됐다. 초안을 비우고 그림을 요청한다(결과는 화면이 기다리지 않아도 된다).
      set({ ...initialRecordState() });
      void get().sendImage(memberId, created.diaryId);
      void refreshDiaries(memberId);
      return { diaryId: created.diaryId, existing: false };
    },
    sendImage: (memberId, diaryId, whatMyIconId) => {
      const running = sending.get(diaryId);
      if (running) return running;
      const session = get().session;
      const task = (async () => {
        let snapshot =
          get().requests[diaryId] ??
          (await imageRequests.get(memberId, diaryId));
        if (!snapshot) {
          // 앱이 꺼져 고른 장면을 잃었다. 일기에 남은 아이콘으로 다시 만들고, 대표 활동은 사용자가 고른 것을 쓴다.
          const home = queryClient.getQueryData<HomeResponse>(
            diaryKeys.home(memberId),
          );
          const diary =
            home?.todayDiary?.diaryId === diaryId ? home.todayDiary : null;
          const what = diary?.myIcons.WHAT.find(
            icon => icon.myIconId === whatMyIconId,
          );
          if (!diary || !what) return;
          const where = diary.myIcons.WHERE[0];
          const who = diary.myIcons.WHO[0];
          snapshot = {
            diaryId,
            recordDate: diary.recordDate,
            body: {
              characterId: PROVISIONAL_CHARACTER_ID,
              weather: 'NONE',
              whereMyIconId: where?.myIconId ?? null,
              whoMyIconId: who?.myIconId ?? null,
              whatMyIconId: what.myIconId,
            },
            companion: pickedCompanion(memberId, toAppEmotion(diary.emotion)),
            imageTags: [what, where, who]
              .filter(icon => !!icon)
              .map(icon => iconTag(icon!)),
          };
          await remember(memberId, snapshot);
        } else if (!get().requests[diaryId])
          set(state => ({
            requests: { ...state.requests, [diaryId]: snapshot! },
          }));
        if (get().session !== session) return;
        const previous = get().image;
        const key =
          previous.diaryId === diaryId && previous.key
            ? previous.key
            : createRequestKey();
        set({ image: { diaryId, status: 'sending', error: '', key } });
        let next: ImageAction = idleImage();
        try {
          await diaryApi.requestImage(diaryId, snapshot.body, key);
        } catch (error) {
          const code = errorCode(error);
          // 이미 그리는 중·완성: 앞서 보낸 요청이나 다른 기기의 요청이 받아들여졌다. 홈 재조회로 상태를 맞춘다.
          if (code === DIARY_IMAGE_ALREADY_REQUESTED) next = idleImage();
          else if (isUnknownOutcome(error))
            next = {
              diaryId,
              status: 'unknown',
              error:
                '요청이 전달됐는지 확인하지 못했어요. 상태를 다시 확인하고 있어요.',
              key,
            };
          else
            next = {
              diaryId,
              status: 'error',
              error: apiErrorMessage(error, '그림을 부탁하지 못했어요.'),
              key: null,
            };
        }
        if (get().session !== session) return;
        set({ image: next });
        // 결과와 상관없이 서버 상태를 다시 읽는다 (IMAGE_ONLY_TODAY·IMAGE_ALREADY_REQUESTED·타임아웃 포함).
        await refreshDiaries(memberId);
      })();
      sending.set(diaryId, task);
      void task
        .finally(() => {
          if (sending.get(diaryId) === task) sending.delete(diaryId);
        })
        .catch(() => undefined);
      return task;
    },
    loadRequest: async (memberId, diaryId) => {
      if (diaryId in get().requests) return;
      const session = get().session;
      const snapshot = await imageRequests.get(memberId, diaryId);
      if (get().session === session && !get().requests[diaryId])
        set(state => ({
          requests: { ...state.requests, [diaryId]: snapshot },
        }));
    },
    completeDiary: async (memberId, diaryId) => {
      const state = get();
      if (state.saveStatus === 'saving' || !CONTENT_SAVE_SUPPORTED)
        return false;
      const saveKey = state.saveKey ?? createRequestKey();
      const session = state.session;
      set({ saveStatus: 'saving', saveError: '', saveKey });
      try {
        await diaryApi.saveContent(diaryId, state.draft.memo.trim(), saveKey);
        if (get().session !== session) return false;
        set(initialRecordState());
        await refreshDiaries(memberId);
        return true;
      } catch (error) {
        if (get().session === session)
          set({
            saveStatus: 'error',
            saveError: apiErrorMessage(error, '기록을 저장하지 못했어요.'),
          });
        return false;
      }
    },
  };
});
