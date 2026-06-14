import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { settings, defaults, mergeRemote, type Settings } from '$lib/stores/settings';
import { authCtx } from '$lib/data/authctx';
import { supabase } from '$lib/supabase';

let suppress = false;            // true while applying a remote value (don't persist the echo)
let hydratedUserId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { userId: string; val: Settings } | null = null;
// Set when the user changes settings before hydrate() finishes — their choice
// must win over the remote value we're about to receive (else it's lost).
let dirtyDuringLoad = false;

function loadGuestSettings(): Settings {
  try {
    const raw = localStorage.getItem('pulse_settings');
    return raw ? mergeRemote(JSON.parse(raw)) : defaults();
  } catch { return defaults(); }
}

function doUpsert(userId: string, val: Settings): void {
  // supabase-js query builders are LAZY: without .then()/await the HTTP request
  // is never sent. The old `void supabase…upsert(…)` therefore never saved a
  // single settings row — this `.then()` is what actually dispatches it.
  void supabase.from('user_settings').upsert(
    { user_id: userId, settings: val, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  ).then(({ error }) => {
    if (error) console.warn('[settings] sync failed:', error.message);
  });
}

function upsertDebounced(userId: string, val: Settings): void {
  pending = { userId, val };
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (pending) { doUpsert(pending.userId, pending.val); pending = null; }
  }, 600);
}

/** Write any pending settings immediately — e.g. right before the tab closes,
 *  so the debounce can't drop the user's last change. */
export function flushSettings(): void {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (pending) { doUpsert(pending.userId, pending.val); pending = null; }
}

async function hydrate(userId: string): Promise<void> {
  dirtyDuringLoad = false;
  const { data, error } = await supabase
    .from('user_settings').select('settings').eq('user_id', userId).maybeSingle();
  hydratedUserId = userId; // from here on, changes sync normally
  if (error) return;       // read failed → keep local; future changes still upsert
  if (!data || dirtyDuringLoad) {
    // No saved row yet (first login), or the user changed a setting while we were
    // fetching — keep the current local value (e.g. their guest theme) and push it
    // up, rather than clobbering it with defaults / the stale remote one. This also
    // seeds user_settings on first login so it isn't left empty.
    upsertDebounced(userId, get(settings));
  } else {
    suppress = true;
    settings.set(mergeRemote(data.settings as Partial<Settings> | undefined));
    suppress = false;
  }
}

/** Wire settings persistence/hydration to auth. Call once, client-side, from the root layout. */
export function initSettingsSync(): void {
  if (!browser) return;

  authCtx.subscribe(ctx => {
    if (ctx.mode === 'authenticated' && ctx.userId && hydratedUserId !== ctx.userId) {
      void hydrate(ctx.userId);
    } else if (ctx.mode === 'guest' && hydratedUserId !== null) {
      // logged out: flush the last change, then restore this device's guest settings
      flushSettings();
      hydratedUserId = null;
      suppress = true;
      settings.set(loadGuestSettings());
      suppress = false;
    }
  });

  settings.subscribe(val => {
    if (suppress) return;
    const { userId, mode } = get(authCtx);
    if (mode !== 'authenticated' || !userId) return; // guest persistence lives in settings.ts
    if (hydratedUserId === userId) {
      upsertDebounced(userId, val);
    } else {
      dirtyDuringLoad = true; // changed before hydration finished — hydrate() pushes it
    }
  });

  // Don't lose the last change if the user navigates away / closes mid-debounce.
  window.addEventListener('pagehide', flushSettings);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSettings(); });
}
