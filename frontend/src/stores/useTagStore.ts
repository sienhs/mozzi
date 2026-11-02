import { create } from 'zustand';
import type {
  CustomTag,
  CustomTagCategory,
  SelectableTag,
} from '@/types/diary';
import type { MyIcon } from '@/types/server';
import {
  iconCategoryOf,
  isIconCategory,
  tagCategoryOf,
  tagGateway,
} from '@/services/tagGateway';
import { AuthError, apiErrorMessage } from '@/services/authErrors';
import { checkCustomTag, tagKey } from '@/features/diary/tagRules';

// 내 태그 목록 (서버 내 아이콘, 계정별). 계정이 바뀌면 resetSession으로 지우고, 그 전에 보낸 요청의 응답은 버린다.
// 기본 태그도 가입 때 서버가 만든 내 아이콘이라 다른 태그와 똑같이 보이고 지울 수 있다.
export type AddTagResult = { kind: 'custom'; id: string } | { kind: 'none' };
interface TagState {
  // 서버의 내 아이콘 전체.
  icons: MyIcon[];
  // 화면에 보이는 내 태그 (icons와 같은 목록).
  tags: CustomTag[];
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  adding: boolean;
  removing: string | null;
  error: string;
  session: number;
  load: () => Promise<void>;
  add: (raw: string, category?: CustomTagCategory) => Promise<AddTagResult>;
  remove: (id: string) => Promise<boolean>;
  // 고른 태그의 서버 아이콘 ID. 지워진 태그면 실패한다.
  ensureIcon: (tag: SelectableTag) => Promise<number>;
  clearError: () => void;
  resetSession: () => void;
}
const toCustomTag = (icon: MyIcon): CustomTag => ({
  category: tagCategoryOf[icon.category],
  id: String(icon.myIconId),
  label: icon.name,
  key: tagKey(icon.name),
  createdAt: icon.createdAt,
});
const withIcons = (icons: MyIcon[]) => ({
  icons,
  tags: icons.map(toCustomTag),
});
const usedIn = (icons: MyIcon[], category: CustomTagCategory) =>
  icons.filter(icon => icon.category === iconCategoryOf[category]).length;
let loading: Promise<void> | null = null;
export const useTagStore = create<TagState>((set, get) => {
  const addIcon = (icon: MyIcon) =>
    set(state =>
      withIcons(
        state.icons.some(item => item.myIconId === icon.myIconId)
          ? state.icons
          : [...state.icons, icon],
      ),
    );
  return {
    icons: [],
    tags: [],
    loadStatus: 'idle',
    adding: false,
    removing: null,
    error: '',
    session: 0,
    load: () => {
      if (loading) return loading;
      const session = get().session;
      set({ loadStatus: 'loading' });
      const task = (async () => {
        try {
          const icons = await tagGateway.list();
          if (get().session !== session) return;
          set({ ...withIcons(icons), loadStatus: 'ready' });
        } catch {
          if (get().session === session) set({ loadStatus: 'error' });
        }
      })();
      loading = task;
      void task.finally(() => {
        if (loading === task) loading = null;
      });
      return task;
    },
    add: async (raw, category = 'activity') => {
      if (get().adding) return { kind: 'none' };
      const check = checkCustomTag(
        raw,
        get().tags,
        category,
        usedIn(get().icons, category),
      );
      if (check.kind === 'error') {
        set({ error: check.message });
        return { kind: 'none' };
      }
      set({ error: '' });
      if (check.kind === 'reuse') return { kind: 'custom', id: check.id };
      const session = get().session;
      set({ adding: true });
      try {
        const icon = await tagGateway.create(check.label, category);
        if (get().session !== session) return { kind: 'none' };
        addIcon(icon);
        return { kind: 'custom', id: String(icon.myIconId) };
      } catch (error) {
        if (get().session === session)
          set({ error: apiErrorMessage(error, '태그를 저장하지 못했어요.') });
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
        await tagGateway.remove(Number(id));
        if (get().session !== session) return false;
        set(state =>
          withIcons(state.icons.filter(icon => String(icon.myIconId) !== id)),
        );
        return true;
      } catch (error) {
        if (get().session === session)
          set({ error: apiErrorMessage(error, '태그를 지우지 못했어요.') });
        return false;
      } finally {
        if (get().session === session) set({ removing: null });
      }
    },
    ensureIcon: async tag => {
      if (!isIconCategory(tag.category))
        throw new AuthError('INVALID_TAG', '날씨는 태그로 저장하지 않아요.');
      if (get().icons.some(icon => String(icon.myIconId) === tag.id))
        return Number(tag.id);
      throw new AuthError(
        'TAG_REMOVED',
        `‘${tag.label}’ 태그가 지워졌어요. 다른 태그를 골라 주세요.`,
      );
    },
    clearError: () => set({ error: '' }),
    resetSession: () => {
      loading = null;
      set(state => ({
        icons: [],
        tags: [],
        loadStatus: 'idle',
        adding: false,
        removing: null,
        error: '',
        session: state.session + 1,
      }));
    },
  };
});
