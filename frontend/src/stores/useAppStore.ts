import { create } from 'zustand';
import type {
  Activity,
  DiaryDraft,
  DiaryEntry,
  Emotion,
  Profile,
} from '@/types/diary';
import { createMockEntries } from '@/mocks/diaries';
import { mockDiaryService } from '@/mocks/services';

export const emptyDraft = (): DiaryDraft => ({
  emotion: null,
  activities: [],
  memo: '',
});
interface AppState {
  profile: Profile | null;
  draft: DiaryDraft;
  entries: DiaryEntry[];
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string;
  session: number;
  login: (nickname: string, email?: string) => void;
  logout: () => void;
  selectEmotion: (emotion: Emotion) => void;
  toggleActivity: (activity: Activity) => void;
  setMemo: (memo: string) => void;
  resetDraft: () => void;
  saveDiary: () => Promise<DiaryEntry | null>;
  generateImage: (id: string) => Promise<void>;
}
const generations = new Map<string, Promise<void>>();
export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  draft: emptyDraft(),
  entries: createMockEntries(),
  saveStatus: 'idle',
  saveError: '',
  session: 0,
  login: (nickname, email = 'haru@gmail.com') =>
    set({ profile: { nickname, email } }),
  logout: () =>
    set(state => ({
      profile: null,
      draft: emptyDraft(),
      saveStatus: 'idle',
      saveError: '',
      session: state.session + 1,
    })),
  selectEmotion: emotion =>
    set(state => ({ draft: { ...state.draft, emotion } })),
  toggleActivity: activity =>
    set(state => ({
      draft: {
        ...state.draft,
        activities: state.draft.activities.includes(activity)
          ? state.draft.activities.filter(value => value !== activity)
          : [...state.draft.activities, activity],
      },
    })),
  setMemo: memo =>
    set(state => ({ draft: { ...state.draft, memo: memo.slice(0, 100) } })),
  resetDraft: () =>
    set({ draft: emptyDraft(), saveStatus: 'idle', saveError: '' }),
  saveDiary: async () => {
    if (get().saveStatus === 'saving') return null;
    const session = get().session;
    const snapshot = {
      ...get().draft,
      activities: [...get().draft.activities],
    };
    set({ saveStatus: 'saving', saveError: '' });
    try {
      const entry = await mockDiaryService.save(snapshot);
      if (get().session !== session) return null;
      set(state => ({
        entries: [
          entry,
          ...state.entries.filter(item => item.date !== entry.date),
        ],
        draft: emptyDraft(),
        saveStatus: 'idle',
      }));
      void get().generateImage(entry.id);
      return entry;
    } catch (error) {
      if (get().session === session)
        set({
          saveStatus: 'error',
          saveError:
            error instanceof Error
              ? error.message
              : '기록을 저장하지 못했어요.',
        });
      return null;
    }
  },
  generateImage: id => {
    const existing = generations.get(id);
    if (existing) return existing;
    const entry = get().entries.find(item => item.id === id);
    if (!entry) return Promise.resolve();
    set(state => ({
      entries: state.entries.map(item =>
        item.id === id ? { ...item, generation: 'generating' } : item,
      ),
    }));
    const job = (async () => {
      let generation: DiaryEntry['generation'] = 'ready';
      try {
        await mockDiaryService.generate();
      } catch {
        generation = 'failed';
      }
      set(state => ({
        entries: state.entries.map(item =>
          item.id === id ? { ...item, generation } : item,
        ),
      }));
      generations.delete(id);
    })();
    generations.set(id, job);
    return job;
  },
}));
