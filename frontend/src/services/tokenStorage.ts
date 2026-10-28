import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isAuthTokens, type AuthTokens } from '@/types/auth';
import { getApiBaseUrl } from './authConfig';
import { AuthError } from './authErrors';

const key = 'mozzi.auth.session.v1';
export const tokenStorage = {
  async read(): Promise<AuthTokens | null> {
    if (Platform.OS === 'web') return null;
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      if (record.baseURL === getApiBaseUrl() && isAuthTokens(record.tokens))
        return record.tokens;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    await SecureStore.deleteItemAsync(key);
    return null;
  },
  async write(tokens: AuthTokens) {
    if (Platform.OS === 'web')
      throw new AuthError(
        'UNSUPPORTED_PLATFORM',
        '모바일 앱에서 로그인해 주세요.',
      );
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({ baseURL: getApiBaseUrl(), tokens }),
    );
  },
  async clear() {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
  },
};
