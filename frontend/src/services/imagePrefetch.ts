import { Image } from 'expo-image';

// 그림을 메모리·디스크 캐시에 미리 받아 둔다. 실패해도 화면이 그때 다시 받는다.
export function prefetchImages(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return Promise.resolve(false);
  return Image.prefetch(unique, 'memory-disk').catch(() => false);
}
