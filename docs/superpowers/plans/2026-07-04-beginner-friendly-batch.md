# Beginner-Friendly Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mock-exam results feed the Scores page; Notes (and alike surfaces) render an instant live preview with no Write/Preview mode switch; the dashboard guides new users with a getting-started checklist; logged sessions are visible and deletable; in-app + repo changelogs updated.

**Architecture:** All client-side, no schema changes. Five independent tasks on one branch.

**Tech Stack:** SvelteKit 2 (Svelte 4 idiom), repo engine, vitest.

## Global Constraints

- Both auth modes (guest localStorage / authenticated Supabase) on every data path.
- CSS tokens only; new strings in BOTH `src/lib/i18n/en.ts` and `th.ts`.
- Date-only values via `localDateStr` (`$lib/utils`) — NEVER `toISOString().slice` (UTC+7 machine).
- `npm run check` 0 errors + `npx vitest run` green before each commit.
- Repo `save/saveMany/remove/log` write through to stores — never manually `.set()` after.

---

### Task A: Mock exam results auto-log to Scores

**Files:**
- Modify: `src/routes/(app)/exam/+page.svelte` (finishExam, ~line 156)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/th.ts`

**Interfaces:**
- Consumes: `scoresRepo.save(MockScore)` (`$lib/data/entities`), `localDateStr` (`$lib/utils`), existing `subjectScores` map keyed by subject id.
- Produces: one `mock_scores` row per subject in the finished exam: `score=correct`, `maxScore=total`, `takenAt=localDateStr(new Date())`, `notes=$t.exam.autoScoreNote` ("From mock exam" / "จากการสอบจำลอง").

- [ ] In `finishExam`, after `examSessionsRepo.save(session)`, loop `Object.entries(subjectScores)` and `await scoresRepo.save({ id: newId(), userId, subjectId, score: val.correct, maxScore: val.total, takenAt: localDateStr(new Date()), notes: <i18n>, createdAt: new Date().toISOString() })`. Skip entries whose key is not a real subject id (`$subjects.find(s => s.id === subjId)` null → skip; those are name-fallback keys).
- [ ] Add `exam.autoScoreNote` to en/th.
- [ ] Results screen: add a small line "Saved to Scores" (`exam.savedToScores` i18n) linking to `/scores`.
- [ ] `npm run check` + `npx vitest run` → commit `feat(exam): log mock exam results to Scores automatically`.

### Task B: Notes instant live preview (kill the Write/Preview switch)

**Files:**
- Modify: `src/routes/(app)/notes/[id]/+page.svelte`
- Modify: `src/lib/i18n/en.ts`, `th.ts` (repurpose/remove write/preview labels; add `notes.previewLabel` if needed)

**Interfaces:**
- Consumes: existing `renderMarkdown(body)` (sanitized, dynamically imported).

- [ ] Remove the `mode` tablist entirely. Layout: editor textarea and preview pane both always mounted — stacked on mobile (preview under the textarea), side-by-side ≥1024px (`grid-template-columns: 1fr 1fr; gap: 16px`).
- [ ] Live render: `$:` watcher on `body` → debounce 250 ms → `previewHtml = await renderMarkdown(body)`. Render once on hydrate too. Guard stale async results (capture a token, ignore out-of-date resolutions).
- [ ] Preview pane keeps the `.markdown` class + sanitized `{@html}`; show a muted `notes.previewEmpty` placeholder when body is blank.
- [ ] Confirm nothing else regressed: autosave debounce, flush on `beforeNavigate`/`pagehide`, blank-note discard, toolbar/shortcut insertion still target the textarea.
- [ ] Alike surfaces check (the "no mode switch" idea): flashcards + exam-bank math previews are already live/inline — verify they still render while typing; no change needed unless broken.
- [ ] `npm run check` + tests → commit `feat(notes): instant side-by-side live preview, no mode switch`.

### Task C: Getting-started checklist on the dashboard

**Files:**
- Create: `src/lib/components/GettingStarted.svelte`
- Modify: `src/routes/(app)/dashboard/+page.svelte` (render above TODAY'S STUDY)
- Modify: `src/lib/stores/settings.ts` (add `gettingStartedDismissed: boolean`, default `false`)
- Modify: `src/lib/i18n/en.ts`, `th.ts`

**Interfaces:**
- Consumes: `$subjects`, `$sessions`, `$scheduleSlots`, `$settings` (exams list via existing settings shape), `settings.update`.
- Steps + done-conditions:
  1. `addSubjects` — link `/subjects` — done when `$subjects.length > 0`
  2. `setExamDate` — link `/settings` — done when `$settings.exams?.length > 0 || $settings.examDate`
  3. `planWeek` — link `/schedule` — done when `$scheduleSlots.length > 0`
  4. `studyOnce` — link `/timer` — done when `$sessions.length > 0`

- [ ] Card UI: title `gettingStarted.title` ("Get started" / Thai), 4 rows each = number chip, label, ✓ when done (muted + strikethrough), chevron link when not. Progress line "2 of 4 done". Dismiss ✕ (aria-labelled) sets `gettingStartedDismissed`.
- [ ] Visibility: render only when NOT dismissed AND at least one step incomplete. All four complete → auto-hide permanently (write the flag).
- [ ] Tokens only; reuse `.card` visual language (bg2/border/radius-md); no new theme tokens.
- [ ] `npm run check` + tests → commit `feat(dashboard): getting-started checklist for new users`.

### Task D: Session log visibility + delete (QuickLog trust)

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte` (under LOG SESSION)
- Modify: `src/lib/components/QuickLog.svelte` (done-flash stays until form reused, not 1.5 s)
- Modify: `src/lib/i18n/en.ts`, `th.ts`

**Interfaces:**
- Consumes: `todaysSessions` derived (`$lib/stores/data`), `sessionsRepo.remove(id)`, `sessionsRepo.log`, `toast` action-button undo pattern (see tasks/scores pages), `formatDuration`.

- [ ] Under the QuickLog card render "TODAY'S SESSIONS" list when `$todaysSessions.length > 0`: each row = subject color dot + subject name + optional topic + duration + started time (`$fmt`), delete ✕ (aria-label).
- [ ] Delete = snapshot session → `sessionsRepo.remove(id)` → `toast` with Undo action that re-`log`s the snapshot (mirror the scores page pattern exactly).
- [ ] QuickLog feedback: keep the ✓ flash but extend to ~2.5 s and add the logged amount ("Logged 30 min — Physics", i18n function key).
- [ ] `npm run check` + tests → commit `feat(dashboard): today's sessions list with delete/undo + clearer log feedback`.

### Task E: Changelogs

**Files:**
- Modify: `src/lib/changelog.ts` (new top version, EN+TH bullets)
- Modify: `docs/CHANGELOG.md` (new top entry when the batch merges)

- [ ] `changelog.ts`: bump to the next version (follow the file's existing version format), bullets covering: smarter AI import (preview, duplicates, tolerant parsing), desktop dialogs, mock-exam results in Scores, instant note preview, getting-started guide, session delete/undo.
- [ ] Bilingual parity; the WhatsNew modal picks it up via `LATEST_VERSION` automatically — verify.
- [ ] `npm run check` + tests → commit `docs(changelog): v-next in-app changelog + repo changelog entry`.

---

## Verification (whole plan)

- `npm run check` 0 errors; `npx vitest run` green.
- Browser (guest): finish a small mock exam → Scores page shows per-subject rows dated today (UTC+7 correct); notes editor renders preview live while typing (mobile stacked + desktop split); fresh profile shows the checklist with correct done-states and working dismiss; log a session → appears in today's list → delete → undo restores; What's New modal shows the new version once.
- EN + TH on every new string.
