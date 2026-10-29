import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { diaryKeys } from '@/services/diaryApi';
import { queryClient } from '@/services/queryClient';
import { isDraftLocked, useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { HomeResponse } from '@/types/server';

// 오늘 일기가 이미 서버에 있으면(하루 1기록) 기분·태그 화면을 열지 않는다 (딥 링크 포함). 그 기록의 생성 화면으로 보낸다.
// 처음 열 때만 검사한다: 이 화면에서 일기가 만들어지는 순간 스스로 다른 곳으로 보내지 않기 위해서다.
export function useRecordGuard() {
  const [lockedEntry] = useState(() => {
    if (isDraftLocked(useAppStore.getState())) return 'pending';
    const memberId = useAuthStore.getState().member?.memberId;
    const home =
      memberId === undefined
        ? undefined
        : queryClient.getQueryData<HomeResponse>(diaryKeys.home(memberId));
    return home?.todayDiary ? String(home.todayDiary.diaryId) : null;
  });
  useEffect(() => {
    if (!lockedEntry) return;
    if (lockedEntry === 'pending') router.dismissTo('/home');
    else
      router.replace({
        pathname: '/record/generation',
        params: { id: lockedEntry },
      });
  }, [lockedEntry]);
  return !!lockedEntry;
}
