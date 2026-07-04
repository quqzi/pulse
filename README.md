# Pulse

A study tracker for **TCAS** (Thai university-entrance) exam prep. Plan your subjects, run focused study sessions, track readiness, and stay on pace for exam day.

**Live:** https://pulse-hazel-ten.vercel.app

Pulse works two ways, and every feature supports both:

- **Guest** — fully offline, no account, data stored in `localStorage`.
- **Authenticated** — Supabase + Postgres with row-level security, synced across devices.

Bilingual throughout (English + ไทย).

---

## Features

- **Dashboard** — greeting, multi-exam countdowns, today's study hours vs. goal, day streak, and exam-readiness.
- **Timer** — Pomodoro and free count-up modes with a progress ring and focus mode. Survives reload / tab close / phone-background (time is reconstructed from a wall-clock stamp on reopen).
- **Subjects & topics** — per-subject progress, topic checklists, and flashcard decks.
- **Flashcards** — manual-scheduled decks per topic, with **AI-assisted bulk import** (copy a generated prompt into any AI, paste the JSON back).
- **Notes** — markdown notes with a formatting toolbar, autosave, and sanitized rendering.
- **Schedule** — weekly calendar of study blocks with an auto-scheduler that respects school hours, energy profile, and rest days.
- **Analytics & Insights** — study-hours charts plus a ranked, plain-language insight feed.
- **Mock exams & scores** — question bank (with AI-assisted import and LaTeX math), timed mock sessions, and score tracking.
- **Study Groups** — invite-code groups with a leaderboard, shared aggregates (hours / streak / achievements), and group challenges. Auth-only.
- **Web Push notifications** (closed-app) — study-block reminders, a daily nudge, a streak-at-risk alert, and a "pomodoro finished" alert that arrives even when the app is closed.
- **Five themes** (Vercel / Apple light+dark, Resend) and PWA install.

---

## Tech stack

- **SvelteKit 2** + **TypeScript** (Svelte 4 idiom)
- **Supabase** (Postgres + Auth + Edge Functions + pg_cron) — auth path
- **Web Push** via VAPID + a service worker + a Supabase Edge Function
- Plain CSS custom-property design tokens (no Tailwind)
- **Vercel** hosting, auto-deploy from `master`

---

## Getting started

```bash
npm install
npm run dev          # → http://localhost:5173
```

Guest mode runs with no configuration. For the authenticated path, create `.env.local` (never committed):

```bash
PUBLIC_SUPABASE_URL=...          # Supabase → Settings → API
PUBLIC_SUPABASE_ANON_KEY=...     # public anon key (RLS-protected)
PUBLIC_VAPID_PUBLIC_KEY=...      # Web Push public key (optional; enables notifications)
```

See `.env.example` for the full list and key-generation notes.

## Scripts

```bash
npm run dev        # dev server
npm run check      # type-check (zero errors before every commit)
npm run build      # production build
npm run preview    # preview the production build
npx vitest run     # unit tests (data engine, mappers, flashcards, scheduler)
```

## Project layout

```
src/
  app.css            # global styles, design tokens, theme blocks
  lib/
    components/      # shared UI + feature subfolders
    data/            # repository engine (stores ↔ localStorage / Supabase)
    stores/          # auth, data, settings, timer
    i18n/            # en.ts + th.ts
  routes/(app)/      # dashboard, timer, subjects, notes, schedule, exam, flashcards, groups, ... settings
supabase/
  migrations/        # SQL migrations
  functions/send-push/   # closed-app Web Push sender (Deno Edge Function)
```

Contributor and architecture notes live in `CLAUDE.md`; full change history in `docs/CHANGELOG.md`.

---

## License

Proprietary — see [LICENSE](./LICENSE). All rights reserved.
