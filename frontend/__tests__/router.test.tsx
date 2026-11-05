import { useQueryClient } from '@tanstack/react-query';
import { renderRouter, screen } from 'expo-router/testing-library';
import { queryClient } from '@/services/queryClient';

test('opens the welcome screen at the root route', async () => {
  const result = await renderRouter('./src/app', { initialUrl: '/' });

  expect(result.getPathname()).toBe('/');
  // 글자 제목 대신 로고 그림을 둔다.
  expect(screen.getByLabelText('오늘의 모찌')).toBeOnTheScreen();
  expect(screen.getByText(/뽑기권 20장/)).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  ).toBeOnTheScreen();
});

test('provides the shared QueryClient without creating queries', async () => {
  let providedClient: typeof queryClient | undefined;

  function ClientProbe() {
    providedClient = useQueryClient();
    return null;
  }

  await renderRouter(
    { appDir: './src/app', overrides: { index: ClientProbe } },
    { initialUrl: '/' },
  );

  expect(providedClient).toBe(queryClient);
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
