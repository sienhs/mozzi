import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { isDraftLocked, recordEntry, useAppStore } from '@/stores/useAppStore';

// 그림을 요청한 뒤에는 기분·태그 화면을 열지 않는다 (딥 링크 포함). 그 기록의 생성 화면으로 보낸다.
// 처음 열 때만 검사한다: 이 화면에서 그림 요청이 접수되는 순간 스스로 다른 곳으로 보내지 않기 위해서다.
export function useRecordGuard() {
  const [lockedEntry] = useState(() => {
    const state = useAppStore.getState();
    return isDraftLocked(state) ? (recordEntry(state)?.id ?? 'pending') : null;
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
