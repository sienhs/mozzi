import { create, type InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from './authConfig';
import { authSession } from './authSession';
import { errorCode, isSessionRejected } from './authErrors';

interface SessionRequest extends InternalAxiosRequestConfig {
  sessionVersion?: number;
  sentToken?: string;
  authRetried?: boolean;
}
export const api = create({
  timeout: 10000,
  headers: { Accept: 'application/json' },
});
let onRejected: (() => Promise<void>) | undefined;
export const setSessionRejectedHandler = (handler: () => Promise<void>) => {
  onRejected = handler;
};
api.interceptors.request.use((config: SessionRequest) => {
  config.baseURL = getApiBaseUrl();
  config.sessionVersion ??= authSession.version();
  authSession.assert(config.sessionVersion);
  const token = authSession.current()?.accessToken;
  config.sentToken = token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  else config.headers.delete('Authorization');
  return config;
});
api.interceptors.response.use(
  response => {
    const config = response.config as SessionRequest;
    if (config.sessionVersion !== undefined)
      authSession.assert(config.sessionVersion);
    return response;
  },
  async error => {
    const config = error.config as SessionRequest | undefined;
    if (!config) throw error;
    authSession.assert(config.sessionVersion ?? -1);
    if (errorCode(error) === 'ACCESS_TOKEN_EXPIRED' && !config.authRetried) {
      config.authRetried = true;
      try {
        if (authSession.current()?.accessToken === config.sentToken)
          await authSession.refreshTokens();
        authSession.assert(config.sessionVersion!);
        return await api.request(config);
      } catch (refreshError) {
        if (isSessionRejected(refreshError)) await onRejected?.();
        throw refreshError;
      }
    }
    if (
      isSessionRejected(error) ||
      (config.authRetried && errorCode(error) === 'ACCESS_TOKEN_EXPIRED')
    )
      await onRejected?.();
    throw error;
  },
);
