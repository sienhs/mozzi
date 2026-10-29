import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { todayKey } from '@/constants/date';
import type { Companion } from '@/types/companion';
import type { DiaryTag } from '@/types/diary';
import type { ImageRequestBody } from '@/types/server';

// 그림 요청 때 고른 장면(대표 활동·장소·동행·날씨)과 장착 모찌. 서버는 이전 요청 값을 돌려주지 않으므로
// 다시 그리기·다시 보내기에서 같은 장면을 보내려면 앱이 보관해야 한다. 앱이 꺼져도 남도록 기기에 저장한다.
// 그림은 그날 일기에만 요청할 수 있어 오늘 것만 남긴다. 회원별 키라 다른 계정은 읽지 않는다.
export interface ImageRequestSnapshot {
  diaryId: number;
  recordDate: string;
  body: ImageRequestBody;
  // 요청할 때 그 감정에 고른 모찌(서버가 그림에 그려 넣는다). 화면의 생성 중 그림에 쓴다.
  companion: Companion | null;
  imageTags: DiaryTag[];
}
type Saved = Record<string, ImageRequestSnapshot>;
const keyOf = (memberId: number) => `mozzi.image-requests.v1.${memberId}`;
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
  const today = todayKey();
  saved = Object.fromEntries(
    Object.entries(saved)
      .filter(([, item]) => item?.recordDate === today)
      // 예전 형식(companionId 문자열)은 모찌 정보가 없으니 기본 모찌로 본다.
      .map(([key, item]) => [
        key,
        { ...item, companion: item.companion ?? null },
      ]),
  );
  memory.set(memberId, saved);
  return saved;
}
async function write(memberId: number, saved: Saved) {
  memory.set(memberId, saved);
  if (Platform.OS === 'web') return;
  // 저장에 실패해도 이번 실행 동안은 메모리 값으로 다시 보낼 수 있다.
  try {
    await SecureStore.setItemAsync(keyOf(memberId), JSON.stringify(saved));
  } catch {
    /* 앱이 꺼지면 복구할 때 대표 활동을 다시 고르게 된다. */
  }
}

export const imageRequests = {
  async get(memberId: number, diaryId: number) {
    return (await read(memberId))[String(diaryId)] ?? null;
  },
  async save(memberId: number, snapshot: ImageRequestSnapshot) {
    const saved = await read(memberId);
    await write(memberId, { ...saved, [String(snapshot.diaryId)]: snapshot });
  },
  // 계정이 바뀌면 메모리만 비운다. 기기 저장분은 같은 회원이 다시 로그인했을 때 복구에 쓴다.
  resetMemory() {
    memory.clear();
  },
};
