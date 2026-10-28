import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { authConfig } from './authConfig';
import { AuthError } from './authErrors';

interface GoogleModule {
  signInAsync(clientId: string): Promise<string | null>;
  clearAsync(): Promise<void>;
}
export const googleAuth = {
  async signIn(): Promise<string | null> {
    if (Platform.OS !== 'android')
      throw new AuthError(
        'UNSUPPORTED_PLATFORM',
        'Google 로그인은 현재 Android 앱에서 사용할 수 있어요.',
      );
    if (!authConfig.webClientId.endsWith('.apps.googleusercontent.com'))
      throw new AuthError(
        'GOOGLE_CONFIG',
        'Google 로그인 연결을 준비하고 있어요.',
      );
    const native = requireOptionalNativeModule<GoogleModule>('MozziGoogleAuth');
    if (!native)
      throw new AuthError(
        'NATIVE_BUILD_REQUIRED',
        '로그인을 지원하는 최신 앱으로 업데이트해 주세요.',
      );
    return native.signInAsync(authConfig.webClientId);
  },
  async clear() {
    if (Platform.OS === 'android')
      await requireOptionalNativeModule<GoogleModule>(
        'MozziGoogleAuth',
      )?.clearAsync();
  },
};
