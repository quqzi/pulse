// Web Push (closed-app notifications). Authenticated users only — guests have no
// server to push from. The matching service-worker `push` handler lives in
// src/service-worker.ts; the sender is the `send-push` Supabase Edge Function.
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { supabase } from '$lib/supabase';
import { getAuthContext } from '$lib/data/authctx';

const VAPID_PUBLIC = env.PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return browser && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC;
}

/**
 * Subscribe this device to Web Push and store the subscription server-side.
 * Idempotent — safe to call on every enable / app open. No-op for guests or when
 * push isn't supported (e.g. iOS Safari that isn't installed to the home screen).
 */
export async function ensurePushSubscribed(): Promise<void> {
  if (!pushSupported()) return;
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated' || !userId) return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
    } catch {
      return; // permission revoked or push service unavailable
    }
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' },
  );
}

/** Unsubscribe this device and drop its stored subscription. */
export async function removePushSubscription(): Promise<void> {
  if (!browser || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  try { await sub.unsubscribe(); } catch { /* ignore */ }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
