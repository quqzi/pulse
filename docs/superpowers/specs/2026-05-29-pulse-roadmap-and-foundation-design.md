# Pulse — Roadmap & Foundation Design

**Date:** 2026-05-29
**Status:** Revised after codebase readiness review (2026-05-29) — plan-ready
**Author:** Claude (brainstorming session with @quqzi)

---

## 1. What this document is

A strategic roadmap for strengthening Pulse, plus an implementable design for the
first workstream (**Foundation**). It assesses the current base, lists what to
improve, sequences the work into workstreams, and answers the "how should the
design work on mobile / iPad / PC" question.

Each workstream after WS1 becomes its own spec → plan → implementation cycle.

**Decisions locked in this session:**
- Optimise **foundation first** — strongest possible base before new surface area.
- **Greenfield** — no production data to migrate; localStorage keys and DB schema
  can be designed cleanly from scratch.
- Data layer adopts a **repository pattern with store write-through** (boldest of
  the three options considered).
- **Device → Thai** ordering for WS2/WS3.
- **Motion & design refinement is sequenced LAST** (WS6), by explicit request.

---

## 2. Current-state assessment

### Strengths to preserve
- **Clean layering:** `types.ts` → `db.ts` → `stores/data.ts` → pages.
- **Multi-theme token system** (`app.css`): Vercel / Apple / Resend design
  languages driven by `<body>` classes. A genuine differentiator — keep and extend.
- **Guest-first / offline-capable:** works with no backend, syncs when authed.
- **Process discipline:** specs + plans in `docs/superpowers/`, ESLint + Stylelint
  (bans hardcoded hex), Playwright smoke tests.

### Weaknesses (evidence-based)

**Architecture / base**
1. **i18n is dead code.** `src/lib/i18n/{index,en,th}.ts` and a `lang: 'en'|'th'`
   setting exist, but **no file imports them** — the entire UI is hardcoded English.
   The audience is Thai TCAS students. Biggest product gap.
2. **`db.ts` doesn't scale** (515 lines): every entity hand-duplicates a
   `guest → localStorage` / `auth → supabase` branch.
3. **Two sources of truth for exam date:** `settings.examDate` vs a raw
   `pulse_exam_date` localStorage key read directly in `dashboard/+page.svelte:33`.
4. **Settings are localStorage-only** — no cross-device sync for logged-in users.
5. **Silent data gap:** auth sessions capped at 90 days (`db.ts:258`) but the
   Journey heatmap spans ~16 weeks (~112 days) → logged-in users lose ~3 weeks.
6. **No unit tests** on the real logic (`srs.ts` SM-2, `scheduler.ts` auto-schedule).

**Multi-device**
7. **One breakpoint (768px).** No iPad tier; the desktop dashboard is a centered
   **600px column** (`dashboard/+page.svelte:163`) — a phone layout on a big screen.
8. **Interaction overflow bug:** anchored popovers use naive static offsets with no
   collision handling. `WeekGrid.svelte:579` pins the create-popover at `left: 0`,
   `top: {clickY}`, fixed `width: 240px` — so near the right/bottom edge it spills
   off-screen and its "Add block" button becomes unreachable. Affects desktop + mobile.
9. **PWA polish:** manifest `theme_color` hardcoded rose `#f43f5e` (matches no theme),
   `orientation` locked to `portrait` (wrong for iPad), no offline fallback / install UX.

**Product / QoL**
10. **`insights` is a "Coming soon" stub** sitting in the primary sidebar nav.
11. **No error feedback** — db errors are swallowed; users never learn a save failed.
12. **`WeekGrid.svelte` is 811 lines** — hard to reason about and change safely.

---

## 3. Roadmap & sequencing

| WS | Theme | Why here |
|----|-------|----------|
| **WS1** | Foundation | De-risks everything downstream. Build first. |
| **WS2** | Multi-device & interaction correctness | Most visible QoL; fixes the popover bug class; answers the device question. |
| **WS3** | Thai i18n | Biggest product gap; benefits from WS1 settings-sync. |
| **WS4** | Features | `insights`, exam simulation — ride on the clean base. |
| **WS5** | Polish | a11y, toast→undo, midnight-aware "today", decomposition. |
| **WS6** | Motion & design refinement | **LAST**, by request. Aesthetic layer on a correct, complete app. |

---

## 4. WS1 — Foundation (implementable detail)

### 4.1 Data layer → new `src/lib/data/` (retires `db.ts`)

```
src/lib/data/
  repository.ts        # generic repository<T>(config)
  adapters/local.ts    # localStorage adapter
  adapters/supabase.ts # table + mapper adapter
  entities.ts          # per-entity config wiring stores + tables
  mappers.ts           # snake_case <-> camelCase per entity
```

**Generic engine** (illustrative):

```ts
export interface Adapter<T> {
  list(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface RepoConfig<T extends { id: string }> {
  lsKey: string;
  table: string;
  store: Writable<T[]>;
  toRow: (item: T) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
  order?: (a: T, b: T) => number;
}

export function repository<T extends { id: string }>(cfg: RepoConfig<T>) {
  const pick = (): Adapter<T> => {
    const { mode, userId } = get(authCtx);
    return mode === 'guest' ? localAdapter(cfg) : supabaseAdapter(cfg, userId);
  };
  return {
    async load() {
      const items = await pick().list();
      cfg.store.set(cfg.order ? [...items].sort(cfg.order) : items);
      return items;
    },
    async save(item: T) {
      cfg.store.update(a => upsert(a, item));      // optimistic write-through
      try { await pick().save(item); }
      catch (e) { toasts.error("Couldn't save — retry"); throw e; }
    },
    async remove(id: string) {
      cfg.store.update(a => a.filter(x => x.id !== id));
      try { await pick().remove(id); }
      catch (e) { toasts.error("Couldn't delete — retry"); throw e; }
    },
  };
}
```

**Per-entity config:**

```ts
export const subjectsRepo = repository<Subject>({
  lsKey: 'pulse.subjects',
  table: 'subjects',
  store: subjects,
  toRow: subjectToRow,
  fromRow: subjectFromRow,
  order: (a, b) => a.orderIndex - b.orderIndex,
});
// topics, srsCards, sessions, tasks, templates, scheduleSlots, scores, idealWeekSlots
```

`loadData()` becomes `Promise.all([subjectsRepo.load(), topicsRepo.load(), …])`.

**Wins:**
- 515-line if/else collapses to one engine + small typed configs.
- **Write-through removes manual `store.update()` from pages** → the "stale data"
  gotcha class disappears structurally.
- A `MockAdapter` makes the data layer unit-testable.
- One try/catch boundary routes write failures to the toast store (§4.4) instead
  of swallowing them.

> Schema/query specifics (e.g. the sessions window) follow
> `supabase:supabase-postgres-best-practices` when the plan is written.

### 4.1a Reconciliation with the real `db.ts` (from the 2026-05-29 readiness review)

The generic engine above is the **common-case** path (list / upsert-save / remove).
A readiness review found ~9 of the 28 `db` methods do **not** fit it. The plan keeps
these as **explicit typed methods that extend each entity's repo** — it must NOT force
them through generic `save`/`remove`. The repository approach stands; it just isn't uniform.

**Engine contract additions**
- `Adapter.list(opts?)` — reads may take options (window/range); `load(opts?)` forwards them.
- **Read-error contract (G13):** `list()` resolves **empty-on-error, never rejects**
  (mirrors today's `(data ?? [])`), so `loadData`'s `Promise.all` and the reactive
  `loadScheduleSlots` can't become unhandled rejections at mount.
- **Write-failure contract / rollback (G8):** `save`/`remove` **snapshot the store**,
  apply the optimistic update, and on failure **revert to the snapshot + toast**. The repo
  **owns** the failure (no re-throw by default) so the 30 uncaught / 4 fire-and-forget
  write call sites can't throw unhandled rejections.
- `newId()` stays exported (data module or `src/lib/id.ts`) — 11 call sites use it (G9).

**Methods that extend the generic repo**

| Method | Why it's special | Design |
|---|---|---|
| `topicsRepo.create(topic): SrsCard` | `saveTopic` creates+returns an `srs_card`; 2 call sites use the return (G3) | Upsert topic, ensure exactly one card (derive card id deterministically to kill the rename-duplicate bug at `db.ts:217`), write-through **topics + srsCards**, return card. Reads `userId` from `authCtx`. Topic *edits* use generic `save`. |
| `subjectsRepo.removeCascade(id)`, `topicsRepo.removeCascade(id)` | guest cascade-deletes related topics/cards (G2) | Guest: purge dependent localStorage + refresh **subjects/topics/srsCards** stores. Auth: rely on FK `on delete cascade` — **migrations must declare** cascades on `topics.subject_id`, `srs_cards.topic_id` (+ `srs_cards.subject_id`). |
| `sessionsRepo.log(s)` vs `sessionsRepo.save(s)` | two writers: prepend-INSERT (timer/dashboard) vs UPSERT (analytics edit) (G5) | Distinct methods, newest-first ordering. |
| `srsRepo.update(card)` | update-only, never insert; sets `updated_at` (G5) | Column-subset update, distinct from generic upsert so SM-2 writes don't insert. |
| `scheduleRepo.loadWeek(start,end)` | windowed; loaded per viewed week, **outside** `loadData` (G4/G6) | Stays out of the `loadData` `Promise.all`; called reactively per week (preserve `schedule/+page.svelte:187`). |
| `scheduleRepo.confirmAll(slots)` | bulk flag-flip + persist (G6) | Transform `isConfirmed`/`isAiSuggested`, persist all, one store update. |
| `sessionsRepo.load({ sinceDays: HISTORY_DAYS })` | 90-day window, auth-only today; guest uncapped (G4) | Apply the window in **both** modes for parity; `HISTORY_DAYS` shared with the heatmap (§4.3). |
| `getSubjects` onboarding seed | guest synthesizes `Subject[]` from onboarding names + writes back (G7) | **Move the names→`Subject[]` transform into onboarding** so it writes proper `Subject[]` under `pulse.subjects`; repo `list()` stays pure. Requires editing `onboarding/+page.svelte`. |

**Dropped (YAGNI):** `idealWeekSlots` CRUD (`db.ts:444-475`) has **zero callers and no store** —
remove from WS1 scope; re-add with a store + loader only if a feature needs it (G6).

### 4.2 Settings sync → `user_settings` table

```sql
create table user_settings (
  user_id    uuid primary key references auth.users on delete cascade,
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy "own settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- Guests: localStorage (unchanged).
- Authenticated: load row → merge over `defaults()`; debounce-write on change.
- A single JSONB blob fits a per-user settings object always read/written whole,
  and tolerates the evolving `Settings` interface without migrations.
- Gives **exam date one home** (see §4.3).

**Reconciliations the plan must handle (G10):**
- **Not a `repository<T>` entity** — settings is a single per-user object with no `id`;
  it gets its own single-row sync module, never the array repo.
- **Reconcile the divergent interface FIRST:** `types.ts:8-20 Settings` lacks `examDate`
  while `settings.ts` has it — delete the stale `types.ts` copy and unify on the
  `settings.ts` shape *before* wiring sync.
- **Auth hydration without echo:** on login `SELECT … maybeSingle()` (absent row = new
  user → `defaults()`), merge over defaults, then apply via a **guarded path that does NOT
  re-fire the debounced upsert**. Replace the blanket per-change `subscribe`
  (`settings.ts:63-65`): guest → localStorage; auth → debounced upsert on `user_id` conflict.

### 4.3 Single sources of truth (greenfield cleanup)
- **Exam date — three touch points, not one (G11):** `onboarding/+page.svelte:35`
  *writes* a raw `pulse_exam_date`, `dashboard/+page.svelte:32` *reads* it, and `schedule`
  reads `$settings.examDate` — so the onboarding value never reaches the scheduler today.
  Fix: onboarding sets `settings.examDate`; **delete `pulse_exam_date` everywhere**; all
  readers use `$settings.examDate`.
- **History window — reconcile 90 vs 112 (G11):** `db.ts:259` caps auth sessions at 90 days
  but `HeatmapGrid.svelte:7` `WEEKS=16` (112 days) and `journey/+page.svelte:89` hardcodes
  "Last 16 weeks" → ~3 weeks of heatmap permanently blank for auth users. Set
  `HISTORY_DAYS=112`, derive the heatmap `WEEKS` + label from it, and apply the window to
  **both** guest and auth (today guest is uncapped).
- **localStorage namespace:** `pulse.<entity>` keys + a `pulse.schemaVersion` key,
  set cleanly now.

### 4.4 Lightweight feedback (toast)
- New `src/lib/stores/toast.ts` (`{ id, kind, message }[]`) + `<Toaster/>` mounted
  in `(app)/+layout.svelte`. Fixed position, safe-area aware.
- The repository pushes write/delete failures here. Minimal — not a notification
  system. Expanded into confirmations/undo in WS5.

### 4.5 Tests
- Add **Vitest** (only Playwright exists today).
- Unit tests:
  - `srs.ts` — SM-2 transitions (again/hard/good/easy), interval growth, ease floor.
  - `scheduler.ts` — auto-schedule honouring school hours, energy profile, buffers.
  - `repository.ts` — `MockAdapter`: save → store updates; correct mode routing.
- Keep Playwright for smoke flows.

**Setup specifics the plan must pin (G12):**
- **Config:** add `vitest` (no jsdom needed); a standalone `vitest.config.ts` with
  `resolve.alias` `$lib → ./src/lib`, `test.environment: 'node'`, and `test.include`
  scoped to `src/**/*.{test,spec}.ts` so the Playwright `./tests` dir isn't picked up;
  add a `test:unit` script separate from `test:e2e`.
- **Determinism:** `srs.ts` and `scheduler.ts` are headless but **not pure** — both call
  `new Date()` and `scheduler` uses `Math.random()` in `makeId()`. Tests must
  `vi.useFakeTimers()` / `vi.setSystemTime()` and `vi.spyOn(Math, 'random')`.
- **Repository test:** `repository.ts` reads `get(authCtx)`, so the `MockAdapter` test
  must mock `authCtx`/stores to exercise both mode routes.

### 4.6 WS1 acceptance
- `npm run check`, `npm run lint`, `npm run test:unit`, Playwright all green.
- **No page imports `db.ts`** — all data access goes through the `data/` module
  (windowed/extended repo methods are not violations).
- Exam date has one home (`settings.examDate`); `HISTORY_DAYS` drives both the sessions
  window and the heatmap.
- A forced **write** failure reverts the optimistic store update **and** toasts — no
  unhandled rejection, including at the fire-and-forget schedule call sites.
- A forced **read** failure leaves stores at their prior value (no unhandled rejection at mount).
- Deleting a subject leaves **no orphaned topics/cards** in either guest or auth mode.

### 4.7 Call-site migration inventory (G9)
**50 `db.*` call sites across 14 files** (`stores/data.ts` + 12 routes + onboarding):
**8 reads, 11 `newId()` (no I/O), 31 writes.** Migration rules:
- Each write today pairs a manual `store.update` with the `db` call — some optimistic
  (before `await`), some post-await. Write-through removes the manual update **except**
  where the repo now owns related-store updates (cascades, `topicsRepo.create`) — those
  move *into* the repo, not deleted blindly from pages.
- `db.newId()` stays exported (data module or `src/lib/id.ts`).
- `onboarding` `saveSubject` (the only call site with `try/catch` + a `saveError` UX) must
  be reconciled with the toast/rollback path, not dropped.
- The 4 fire-and-forget schedule writes (`schedule/+page.svelte:105,118,138,161`) become
  safe under the repo-owns-failure contract (§4.1a).

---

## 5. WS2 — Multi-device design (mobile / iPad / PC)

### 5.1 Breakpoint tiers (replacing the single 768px flip)
Standardise two numeric breakpoints (documented in `app.css`; CSS vars can't be
used in media queries, so these are a convention applied consistently):

| Tier | Range | Navigation | Content |
|------|-------|-----------|---------|
| Phone | `< 768px` | bottom tab bar *(today)* | single column, full-screen pages |
| iPad | `768–1023px` | **icon rail** (icons + hover labels) | 2-column; master-detail begins |
| Desktop | `≥ 1024px` | full sidebar *(today)* | multi-column / bento; persistent detail panes |

The new **iPad tier** is the key change: today iPad jumps straight to the desktop
sidebar at 768 and shows a 600px content column. The rail + 2-col layout makes it
feel native, not like a stretched phone.

### 5.2 Layout adaptivity
- **Dashboard:** stack (phone) → 2-col (iPad) → bento/3-col (desktop); drop the
  fixed 600px cap on wide screens (fluid max-width that scales per tier).
- **Subjects / Schedule / Scores:** **master-detail** on iPad+ (list left, detail
  right) instead of full-page navigation; stays push-navigation on phone.
  Consider **container queries** for these panes so they adapt to pane width, not
  just viewport.
- **Schedule `WeekGrid`:** fewer days / horizontal scroll on phone, full week on
  iPad+. Decompose the 811-line component as part of this work.

### 5.3 Interaction correctness (the popover bug + audit)
**Root cause:** anchored floating UI uses static offsets with no collision handling.

- Build **one shared anchored-positioning utility** — a Svelte action
  `src/lib/actions/anchored.ts`:
  - measures anchor point/rect and the floating element's own size after render;
  - **flips** vertically/horizontally when there's no room below/right;
  - **clamps** within the viewport with a gutter;
  - collapses to a **centered bottom-sheet** under 768px;
  - is safe-area aware.
  - (A small custom action keeps the minimal-deps ethos; `@floating-ui/dom` is a
    battle-tested drop-in alternative if preferred — decide in the plan.)
- Apply it to `BlockPopover` (fixes `WeekGrid.svelte:579`).
- **Audit every floating / absolutely-positioned interactive element** for the same
  trap and verify each at screen edges/corners on phone + iPad + desktop:
  `BlockPopover`, `ConfirmDialog`, `MoreDrawer`, native/select dropdowns,
  `QuickLog`, `ScoreForm` controls, and the new toasts.
- Add an edge/corner positioning check to the `verify` routine for this WS.

### 5.4 PWA
- Drop `orientation: portrait` (allow iPad rotation).
- Make `theme_color` track the active theme (runtime meta already updates in
  `+layout.svelte`; align the manifest default to a neutral that matches).
- Add an offline fallback page and a tasteful install prompt.
- Fix the tab bar's `opacity: 0.55` inactive contrast (a11y).

---

## 6. WS3 — Thai i18n (outline)
- Wire `$t` into every page and shared component (replace hardcoded strings),
  starting with nav + shared components.
- Bring `th.ts` to parity with `en.ts`; add missing keys; follow `better-i18n`.
- Surface language choice in onboarding + settings (setting already exists).
- Thai-appropriate date/number formatting.

## 7. WS4 — Features (outline)
- Replace the `insights` stub with real content (or hide from nav until ready).
- Land the existing **exam simulation** plan
  (`docs/superpowers/plans/2026-05-28-exam-simulation.md`) on the new repository.

## 8. WS5 — Polish (outline)
- Expand toast → confirmations / undo.
- Accessibility pass (contrast, focus order, labels) — use
  `chrome-devtools-mcp:a11y-debugging`.
- Midnight-aware "today" derivations (stores recompute across date change).
- Decompose any remaining oversized components.

## 9. WS6 — Motion & design refinement (LAST, by request)
- **Motion tokens:** extract the repeated hardcoded durations/easings
  (e.g. `cubic-bezier(0.34,1.56,0.64,1)`) into `--ease-spring`, `--ease-out`,
  `--dur-fast/base/slow`. A documented motion language.
- **More life:** route/page transitions, staggered list entrances, number
  count-ups on stats, refined hover/press states, skeleton-free graceful loads.
- **Design-system audit:** confirm tokens cover every need across all 5 themes;
  ensure each design language's motion personality is distinct yet consistent.
- All motion respects `prefers-reduced-motion` (pattern already established).
- Skills: `animate`, `css-animations`, `ui-ux-pro-max`, `color-expert`.

---

## 10. Non-goals (YAGNI)
- No migration tooling (greenfield).
- No new backend services beyond `user_settings`.
- No third-party UI framework / component library — keep plain CSS + tokens.
- WS6 is refinement, not a redesign — the 3 design languages stay.

## 11. Next step
After this spec is reviewed and approved, invoke `superpowers:writing-plans` to
turn **WS1 — Foundation** into the first implementation plan. WS2–WS6 get their
own specs when their turn comes.
