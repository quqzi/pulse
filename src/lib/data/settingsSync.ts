import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { settings, defaults, mergeRemote, type Settings } from '$lib/stores/settings';
import { authCtx } from '$lib/data/authctx';
import { supabase } from '$lib/supabase';

let suppress = false;            // true while applying a remote value (don't persist the echo)
let hydratedUserId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function loadGuestSettings(): Settings {
  try {
    const raw = localStorage.getItem('pulse_settings');
    return raw ? mergeRemote(JSON.parse(raw)) : defaults();
  } catch { return defaults(); }
}

async function hydrate(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_settings').select('settings').eq('user_id', userId).maybeSingle();
  if (error) return;             // read failure → leave store as-is (parity with repo reads)
  suppress = true;
  settings.set(mergeRemote(data?.settings as Partial<Settings> | undefined));
  suppress = false;
  hydratedUserId = userId;
}

function upsertDebounced(userId: string, val: Settings): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void supabase.from('user_settings').upsert(
      { user_id: userId, settings: val, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  }, 600);
}

/** Wire settings persistence/hydration to auth. Call once, client-side, from the root layout. */
export function initSettingsSync(): void {
  if (!browser) return;

  authCtx.subscribe(ctx => {
    if (ctx.mode === 'authenticated' && ctx.userId && hydratedUserId !== ctx.userId) {
      void hydrate(ctx.userId);
    } else if (ctx.mode === 'guest' && hydratedUserId !== null) {
      // logged out: drop the synced user and restore this device's guest settings
      hydratedUserId = null;
      suppress = true;
      settings.set(loadGuestSettings());
      suppress = false;
    }
  });

  settings.subscribe(val => {
    if (suppress) return;
    const { userId, mode } = get(authCtx);
    if (mode === 'authenticated' && hydratedUserId === userId) {
      upsertDebounced(userId, val);
    }
    // guest persistence stays in settings.ts; auth-but-not-yet-hydrated is intentionally skipped
  });
}
