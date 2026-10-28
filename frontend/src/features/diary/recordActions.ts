import { router } from 'expo-router';
import type { DiaryEntry } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';

// 다시 작성하기 (재시도 불가 실패): 이전 선택을 채운 기분 화면부터 다시 연다.
// 생성 화면에서는 그 화면을 기분 화면으로 바꾸고, 홈·상세에서는 위에 연다.
export function rewriteEntry(entry: DiaryEntry, from: 'generation' | 'list') {
  if (!useAppStore.getState().reopenDraft(entry.id)) return;
  if (from === 'generation') router.replace('/record/emotion');
  else router.push('/record/emotion');
}
// 다시 그리기 (일시적인 실패): 같은 태그로 그림만 다시 요청한다.
export function retryEntry(entry: DiaryEntry) {
  void useAppStore.getState().generateImage(entry.id);
}
