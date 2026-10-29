import { useMockControls } from './controls';

export const mockDelay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));
export const mockAuthService = {
  async signIn() {
    const failed = useMockControls.getState().consumeFailure('login');
    await mockDelay(650);
    if (failed)
      throw new Error('로그인을 마치지 못했어요. 다시 시도해 주세요.');
    return { email: 'haru@gmail.com' };
  },
};
