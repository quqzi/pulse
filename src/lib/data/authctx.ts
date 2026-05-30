import { derived, get } from 'svelte/store';
import { auth, type AuthState } from '$lib/stores/auth';

export const authCtx = derived(auth, ($auth: AuthState) => {
  if ($auth.mode === 'loading') return { userId: 'guest', mode: 'guest' as const };
  return {
    userId: $auth.mode === 'guest' ? 'guest' : ($auth.user?.id ?? ''),
    mode: $auth.mode as 'guest' | 'authenticated',
  };
});

export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return get(authCtx);
}
