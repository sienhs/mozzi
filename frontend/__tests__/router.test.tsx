import { useQueryClient } from '@tanstack/react-query';
import { renderRouter, screen } from 'expo-router/testing-library';
import { queryClient } from '@/services/queryClient';

test('opens the welcome screen at the root route', async () => {
  const result = await renderRouter('./src/app', { initialUrl: '/' });

  expect(result.getPathname()).toBe('/');
  expect(screen.getByText('오늘의 모찌')).toBeOnTheScreen();
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
