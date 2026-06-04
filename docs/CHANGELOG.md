# Pulse — Changelog

Completed plans, newest first. Each plan's full detail lives in `docs/superpowers/plans/`; this file is the at-a-glance history. CLAUDE.md → Active Plans tracks only Open / Planned and points here.

> **Workflow:** when a plan is fully implemented and committed, add its entry to the top of this list and remove it from CLAUDE.md → Active Plans → Open.

---

- `docs/superpowers/plans/2026-05-28-exam-simulation.md` — Exam Simulation (readiness score card on dashboard, question bank page, configurable mock exam with overall/per-question timer modes). Adapted from the pre-WS1 plan to the repo engine: `examQuestionsRepo`/`examSessionsRepo` on the `repo()` engine (guest localStorage / auth Supabase, write-through) instead of the deleted `db.ts`; `readinessScore` derived joins card→topic→subject (SrsCard.subjectId was dropped in WS1.3b). Exam tables migration **applied to prod** (2026-06-04). Browser-verified guest flow end-to-end (add questions → run exam → results persisted → readiness card). PR #13
- `docs/superpowers/plans/2026-06-03-ws2.2-mobile-layouts.md` — WS2.2: scores/subjects tap→action-sheet on touch (reusing `BottomSheet`), Subjects edit relocated to its detail page via reusable `SubjectEditSheet`, header decongest. Verification found + fixed: sheets/dialogs portal to `<body>` (escape `.main-content` trapped stacking context above the fixed tab-bar), SubjectEditSheet seed reactive-ordering, scores row keyboard double-trigger. PR #11
- `docs/superpowers/plans/2026-06-03-mobile-a11y-touch-targets.md` — WS2.1c: ≥44px touch targets on flagged controls, tab-bar inactive contrast, friendly `/review` toast. (merged)
- `docs/superpowers/plans/2026-06-02-ws2.1b-anchored-positioning.md` — WS2.1b: anchored-positioning action for popovers/menus. (merged)
- `docs/superpowers/plans/2026-06-02-ws2.1a-schedule-touch-drag.md` — WS2.1a: schedule touch drag/resize. (merged)
- `docs/superpowers/plans/2026-06-02-schedule-mobile-layout.md` — Schedule mobile layout. (merged)
- `docs/superpowers/plans/2026-05-27-qol-fixes.md` — QoL fixes. (merged)
- `docs/superpowers/plans/2026-05-31-ws1.4-settings-sync.md` — WS1.4: settings sync via `user_settings` (JSONB per-user, RLS; new `data/settingsSync.ts` hydrate-on-login merge-over-`defaults()`, echo-guarded `set` + per-user `hydratedUserId` gate, 600ms debounced upsert; guest stays localStorage, guarded to guest-only in `settings.ts`). Unified the divergent `Settings` type onto `stores/settings.ts` (deleted stale `types.ts` copy lacking `examDate`; scheduler re-pointed). Exam date single-sourced on `settings.examDate` (onboarding writes, dashboard reads reactively; dropped `pulse_exam_date`). History window unified to `HISTORY_DAYS=112` (shared constant drives sessions load + heatmap geometry; applied to both modes — guest was uncapped). Added `$app/environment` vitest stub so store modules load under tests. 29/29 unit tests; SSR boot-checked 5 routes → 200. PR #5
- `docs/superpowers/plans/2026-05-31-ws1.3c-cleanup.md` — WS1.3c: deleted orphaned `db.ts` (514 lines, zero importers; killed the dead `seedSubjectsFromNames` shim); added `UNIQUE(srs_cards.topic_id)` + `onConflict:'topic_id'` to make `topicsRepo.create` idempotent (no dupes existed — clean add); fixed AI-suggested slots persisting with `user_id=''` (RLS-hidden for auth users — `handleAutoSchedule` now stamps real userId); fixed template-applied topics all getting `orderIndex:0`; fixed `/schedule` SSR 500 (`document` in `WeekGrid.onDestroy` via `clearHoldTimer` — guarded with `browser`, verified `GET /schedule` → 200). PR #4
- `docs/superpowers/plans/2026-05-29-ws1.1-test-harness-characterization.md` — WS1.1: Vitest harness + srs/scheduler characterization tests (PR #1)
- `docs/superpowers/plans/2026-05-29-ws1.2-repository-engine.md` — WS1.2: repository engine + local/mock adapters + toast + `id` helper (PR #1)
- `docs/superpowers/plans/2026-05-29-ws1.3a-repo-wiring-tasks-pilot.md` — WS1.3a: data-layer restructure (`data/stores.ts`, `data/authctx.ts`), Supabase adapter, `repo()` wiring, tasks migrated as pilot (write-through + rollback browser-verified; PR #2)
- `docs/superpowers/plans/2026-05-30-ws1.3b-entities-migration.md` — WS1.3b: migrated the remaining 7 entities + 9 bespoke methods (subjects/topics cascade delete, topic+SRS-card create, srs update-only, sessions windowed-load/log, schedule loadWeek/confirmAll) onto the repo engine; dropped phantom `SrsCard.subjectId` (scheduler joins card→topic→subject); no schema migration (FK cascades already existed); `db.ts` now orphaned (zero importers — WS1.3c deletes it). Two-stage reviewed + browser-verified guest flows incl. cascade-delete (no orphans) and schedule confirm-all. PR #3
- `docs/superpowers/plans/2026-05-26-templates-with-topics.md` — Templates with topic presets
- `docs/superpowers/plans/2026-05-26-google-oauth.md` — Google OAuth login (implicit flow; PKCE upgrade pending @supabase/ssr migration)
- `docs/superpowers/plans/2026-05-28-stronger-base-design.md` — Token system, ESLint/Stylelint, component decomposition, authCtx derived store, Playwright smoke tests
- `docs/superpowers/plans/2026-05-26-journey.md` — Journey page: stat cards, 16-week heatmap, session timeline
- `docs/superpowers/plans/2026-05-26-scores.md` — Scores tracking page
- `docs/superpowers/plans/2026-05-26-quick-fixes.md` — Sidebar gap, delete confirms, scroll fix, dark mode contrast
- `docs/superpowers/plans/2026-05-26-srs-review.md` — SRS flashcard review page (queue, ratings, summary, keyboard shortcuts)
- `docs/superpowers/plans/2026-05-26-calendar-phase2.md` — Auto-schedule algorithm, load bars, school-hours shading, right sidebar, exam countdown
- `docs/superpowers/plans/2026-05-25-calendar-phase1.md` — Calendar Phase 1 (drag/drop week grid)
- `docs/superpowers/plans/2026-05-25-auth-onboarding.md` — Auth + onboarding fix
- `docs/superpowers/plans/2026-05-24-pulse-plan-3a-tasks.md` — Tasks feature
