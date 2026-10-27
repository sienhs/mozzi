import { create } from 'axios';

export const api = create({
  baseURL:
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    undefined,
  timeout: 10000,
  headers: { Accept: 'application/json' },
});
