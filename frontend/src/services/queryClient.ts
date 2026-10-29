import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: false },
    mutations: { retry: false },
  },
});

// React Native에는 창 focus 이벤트가 없다. 앱이 다시 활성화되면 focus로 알려
// refetchOnWindowFocus(홈 재확인)와 백그라운드 중 폴링 정지가 동작하게 한다.
if (Platform.OS !== 'web')
  focusManager.setEventListener(handleFocus => {
    const subscription = AppState.addEventListener('change', state =>
      handleFocus(state === 'active'),
    );
    return () => subscription.remove();
  });
