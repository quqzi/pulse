// Closed-app "pomodoro finished" notification. A pomodoro has a known end time
// the moment it starts running, so we schedule a one-off push for that instant
// (server-side, via the send-push cron). This is the one timer event that can
// reach you with the app fully closed — a web timer itself can't run in the
// background. Authenticated + opted-in only; the free timer has no end, so
// nothing is scheduled for it.
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { getAuthContext } from '$lib/data/authctx';
import { settings } from '$lib/stores/settings';
import { timerStore } from '$lib/stores/timer';

function canSchedule(): boolean {
  if (!browser) return false;
  if (!get(settings).notifyEnabled) return false;
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/**
 * Schedule the "pomodoro complete" push at the current pomodoro's finish time.
 * Idempotent — clears any prior pending one first, so re-scheduling after a
 * resume (which shifts the finish time) leaves exactly one row.
 */
export async function schedulePomodoroPush(): Promise<void> {
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated' || !userId || !canSchedule()) return;

  const t = get(timerStore);
  if (t.mode !== 'pomodoro') return;
  const remainingSec = Math.max(0, t.total - t.elapsed);
  if (remainingSec < 1) return;

  const fireAt = new Date(Date.now() + remainingSec * 1000).toISOString();
  const copy = get(settings).lang === 'th'
    ? { title: 'จบช่วงโพโมโดโรแล้ว 🎉', body: 'พักสักครู่ โฟกัสได้ดีมาก' }
    : { title: 'Pomodoro complete 🎉', body: 'Time for a break — nice focus.' };

  await cancelPomodoroPush();
  await supabase.from('scheduled_pushes').insert({
    user_id: userId, fire_at: fireAt, title: copy.title, body: copy.body, url: '/timer', tag: 'pomodoro',
  });
}

/** Drop this user's pending pomodoro push (on pause / stop / complete). */
export async function cancelPomodoroPush(): Promise<void> {
  if (!browser) return;
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated' || !userId) return;
  await supabase.from('scheduled_pushes').delete()
    .eq('user_id', userId).eq('tag', 'pomodoro').is('sent_at', null);
}
