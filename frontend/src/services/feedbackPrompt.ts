import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 피드백 부탁 팝업. 일기를 남기고 뽑기까지 해 본 회원에게 홈에서 딱 한 번 띄운다.
// 뽑기 여부와 띄웠는지를 회원별로 기기에 남긴다. 저장에 실패하면 이번 실행 동안만 기억한다.
interface Saved {
  pulled?: boolean;
  shown?: boolean;
}
const keyOf = (memberId: number) => `mozzi.feedback-prompt.v1.${memberId}`;
const memory = new Map<number, Saved>();

async function read(memberId: number): Promise<Saved> {
  const cached = memory.get(memberId);
  if (cached) return cached;
  let saved: Saved = {};
  if (Platform.OS !== 'web') {
    try {
      const raw = await SecureStore.getItemAsync(keyOf(memberId));
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = {};
    }
  }
  // 읽는 사이에 바뀐 값이 있으면 그쪽을 남긴다.
  const merged = { ...saved, ...memory.get(memberId) };
  memory.set(memberId, merged);
  return merged;
}
async function update(memberId: number, change: Saved) {
  const next = { ...(await read(memberId)), ...change };
  memory.set(memberId, next);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(keyOf(memberId), JSON.stringify(next));
  } catch {
    /* 앱을 다시 켜면 한 번 더 뜰 수 있다. */
  }
}

export const feedbackPrompt = {
  markPulled: (memberId: number) => update(memberId, { pulled: true }),
  markShown: (memberId: number) => update(memberId, { shown: true }),
  async due(memberId: number) {
    const saved = await read(memberId);
    return !!saved.pulled && !saved.shown;
  },
};
