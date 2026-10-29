import { create } from 'zustand';
import { authErrorMessage } from '@/services/authErrors';
import { fetchMeta } from '@/services/metaApi';
import type { MetaResponse } from '@/types/server';
import {
  installedAppVersion,
  updateRequirement,
  type UpdateRequirement,
} from '@/utils/appVersion';

// 앱 메타(GET /meta). 계정과 무관하므로 로그인·로그아웃 때 비우지 않는다(queryClient.clear 대상이 아님).
// 실패하면 이전 값이나 기본값으로 채우지 않고 error로 남긴다.
interface MetaState {
  meta: MetaResponse | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  update: UpdateRequirement;
  // 권장 업데이트 안내를 이번 실행에서 닫았는지.
  updateDismissed: boolean;
  load: () => Promise<MetaResponse | null>;
  dismissUpdate: () => void;
}
let loading: Promise<MetaResponse | null> | null = null;
export const useMetaStore = create<MetaState>((set, get) => ({
  meta: null,
  status: 'idle',
  error: '',
  update: 'none',
  updateDismissed: false,
  // 동시에 여러 곳에서 불러도 요청은 하나만 보낸다.
  load: () => {
    if (loading) return loading;
    set({ status: 'loading', error: '' });
    const task = (async () => {
      try {
        const meta = await fetchMeta();
        set({
          meta,
          status: 'ready',
          update: updateRequirement(installedAppVersion(), meta),
        });
        return meta;
      } catch (error) {
        set({ status: 'error', error: authErrorMessage(error) });
        return null;
      } finally {
        loading = null;
      }
    })();
    loading = task;
    return task;
  },
  dismissUpdate: () => {
    if (get().update === 'recommended') set({ updateDismissed: true });
  },
}));
