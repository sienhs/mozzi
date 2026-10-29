import type { DiaryEntry } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/useAuthStore';

// 다시 그리기(실패) · 다시 보내기(요청 유실). 처음 요청한 장면과 모찌를 그대로 보낸다.
// 보관한 장면이 없으면 화면이 대표 활동을 다시 고르게 하고 whatMyIconId를 넘긴다.
export function sendImageFor(entry: DiaryEntry, whatMyIconId?: number) {
  const memberId = useAuthStore.getState().member?.memberId;
  if (memberId === undefined || !entry.serverId) return;
  void useAppStore.getState().sendImage(memberId, entry.serverId, whatMyIconId);
}
