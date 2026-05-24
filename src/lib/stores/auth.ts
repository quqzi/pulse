import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';

export type AuthMode = 'loading'|'guest'|'authenticated';

export interface AuthState {
  mode: AuthMode;
  user: User | null;
  name: string;
}

export const auth = writable<AuthState>({ mode: 'loading', user: null, name: 'Student' });
