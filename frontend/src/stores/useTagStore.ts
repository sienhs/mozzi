import { create } from 'zustand';
import type {
  CustomTag,
  CustomTagCategory,
  PresetTag,
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
import { presetTags } from '@/constants/tags';
import { checkCustomTag, tagKey } from '@/features/diary/tagRules';

// 내 태그 목록 (서버 내 아이콘, 계정별). 계정이 바뀌면 resetSession으로 지우고, 그 전에 보낸 요청의 응답은 버린다.
// 기본 태그와 이름이 같은 아이콘은 그 기본 태그의 서버 ID로 쓰고 내 태그 목록에는 보이지 않는다.
export type AddTagResult =
  | { kind: 'custom'; id: string }
  | { kind: 'preset'; tag: PresetTag }
  | { kind: 'none' };
interface TagState {
  // 서버의 내 아이콘 전체 (기본 태그용 포함).
  icons: MyIcon[];
  // 화면에 보이는 내 태그.
  tags: CustomTag[];
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  adding: boolean;
  removing: string | null;
  error: string;
  session: number;
  load: () => Promise<void>;
  add: (raw: string, category?: CustomTagCategory) => Promise<AddTagResult>;
  remove: (id: string) => Promise<boolean>;
  // 고른 태그의 서버 아이콘 ID. 기본 태그는 없으면 만든다.
  ensureIcon: (tag: SelectableTag) => Promise<number>;
  clearError: () => void;
  resetSession: () => void;
}
const presetOf = (icon: MyIcon) =>
  presetTags.find(
    tag =>
      tag.category === tagCategoryOf[icon.category] &&
      tagKey(tag.label) === tagKey(icon.name),
  );
const toCustomTag = (icon: MyIcon): CustomTag => ({
  category: tagCategoryOf[icon.category],
  id: String(icon.myIconId),
  label: icon.name,
  key: tagKey(icon.name),
  createdAt: icon.createdAt,
});
const withIcons = (icons: MyIcon[]) => ({
  icons,
  tags: icons.filter(icon => !presetOf(icon)).map(toCustomTag),
});
const usedIn = (icons: MyIcon[], category: CustomTagCategory) =>
  icons.filter(icon => icon.category === iconCategoryOf[category]).length;
let loading: Promise<void> | null = null;
const creating = new Map<string, Promise<number>>();
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
      if (check.kind === 'preset') return { kind: 'preset', tag: check.tag };
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
      const category = tag.category;
      if (!('code' in tag)) {
        if (get().icons.some(icon => String(icon.myIconId) === tag.id))
          return Number(tag.id);
        throw new AuthError(
          'TAG_REMOVED',
          `‘${tag.label}’ 태그가 지워졌어요. 다른 태그를 골라 주세요.`,
        );
      }
      const find = () =>
        get().icons.find(
          icon =>
            icon.category === iconCategoryOf[category] &&
            tagKey(icon.name) === tagKey(tag.label),
        );
      const found = find();
      if (found) return found.myIconId;
      // 같은 기본 태그를 동시에 두 번 만들지 않는다.
      const running = creating.get(tag.id);
      if (running) return running;
      const session = get().session;
      const task = (async () => {
        try {
          const icon = await tagGateway.create(tag.label, category);
          if (get().session !== session)
            throw new AuthError('SESSION_CHANGED', '로그인 상태가 변경됐어요.');
          addIcon(icon);
          return icon.myIconId;
        } finally {
          creating.delete(tag.id);
        }
      })();
      creating.set(tag.id, task);
      return task;
    },
    clearError: () => set({ error: '' }),
    resetSession: () => {
      loading = null;
      creating.clear();
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
