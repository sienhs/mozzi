import { authSession } from '@/services/authSession';
import { useAuthStore } from '@/stores/useAuthStore';

// Explicit development/test fixture; production sign-in never falls back to this.
export function setAuthPreview(
  status: 'signedOut' | 'authenticated' | 'signupRequired' = 'authenticated',
) {
  if (!__DEV__) throw new Error('Development preview is unavailable.');
  authSession.begin();
  useAuthStore.setState({
    status,
    pending: false,
    error: '',
    member:
      status === 'authenticated'
        ? { memberId: 0, nickname: '하루', email: 'preview@example.invalid' }
        : null,
    ticket:
      status === 'signupRequired'
        ? {
            signupToken: 'development-preview',
            signupExpiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : null,
  });
}
