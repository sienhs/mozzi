import Constants from 'expo-constants';

// Priority:
// 1. EXPO_PUBLIC_API_BASE_URL in frontend/.env.local (e.g. a deployed server)
// 2. Development: the PC running `expo start` (same Wi-Fi as the phone), port 8080
const API_PORT = 8080;

function developmentApiBaseUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:${API_PORT}` : `http://localhost:${API_PORT}`;
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

export const appConfig = {
  apiBaseUrl: configuredApiBaseUrl || (__DEV__ ? developmentApiBaseUrl() : ''),
  requestTimeoutMs: 5000,
};
