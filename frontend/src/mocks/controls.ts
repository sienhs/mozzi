import { create } from 'zustand';

// start: 그림 요청 접수 · generation: 일시적인 그림 실패(다시 그리기) ·
// generationBlocked: 다시 그려도 소용없는 실패(유해 판정 등, 다시 작성하기) · complete: 최종 저장 · tag: 내 태그 추가
export type MockOperation =
  | 'login'
  | 'start'
  | 'generation'
  | 'generationBlocked'
  | 'complete'
  | 'tag'
  | 'search'
  | 'gacha'
  | 'equip';
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
