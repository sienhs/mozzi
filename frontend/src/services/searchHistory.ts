import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 감정 검색에서 최근에 물어본 질문. 서버는 지난 질문을 돌려주지 않으므로 기기에 남겨 다시 누르게 한다.
// 회원별 키라 다른 계정의 질문은 보이지 않는다. 저장에 실패해도 이번 실행 동안은 메모리 값을 쓴다.
export const SEARCH_HISTORY_MAX = 6;
const keyOf = (memberId: number) => `mozzi.search-history.v1.${memberId}`;
const memory = new Map<number, string[]>();

async function read(memberId: number): Promise<string[]> {
  const cached = memory.get(memberId);
  if (cached) return cached;
  let saved: string[] = [];
  if (Platform.OS !== 'web') {
    try {
      const raw = await SecureStore.getItemAsync(keyOf(memberId));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed))
        saved = parsed
          .filter((item): item is string => typeof item === 'string')
          .slice(0, SEARCH_HISTORY_MAX);
    } catch {
      saved = [];
    }
  }
  memory.set(memberId, saved);
  return saved;
}
async function write(memberId: number, list: string[]) {
  memory.set(memberId, list);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(keyOf(memberId), JSON.stringify(list));
  } catch {
    /* 다음 실행에서는 최근 질문이 비어 보인다. */
  }
}

export const searchHistory = {
  read,
  // 같은 질문은 맨 앞으로 올리고, 오래된 것부터 밀어낸다.
  async add(memberId: number, question: string) {
    const list = await read(memberId);
    const next = [question, ...list.filter(item => item !== question)].slice(
      0,
      SEARCH_HISTORY_MAX,
    );
    await write(memberId, next);
    return next;
  },
  async remove(memberId: number, question: string) {
    const next = (await read(memberId)).filter(item => item !== question);
    await write(memberId, next);
    return next;
  },
  async clear(memberId: number) {
    await write(memberId, []);
    return [];
  },
  // 테스트에서 계정 사이 메모리를 비운다.
  reset() {
    memory.clear();
  },
};
