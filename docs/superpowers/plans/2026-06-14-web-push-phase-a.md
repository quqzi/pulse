# Web Push — Phase A (high-value closed-app notifications)

## Why
Real users want notifications that arrive when the app is **closed**, on mobile. The
client timer can't run in the background (no web timer can — JS stops when the PWA is
backgrounded/killed; PR #63's resume already reconstructs elapsed on reopen). The only
thing that needs a server is *sending a push at the right time*. Phase A delivers the
high-value pushes — **study block starting, daily nudge, streak at risk** — and skips
the pomodoro-completion push (Phase B) because a 25-min session means the user is
usually present, and it's the only event that needs a full server-side timer.

Decisions: **Supabase-native** infra (free tier); push events = block + daily + streak.

## Cost: $0
pg_cron (free), Edge Functions (~43K of 500K monthly invocations), Web Push (free, rides
Chrome/Firefox/Apple push services). Caveat: a free Supabase project pauses after 7 days
idle — irrelevant with active users.

## Constraints
- **iOS** needs the PWA **installed to the home screen** (16.4+); Android Chrome works closed-app directly.
- Pushes can be **up to ~60s late** (minute-granularity cron). Fine for study reminders.
- Times evaluated in **Asia/Bangkok** (TCAS audience).

## Pieces (built)
- `src/lib/push.ts` — `ensurePushSubscribed()` / `removePushSubscription()` (auth-only; idempotent).
- `src/service-worker.ts` — `push` handler (shows the notification) + url-aware `notificationclick`.
- `src/routes/(app)/settings/+page.svelte` — the existing notifications toggle now subscribes/unsubscribes this device.
- `src/routes/(app)/+layout.svelte` — refreshes the subscription once per app open (only if already opted in + permission granted; never prompts).
- `.env.example` + `PUBLIC_VAPID_PUBLIC_KEY` (public key generated; private key is a function secret only).
- `supabase/migrations/…_push_subscriptions.sql` — `push_subscriptions` (RLS own-rows) + `notification_sends` (dedupe; service-role only).
- `supabase/migrations/…_push_cron.sql` — pg_cron + pg_net, calls the function every minute (placeholders for project ref + secret).
- `supabase/functions/send-push/index.ts` — the sender (block/daily/streak, dedupe, prunes dead subscriptions).

## Remaining — production steps (need explicit go-ahead)
1. Apply `push_subscriptions` migration (creates 2 tables).
2. Deploy the `send-push` Edge Function.
3. Set function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generated, share securely), `VAPID_SUBJECT`, `CRON_SECRET`.
4. Apply `push_cron` migration with the real project ref + CRON_SECRET.
5. Add `PUBLIC_VAPID_PUBLIC_KEY` to Vercel env (Production + Preview).
6. Verify end-to-end on a deployed build (localhost can't fully exercise the cron → push round-trip).

## Phase B (later)
Server-side `active_timer` table (cross-device sync bonus) + pomodoro-completion push.
