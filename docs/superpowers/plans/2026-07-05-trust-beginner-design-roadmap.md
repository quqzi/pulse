# Trust, Beginner-Friendliness & Design Roadmap

> **For agentic workers:** Execute phase-by-phase; each phase is one PR with its own browser verification. Claude (Fable 5) designs and implements the design phases directly — do not delegate visual design to Codex.

**Goal:** Make the numbers trustworthy (readiness/insights), make the first-run experience self-explanatory, surface high-use settings where they're used, replace the notes split view with a single Obsidian-style live editor, and raise the schedule + overall visual design.

**Context (grounded findings from the 2026-07-05 audit):**
- `readinessScore` (`src/lib/stores/data.ts`) ignores manual mock scores (`scores` store) — only `examSessions` feed the 30-pt exam component, so score-page users are capped at 70 forever. Exam accuracy is an all-time flat mean (early bad attempts drag forever). Topic-less subjects score 0/40 coverage and drag the overall average.
- `weakestSubject` insight (`src/lib/insights.ts`) always fires once 2 subjects + 3 sessions exist, even when every subject is at 95. `readinessGap` action links to `/analytics`, but readiness renders on the dashboard (`ReadinessCard`).
- `insights` derived + readiness `cutoff` + analytics `weekStartISO` don't subscribe to `todayDate` — stale across midnight on an open tab.
- New users report being stuck on the dashboard and not realizing sign-in exists (it's buried in Settings). Language toggle is also buried in Settings.
- Notes editor (`src/routes/(app)/notes/[id]/+page.svelte`) is a write/preview split; the user wants ONE pane that renders live like Obsidian/Notion.

**Every phase:** `npm run check` (0 errors) → `npx vitest run` (green) → browser-verify the exact change (390px + desktop, EN + TH) → `docs/CHANGELOG.md` entry; user-facing phases also bump `src/lib/changelog.ts` (bilingual). Merges/pushes to master need the user's explicit OK.

---

## Phase 1 — Trust the numbers (readiness + insights fixes)

**Files:** `src/lib/stores/data.ts`, `src/lib/insights.ts`, `src/lib/insights.test.ts`, new `src/lib/data/readiness-util.ts` additions + tests, `src/routes/(app)/analytics/+page.svelte`.

1. **Blend manual mock scores into readiness.** Build a per-subject list of exam attempts = `examSessions` ratios (`correct/total`, dated by `es` date field) ∪ `scores` rows (`score/maxScore`, dated `takenAt`), skip zero-max rows. Extract a pure helper `examAccuracy(attempts: {ratio: number; date: string}[]): number` into `readiness-util.ts`.
2. **Recency-weight exam accuracy.** In `examAccuracy`, sort by date desc, keep the last 5 attempts, weighted mean with weights `[5,4,3,2,1]` (newest→oldest). Unit-test: improvement shows (old 40% + recent 80% → >70%), single attempt = its own ratio, empty = 0.
3. **Stop punishing empty subjects.** In `readinessScore`, exclude subjects with `topicsTotal === 0 && recentHours === 0 && attempts.length === 0` from the overall average (they keep a `bySubject` entry of 0 so per-subject UI still renders). If ALL subjects are inactive, overall = 0 as today.
4. **Threshold the weakest-subject insight.** Add `WEAK_READINESS_MAX = 70`; `weakestSubject` returns null unless the worst subject's readiness < 70. Update tests.
5. **Fix the readiness-gap link.** `readinessGap` action `href: '/dashboard'` with label key `actionDashboard` (add i18n en+th: "View readiness" / "ดูความพร้อม").
6. **Midnight staleness.** Add `todayDate` to the `insights` and `readinessScore` derived dependencies (use it for `today` and the 30-day cutoff); in analytics compute `weekStartISO` reactively from `$todayDate`.
7. Tests green, check clean, changelog entry (folds into the next in-app release as "Readiness now counts your mock scores and recent progress").

## Phase 2 — Beginner-friendly first run + language switcher + contextual settings

**Files:** `src/lib/components/Sidebar.svelte`, `src/lib/components/MoreDrawer.svelte`, `src/lib/components/GettingStarted.svelte`, `src/routes/onboarding/+page.svelte`, new `src/lib/components/LangToggle.svelte`, new `src/lib/components/InlineSettings.svelte`, timer/schedule/dashboard pages, i18n.

1. **Sign-in discoverability (guests only).** Sidebar footer button "Sign in — sync your data" → `/auth`; same entry at the top of MoreDrawer on mobile. Hidden when authenticated. Add a guest-only fifth row to GettingStarted: "Optional: create a free account so your data syncs" → `/auth` (never blocks the done-state of the 4 core steps).
2. **Language toggle in a corner.** `LangToggle.svelte` — compact EN/ไทย segmented control writing `settings.lang`. Place: sidebar footer (desktop), MoreDrawer header (mobile), and top-right of the onboarding first screen (first-run users pick a language before anything else).
3. **Contextual settings (kept in Settings too).** `InlineSettings.svelte` = gear icon button opening a small popover (portal to `<body>`, see gotcha) with a supplied slice of controls bound straight to the `settings` store:
   - **Timer page:** pomodoroWork, pomodoroBreak, musicUrl.
   - **Schedule page:** studyStart, studyEnd, blockMinutes, restDays.
   - **Dashboard Today card:** dailyGoalHours (tap the goal text to edit inline).
   Settings page keeps everything; no logic forks — both surfaces write the same store.
4. Browser-verify: fresh guest profile sees language toggle + sign-in path without visiting Settings; popover controls persist after reload.

## Phase 3 — Notes: single-pane live editor (Obsidian-style)

**Files:** `src/routes/(app)/notes/[id]/+page.svelte`, new `src/lib/components/notes/LiveEditor.svelte`, `package.json`.

1. **Approach:** CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`) — the same engine Obsidian uses. One editor pane, no preview column. A custom ViewPlugin styles markdown inline (headings sized/bold, `**bold**`/`*italic*` rendered, list bullets, checkboxes, code blocks mono/tinted) and **hides the marker characters on every line except the one with the cursor** (Obsidian's live-preview behavior).
2. **Bundle discipline:** dynamic-import the editor inside the notes `[id]` page (`const { LiveEditor } = await import(...)` in onMount) so CM6 (~130 kb) never loads on other routes.
3. **Integration:** LiveEditor takes `value` + dispatches `change` (string) — existing autosave/debounce/hydration logic unchanged. Formatting toolbar + Ctrl/Cmd-B/I shortcuts re-mapped to CM dispatch transactions (replaces the textarea selection math). Theme via CSS vars so all five themes work.
4. **Keep** sanitized `renderMarkdown` for read-only surfaces (note list previews). Delete the preview pane, `schedulePreview`, `previewEmpty` i18n usage in the editor.
5. **Fallback:** if the custom live-preview plugin fights us past 2 real attempts, swap to `ink-mde` (prebuilt CM6 Obsidian-style wrapper) behind the same LiveEditor interface.
6. Verify: typing `# Head`, `**bold**`, lists, checkboxes render live in one pane; markers reappear on the active line; autosave + th/en toolbar labels intact; mobile keyboard usable at 390px.

## Phase 4 — Schedule design pass (Fable 5 designs directly)

**Files:** `src/routes/(app)/schedule/+page.svelte`, `src/lib/components/calendar/*`.

1. Audit current UI in-browser (both themes, 390/768/1440) and write a short design direction note (hierarchy, spacing rhythm, block color system, today emphasis) before touching code — per `ui-ux-pro-max` + design-quality rules.
2. Expected concrete upgrades (validate against the audit): current-time indicator line, stronger today column emphasis, calmer block palette derived from subject colors (`rgba(var(--sc-rgb), …)` fills with solid left edge), tighter header with week nav + "Today" jump, better empty/rest-day states, popover polish (Phase 1d predecessor already constrained the chips), smoother confirm-all flow.
3. All five themes verified; compositor-safe animation only (`transform`/`opacity`).

## Phase 5 — Overall design polish sweep (Fable 5 designs directly)

1. One pass over dashboard, timer, subjects, scores, exam list screens: consistent card hierarchy, spacing rhythm, hover/focus states, empty states, motion. No layout rewrites — polish, not redesign.
2. Respect saved preferences: don't default to Apple theme; glass surfaces stay ~90% opaque.
3. Ship as its own PR with before/after screenshots in the PR body.

## Release notes

Phases 1–3 bundle into in-app changelog **v1.4** (readiness you can trust, sign-in/language QoL, new notes editor); Phases 4–5 into **v1.5** (design refresh). `docs/CHANGELOG.md` gets one entry per merged PR — never skip it.
