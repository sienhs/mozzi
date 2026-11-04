import { useEffect, useRef, useState } from 'react';
import { saveDiaryImage, shareDiary } from '@/services/diaryImage';
import type { DiaryEntry } from '@/types/diary';

const notices = {
  saved: '사진 앱에 저장했어요',
  denied: '사진을 저장하려면 권한이 필요해요',
  blocked: '설정에서 사진 권한을 허용해 주세요',
  failed: '그림을 저장하지 못했어요',
  shareFailed: '그림을 보내지 못했어요',
} as const;

// 그림 저장·공유 버튼이 함께 쓴다. 하나가 진행 중이면 다른 버튼도 잠시 막는다.
export function useDiaryImageActions(entry: DiaryEntry | null | undefined) {
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);
  const picture =
    entry?.generation === 'ready' && entry.imageUrl ? entry.imageUrl : null;
  const run = async (kind: 'save' | 'share') => {
    if (!entry || busy) return;
    setBusy(kind);
    setNotice(null);
    let message: string | null = null;
    if (kind === 'save') {
      if (picture) message = notices[await saveDiaryImage(picture, entry.date)];
    } else if (!(await shareDiary(entry))) message = notices.shareFailed;
    if (!alive.current) return;
    setBusy(null);
    setNotice(message);
  };
  return {
    // 그림이 있어야 저장할 수 있다. 공유는 그림이 없으면 글로 보낸다.
    canSave: !!picture,
    busy,
    notice,
    save: () => void run('save'),
    share: () => void run('share'),
  };
}
