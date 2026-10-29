import { create } from 'zustand';

// 아직 서버 API가 없는 기능의 Mock 실패 스위치. 일기·태그·그림은 실제 API를 쓰므로 여기 없다.
export type MockOperation = 'login';
interface MockControls {
  failures: Partial<Record<MockOperation, boolean>>;
  failNext: (operation: MockOperation) => void;
  consumeFailure: (operation: MockOperation) => boolean;
  reset: () => void;
}
export const useMockControls = create<MockControls>((set, get) => ({
  failures: {},
  failNext: operation =>
    set({ failures: { ...get().failures, [operation]: true } }),
  consumeFailure: operation => {
    const failed = !!get().failures[operation];
    set({ failures: { ...get().failures, [operation]: false } });
    return failed;
  },
  reset: () => set({ failures: {} }),
}));
