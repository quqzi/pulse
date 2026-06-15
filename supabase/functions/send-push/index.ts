// send-push — fired once a minute by pg_cron. Sends closed-app Web Push for:
//   • study block starting   • daily study nudge   • streak at risk
//   • one-off scheduled pushes (e.g. pomodoro finished)
// Reads prefs from user_settings; dedupes via notification_sends so each fires
// once per (user, key). Times are evaluated in Asia/Bangkok (TCAS audience).
//
// Secrets (set on the function): CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:). SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@pulse.app';

// Validate config per-request (not at module load) so a missing secret returns a
// clear diagnostic instead of crashing the whole function at boot with a bare 500.
function configError(): Response | null {
  const missing = [
    !CRON_SECRET && 'CRON_SECRET',
    !VAPID_PUBLIC && 'VAPID_PUBLIC_KEY',
    !VAPID_PRIVATE && 'VAPID_PRIVATE_KEY',
  ].filter(Boolean);
  if (missing.length) return Response.json({ error: 'missing_secrets', missing }, { status: 500 });
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);
  } catch (e) {
    return Response.json({ error: 'invalid_vapid', detail: String(e) }, { status: 500 });
  }
  return null;
}

const TZ = 'Asia/Bangkok';
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

type Lang = 'en' | 'th';
interface Payload { title: string; body: string; tag: string; url: string }
interface Sub { user_id: string; endpoint: string; p256dh: string; auth: string }

function bangkokNow(): { date: string; hhmm: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${hour}:${parts.minute}`,
    weekday: WD[parts.weekday as string] ?? 0,
  };
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().substring(0, 10);
}

async function studiedOn(sb: SupabaseClient, userId: string, date: string): Promise<boolean> {
  const { count } = await sb
    .from('study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', `${date}T00:00:00+07:00`)
    .lt('started_at', `${addDays(date, 1)}T00:00:00+07:00`);
  return (count ?? 0) > 0;
}

async function subjectName(sb: SupabaseClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await sb.from('subjects').select('name').eq('id', id).maybeSingle();
  return (data?.name as string) ?? null;
}

function blockPayload(lang: Lang, subj: string | null, time: string): Payload {
  return lang === 'th'
    ? { title: 'ถึงเวลาเรียนแล้ว', body: `${subj ?? 'คาบเรียน'} เริ่ม ${time}`, tag: 'block', url: '/schedule' }
    : { title: 'Study block starting', body: `${subj ?? 'Your block'} at ${time}`, tag: 'block', url: '/schedule' };
}
function dailyPayload(lang: Lang, studied: boolean): Payload {
  if (studied) {
    return lang === 'th'
      ? { title: 'เยี่ยมมาก!', body: 'วันนี้คุณอ่านหนังสือแล้ว ทำต่อไป 🔥', tag: 'daily', url: '/dashboard' }
      : { title: 'Nice work!', body: "You've studied today — keep it going 🔥", tag: 'daily', url: '/dashboard' };
  }
  return lang === 'th'
    ? { title: 'อย่าลืมอ่านหนังสือ', body: 'ใช้เวลาสักครู่ทบทวนวันนี้', tag: 'daily', url: '/timer' }
    : { title: 'Time to study', body: 'Take a few minutes to review today.', tag: 'daily', url: '/timer' };
}
function streakPayload(lang: Lang): Payload {
  return lang === 'th'
    ? { title: 'สตรีคของคุณกำลังจะหลุด', body: 'อ่านหนังสือวันนี้เพื่อรักษาสตรีค', tag: 'streak', url: '/timer' }
    : { title: 'Your streak is at risk', body: 'Study today to keep your streak alive.', tag: 'streak', url: '/timer' };
}

Deno.serve(async (req) => {
  const bad = configError();
  if (bad) return bad;
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { date, hhmm, weekday } = bangkokNow();

  const { data: subRows } = await sb
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');
  const subs = (subRows ?? []) as Sub[];

  const byUser = new Map<string, Sub[]>();
  for (const s of subs) (byUser.get(s.user_id) ?? byUser.set(s.user_id, []).get(s.user_id)!).push(s);
  const userIds = [...byUser.keys()];

  const due: { userId: string; kind: string; payload: Payload }[] = [];

  if (userIds.length) {
    const { data: settingsRows } = await sb
      .from('user_settings').select('user_id, settings').in('user_id', userIds);
    const settingsByUser = new Map<string, Record<string, unknown>>();
    for (const r of settingsRows ?? []) settingsByUser.set(r.user_id as string, (r.settings ?? {}) as Record<string, unknown>);

    for (const userId of userIds) {
      const s = settingsByUser.get(userId) ?? {};
      if (!s.notifyEnabled) continue;
      const lang: Lang = s.lang === 'th' ? 'th' : 'en';

      if (s.notifyBlockStart) {
        const { data: slots } = await sb
          .from('schedule_slots')
          .select('id, subject_id, start_time, is_recurring, recurrence_days, recurrence_end')
          .eq('user_id', userId);
        for (const slot of slots ?? []) {
          const st = String(slot.start_time);
          const slotTime = st.substring(11, 16); // HH:MM
          if (slotTime !== hhmm) continue;
          let isDue: boolean;
          if (slot.is_recurring && Array.isArray(slot.recurrence_days)) {
            const within = !slot.recurrence_end || date <= String(slot.recurrence_end).substring(0, 10);
            isDue = (slot.recurrence_days as number[]).includes(weekday) && within;
          } else {
            isDue = st.substring(0, 10) === date;
          }
          if (isDue) {
            const name = await subjectName(sb, (slot.subject_id as string | null) ?? null);
            due.push({ userId, kind: `block:${slot.id}:${date}`, payload: blockPayload(lang, name, slotTime) });
          }
        }
      }

      if (s.notifyDaily && hhmm === ((s.notifyDailyTime as string) ?? '19:00')) {
        due.push({ userId, kind: `daily:${date}`, payload: dailyPayload(lang, await studiedOn(sb, userId, date)) });
      }

      if (s.notifyStreak && hhmm === '20:00') {
        if (!(await studiedOn(sb, userId, date)) && (await studiedOn(sb, userId, addDays(date, -1)))) {
          due.push({ userId, kind: `streak:${date}`, payload: streakPayload(lang) });
        }
      }
    }
  }

  let sent = 0;
  for (const item of due) {
    // Atomic dedupe: the unique (user_id, kind) makes a second insert fail → skip.
    const { error } = await sb.from('notification_sends').insert({ user_id: item.userId, kind: item.kind });
    if (error) continue;
    const body = JSON.stringify(item.payload);
    for (const sub of byUser.get(item.userId) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }

  // One-off scheduled pushes (e.g. "pomodoro finished") whose time has come.
  const nowIso = new Date().toISOString();
  const { data: dueScheduled } = await sb
    .from('scheduled_pushes')
    .select('id, user_id, title, body, url, tag')
    .lte('fire_at', nowIso)
    .is('sent_at', null);
  let scheduledSent = 0;
  for (const sp of dueScheduled ?? []) {
    // Claim it first (stamp sent_at) so an overlapping run can't double-send.
    const { data: claimed } = await sb
      .from('scheduled_pushes')
      .update({ sent_at: nowIso })
      .eq('id', sp.id).is('sent_at', null)
      .select('id');
    if (!claimed || !claimed.length) continue;
    const body = JSON.stringify({ title: sp.title, body: sp.body, tag: sp.tag, url: sp.url });
    for (const sub of byUser.get(sp.user_id as string) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        scheduledSent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
  // Hygiene: drop rows more than a day past their fire time (sent or orphaned).
  await sb.from('scheduled_pushes').delete().lt('fire_at', new Date(Date.now() - 86_400_000).toISOString());

  return Response.json({ sent: sent + scheduledSent, due: due.length, scheduled: (dueScheduled ?? []).length });
});
