// Study reminders — local, no backend. Notifications fire while Pulse is open
// (or running as an installed PWA); true closed-app push would need a server.
import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { settings } from '$lib/stores/settings';
import { scheduleSlots, tasksDueToday, todayHours, streak, subjects } from '$lib/stores/data';
import { localDateStr } from '$lib/utils';
import { t } from '$lib/i18n';

const STREAK_HOUR = '20:00'; // evening check for the streak-at-risk nudge

export const notificationPermission = writable<NotificationPermission>('default');

export function notificationsSupported(): boolean {
  return browser && 'Notification' in window;
}

export function syncPermission(): void {
  if (notificationsSupported()) notificationPermission.set(Notification.permission);
}

/** Ask the OS for permission. Returns the resulting state. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  const result = await Notification.requestPermission();
  notificationPermission.set(result);
  return result;
}

function show(title: string, body: string, tag: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' };
  // Prefer the service worker so the OS shows it even when the tab isn't focused.
  navigator.serviceWorker?.getRegistration()
    .then((reg) => {
      if (reg) reg.showNotification(title, options);
      else new Notification(title, options);
    })
    .catch(() => { try { new Notification(title, options); } catch { /* ignore */ } });
}

/** Fire a sample reminder so the user sees it worked right after enabling. */
export function sendTestNotification(): void {
  const $t = get(t);
  show($t.notifications.testTitle, $t.notifications.testBody, 'pulse-test');
}

const firedBlocks = new Set<string>();
let firedBlocksDate = '';
let lastDailyDate = '';
let lastStreakDate = '';
let timer: ReturnType<typeof setInterval> | null = null;

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function tick(): void {
  const s = get(settings);
  if (!s.notifyEnabled || !notificationsSupported() || Notification.permission !== 'granted') return;

  const now = new Date();
  const today = localDateStr(now);
  const time = hhmm(now);
  const $t = get(t);

  // Reset the per-day de-dup guards at midnight.
  if (firedBlocksDate !== today) { firedBlocks.clear(); firedBlocksDate = today; }

  // 1) A scheduled block is starting (within this minute).
  if (s.notifyBlockStart) {
    for (const slot of get(scheduleSlots)) {
      if (slot.isAiSuggested && !slot.isConfirmed) continue;
      if (firedBlocks.has(slot.id)) continue;
      const diff = new Date(slot.startTime).getTime() - now.getTime();
      if (diff >= 0 && diff < 60_000) {
        firedBlocks.add(slot.id);
        const subj = get(subjects).find((x) => x.id === slot.subjectId);
        show($t.notifications.blockTitle, $t.notifications.blockBody(subj?.name ?? ''), `pulse-block-${slot.id}`);
      }
    }
  }

  // 2) Daily study nudge (+ tasks-due count) at the chosen time, once per day.
  if ((s.notifyDaily || s.notifyTasksDue) && time === s.notifyDailyTime && lastDailyDate !== today) {
    lastDailyDate = today;
    const dueCount = s.notifyTasksDue ? get(tasksDueToday).length : 0;
    const body = dueCount > 0 ? $t.notifications.dailyBodyTasks(dueCount) : $t.notifications.dailyBody;
    if (s.notifyDaily || dueCount > 0) show($t.notifications.dailyTitle, body, 'pulse-daily');
  }

  // 3) Streak at risk — evening, only if nothing studied yet today.
  if (s.notifyStreak && time === STREAK_HOUR && lastStreakDate !== today) {
    lastStreakDate = today;
    const days = get(streak);
    if (days > 0 && get(todayHours) < 0.001) {
      show($t.notifications.streakTitle, $t.notifications.streakBody(days), 'pulse-streak');
    }
  }
}

/** Start the reminder ticker. Idempotent; safe to call once from the app layout. */
export function initNotifications(): void {
  if (!browser || timer) return;
  syncPermission();
  // 30s cadence: guarantees at least one check inside every wall-clock minute.
  timer = setInterval(tick, 30_000);
}
