import { create } from 'zustand';
import type { CustomTag, CustomTagCategory, PresetTag } from '@/types/diary';
import { tagGateway } from '@/services/tagGateway';
import { errorMessage } from '@/services/diaryErrors';
import { checkCustomTag } from '@/features/diary/tagRules';

// 내 태그 목록 (계정별 서버 저장). 계정이 바뀌면 resetSession으로 지우고, 그 전에 보낸 요청의 응답은 버린다.
export type AddTagResult =
  | { kind: 'custom'; id: string }
  | { kind: 'preset'; tag: PresetTag }
  | { kind: 'none' };
interface TagState {
  tags: CustomTag[];
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  adding: boolean;
  removing: string | null;
  error: string;
  session: number;
  load: () => Promise<void>;
  add: (raw: string, category?: CustomTagCategory) => Promise<AddTagResult>;
  remove: (id: string) => Promise<boolean>;
  clearError: () => void;
  resetSession: () => void;
}
export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loadStatus: 'idle',
  adding: false,
  removing: null,
  error: '',
  session: 0,
  load: async () => {
    if (get().loadStatus === 'loading') return;
    const session = get().session;
    set({ loadStatus: 'loading' });
    try {
      const tags = await tagGateway.list();
      if (get().session !== session) return;
      set({ tags, loadStatus: 'ready' });
    } catch {
      if (get().session === session) set({ loadStatus: 'error' });
    }
  },
  add: async (raw, category = 'activity') => {
    if (get().adding) return { kind: 'none' };
    const check = checkCustomTag(raw, get().tags, category);
    if (check.kind === 'error') {
      set({ error: check.message });
      return { kind: 'none' };
    }
    set({ error: '' });
    if (check.kind === 'preset') return { kind: 'preset', tag: check.tag };
    if (check.kind === 'reuse') return { kind: 'custom', id: check.id };
    const session = get().session;
    set({ adding: true });
    try {
      const tag = await tagGateway.create(check.label, category);
      if (get().session !== session) return { kind: 'none' };
      set(state => ({
        tags: state.tags.some(item => item.id === tag.id)
          ? state.tags
          : [...state.tags, tag],
      }));
      return { kind: 'custom', id: tag.id };
    } catch (error) {
      if (get().session === session)
        set({ error: errorMessage(error, '태그를 저장하지 못했어요.') });
      return { kind: 'none' };
    } finally {
      if (get().session === session) set({ adding: false });
    }
  },
  remove: async id => {
    if (get().removing) return false;
    const session = get().session;
    set({ removing: id, error: '' });
    try {
      await tagGateway.remove(id);
      if (get().session !== session) return false;
      set(state => ({ tags: state.tags.filter(tag => tag.id !== id) }));
      return true;
    } catch (error) {
      if (get().session === session)
        set({ error: errorMessage(error, '태그를 지우지 못했어요.') });
      return false;
    } finally {
      if (get().session === session) set({ removing: null });
    }
  },
  clearError: () => set({ error: '' }),
  resetSession: () => {
    tagGateway.reset?.();
    set(state => ({
      tags: [],
      loadStatus: 'idle',
      adding: false,
      removing: null,
      error: '',
      session: state.session + 1,
    }));
  },
}));
