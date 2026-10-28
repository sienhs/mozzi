import { create } from 'zustand';
import type {
  DiaryDraft,
  DiaryEntry,
  Emotion,
  PresetTag,
  RecordPhase,
} from '@/types/diary';
import { createMockEntries } from '@/mocks/diaries';
import { diaryGateway } from '@/services/diaryGateway';
import { errorMessage, toGenerationFailure } from '@/services/diaryErrors';
import { allowedRecordDate, todayKey } from '@/constants/date';
import {
  clearBlockedPlace,
  emptySelection,
  selectCustomTag,
  selectionFromTags,
  toDiaryTags,
  toGenerationRequest,
  toggleCustomTag,
  toggleTag,
} from '@/features/diary/tagRules';
import { createRequestKey } from '@/utils/requestKey';
import { useTagStore } from './useTagStore';
import { useGachaStore } from './useGachaStore';

export const MEMO_MAX_LENGTH = 100;
export const MEMO_MAX_LINES = 3;
export const emptyDraft = (): DiaryDraft => ({
  recordDate: null,
  emotion: null,
  tags: emptySelection(),
  memo: '',
});
interface AppState {
  draft: DiaryDraft;
  entries: DiaryEntry[];
  // 그림 요청(접수 전) 상태. 접수 뒤의 그림 상태는 기록(entry.generation)에 있다.
  requestStatus: 'idle' | 'requesting' | 'error';
  requestError: string;
  requestKey: string | null;
  // 최종 저장 상태. 그림 성공과는 별개다.
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string;
  saveKey: string | null;
  // 재시도 불가 실패 뒤 다시 작성 중인 기록. 이 기록만 잠금이 풀린다.
  rewriteId: string | null;
  tagNotice: string;
  session: number;
  resetSession: () => void;
  resetDraft: () => void;
  selectEmotion: (emotion: Emotion) => void;
  toggleTag: (tag: PresetTag) => void;
  toggleCustomTag: (id: string) => void;
  selectCustomTag: (id: string) => void;
  forgetCustomTag: (id: string) => void;
  setMemo: (memo: string) => void;
  startGeneration: () => Promise<DiaryEntry | null>;
  generateImage: (id: string) => Promise<void>;
  resumeImage: (id: string) => Promise<void>;
  reopenDraft: (id: string) => boolean;
  completeDiary: (id: string) => Promise<DiaryEntry | null>;
}
type RecordState = Pick<
  AppState,
  'draft' | 'entries' | 'requestStatus' | 'rewriteId'
>;
// 지금 작성 중인 날의 기록 (하루 1기록).
export const recordEntry = (state: Pick<AppState, 'draft' | 'entries'>) => {
  const date = allowedRecordDate(state.draft.recordDate);
  return state.entries.find(item => item.date === date);
};
// 그림을 요청한 뒤에는 기분·태그를 바꿀 수 없다. 재시도 불가 실패로 다시 작성하는 기록만 예외다.
export function isDraftLocked(state: RecordState) {
  if (state.requestStatus === 'requesting') return true;
  const entry = recordEntry(state);
  return !!entry && entry.id !== state.rewriteId;
}
export function entryPhase(entry: DiaryEntry, saving: boolean): RecordPhase {
  if (entry.status === 'completed') return 'completed';
  if (entry.generation === 'generating') return 'generating';
  if (entry.generation === 'failed') return 'failed';
  return saving ? 'saving' : 'reviewing';
}
// 다시 그리기는 일시적인 실패에서, 남은 횟수가 있을 때만 된다.
export const canRetry = (entry: DiaryEntry) =>
  entry.generation === 'failed' &&
  entry.status === 'draft' &&
  (!entry.failure ||
    (entry.failure.retryable && entry.failure.remainingRetries > 0));
// 다시 작성하기는 다시 그려도 소용없는 실패(유해 판정 등)에서만 된다.
export const canRewrite = (entry: DiaryEntry) =>
  entry.generation === 'failed' &&
  entry.status === 'draft' &&
  entry.failure?.retryable === false;
export const limitMemo = (memo: string) =>
  memo
    .split('\n')
    .slice(0, MEMO_MAX_LINES)
    .join('\n')
    .slice(0, MEMO_MAX_LENGTH);

const initialRecordState = () => ({
  draft: emptyDraft(),
  requestStatus: 'idle' as const,
  requestError: '',
  requestKey: null,
  saveStatus: 'idle' as const,
  saveError: '',
  saveKey: null,
  rewriteId: null,
  tagNotice: '',
});
const generations = new Map<string, Promise<void>>();
export const useAppStore = create<AppState>((set, get) => {
  const patchEntry = (id: string, patch: Partial<DiaryEntry>) =>
    set(state => ({
      entries: state.entries.map(item =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  // 그림 완성을 기다린다. 같은 기록의 작업은 하나만 돌고, 계정이 바뀐 뒤의 결과는 버린다.
  const watch = (id: string, before?: () => Promise<void>) => {
    const running = generations.get(id);
    if (running) return running;
    const session = get().session;
    patchEntry(id, { generation: 'generating', failure: null });
    const job = (async () => {
      let patch: Partial<DiaryEntry> = { generation: 'ready', failure: null };
      try {
        if (before) await before();
        await diaryGateway.generate({
          diaryId: id,
          companionId:
            get().entries.find(entry => entry.id === id)?.companionId ??
            'default',
        });
      } catch (error) {
        patch = { generation: 'failed', failure: toGenerationFailure(error) };
      }
      if (get().session !== session) return;
      generations.delete(id);
      patchEntry(id, patch);
    })();
    generations.set(id, job);
    return job;
  };
  const editDraft = (update: (draft: DiaryDraft) => Partial<DiaryDraft>) => {
    if (isDraftLocked(get())) return;
    set(state => ({
      draft: { ...state.draft, ...update(state.draft) },
      // 고른 내용이 바뀌면 다른 요청이므로 새 Idempotency-Key를 쓴다.
      requestKey: null,
    }));
  };
  return {
    ...initialRecordState(),
    entries: createMockEntries(),
    session: 0,
    resetSession: () => {
      generations.clear();
      set(state => ({
        ...initialRecordState(),
        entries: createMockEntries(),
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
      const { selection, cleared } = clearBlockedPlace(next);
      editDraft(() => ({ tags: selection }));
      set({
        tagNotice: cleared ? '활동·동행과 맞지 않아 장소 선택을 풀었어요.' : '',
      });
    },
    toggleCustomTag: id =>
      editDraft(draft => ({ tags: toggleCustomTag(draft.tags, id) })),
    selectCustomTag: id =>
      editDraft(draft => ({ tags: selectCustomTag(draft.tags, id) })),
    forgetCustomTag: id =>
      editDraft(draft => ({
        tags: {
          ...draft.tags,
          custom: draft.tags.custom.filter(item => item !== id),
        },
      })),
    setMemo: memo => {
      if (get().saveStatus === 'saving') return;
      set(state => ({
        draft: { ...state.draft, memo: limitMemo(memo) },
        saveKey: null,
      }));
    },
    startGeneration: async () => {
      const state = get();
      if (state.requestStatus === 'requesting') return null;
      const existing = recordEntry(state);
      if (existing && existing.id !== state.rewriteId) return null;
      const companionId = useGachaStore.getState().equippedId;
      const library = useTagStore.getState().tags;
      const recordDate = allowedRecordDate(state.draft.recordDate);
      const draft = { ...state.draft, recordDate };
      const request = toGenerationRequest(draft, library, recordDate);
      if (!request) return null;
      const tags = toDiaryTags(draft.tags, library);
      const requestKey = state.requestKey ?? createRequestKey();
      const session = state.session;
      set({ draft, requestStatus: 'requesting', requestError: '', requestKey });
      try {
        const result = existing
          ? await diaryGateway.rewrite(existing.id, request, tags, requestKey)
          : await diaryGateway.start(request, tags, requestKey);
        if (get().session !== session) return null;
        const entry = { ...result, companionId };
        set(current => ({
          entries: [
            entry,
            ...current.entries.filter(item => item.date !== entry.date),
          ],
          draft: { ...current.draft, memo: '' },
          requestStatus: 'idle',
          requestKey: null,
          rewriteId: null,
          tagNotice: '',
          saveStatus: 'idle',
          saveError: '',
          saveKey: null,
        }));
        void watch(entry.id);
        return entry;
      } catch (error) {
        // 요청 키는 남겨 두고, 같은 선택으로 다시 보내면 같은 키를 쓴다.
        if (get().session === session)
          set({
            requestStatus: 'error',
            requestError: errorMessage(error, '그림을 부탁하지 못했어요.'),
          });
        return null;
      }
    },
    generateImage: id => {
      const running = generations.get(id);
      if (running) return running;
      const entry = get().entries.find(item => item.id === id);
      if (!entry || !canRetry(entry)) return Promise.resolve();
      const requestKey = createRequestKey();
      return watch(id, () => diaryGateway.retry(id, requestKey));
    },
    // 그리는 중인 기록의 결과를 다시 기다린다 (앱 재진입·개발용 화면).
    resumeImage: id => {
      const entry = get().entries.find(item => item.id === id);
      if (!entry || entry.generation !== 'generating') return Promise.resolve();
      return watch(id);
    },
    reopenDraft: id => {
      const entry = get().entries.find(item => item.id === id);
      if (!entry || !canRewrite(entry)) return false;
      set({
        ...initialRecordState(),
        rewriteId: id,
        draft: {
          recordDate: entry.date,
          emotion: entry.emotion,
          tags: selectionFromTags(entry.tags, useTagStore.getState().tags),
          memo: '',
        },
      });
      return true;
    },
    completeDiary: async id => {
      const state = get();
      if (state.saveStatus === 'saving') return null;
      const entry = state.entries.find(item => item.id === id);
      if (!entry || entryPhase(entry, false) !== 'reviewing') return null;
      const saveKey = state.saveKey ?? createRequestKey();
      const session = state.session;
      set({ saveStatus: 'saving', saveError: '', saveKey });
      try {
        const saved = await diaryGateway.complete(
          id,
          state.draft.memo,
          saveKey,
        );
        if (get().session !== session) return null;
        patchEntry(id, {
          memo: saved.memo,
          title: saved.memo || entry.title,
          status: 'completed',
        });
        set(initialRecordState());
        return get().entries.find(item => item.id === id) ?? null;
      } catch (error) {
        if (get().session === session)
          set({
            saveStatus: 'error',
            saveError: errorMessage(error, '기록을 저장하지 못했어요.'),
          });
        return null;
      }
    },
  };
});
