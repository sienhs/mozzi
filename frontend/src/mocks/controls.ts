import { create } from 'zustand';

export type MockOperation = 'login' | 'save' | 'generation' | 'search';
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
