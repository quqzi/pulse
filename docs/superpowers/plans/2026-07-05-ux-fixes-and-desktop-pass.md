# UX Fixes, Math Input & Desktop Pass — Implementation Plan

> Five phases, one PR each, user merge approval between phases.
> Source: user bug reports + full app review (2026-07-05). All diagnoses browser/DB-verified.

## Phase 1 — Quick-fix batch

1. **Sidebar accent line shifts on press** — `Sidebar.svelte:130` applies `transform: scale(0.96)` to the whole `.nav-item` on `:active`, which scales the absolutely-positioned `::before` accent bar with it. Fix: press-scale only the icon + label (children), never the bar. Check `MoreDrawer.svelte` for the same pattern.
2. **Schedule resize has no visual preview when shrinking** — resize ghost renders at `z-index: 5` under the block (`WeekGrid.svelte:827`), so a shrinking preview is fully hidden. Fix: in resize mode render the ghost above blocks (dashed outline style, `z-index` above `.slot-wrap`) + a small time chip ("19:00 – 20:30") computed from `ghostTop`/`ghostHeight`.
3. **Schedule header month label** — a week straddling two months shows only the first month ("June 2026" for Jun 29 – Jul 5). Show "Jun – Jul 2026".
4. **Readiness ring "%" typography** on dashboard — the floating `%` looks broken; align it with the number.
5. **Test-account note repair** *(prod write — explicit go-ahead required)* — 4 seeded notes for user `70b6611f-…` contain literal `\n` two-char sequences (DB-confirmed). Rewrite those 4 bodies with real newlines via SQL. No app code change; UI-created notes are unaffected.

## Phase 2 — Log session upgrade (dashboard QuickLog)

- Replace the gray Subject dropdown with a **colored subject chip row** (consistent with subject cards elsewhere). Topic stays a picker, filtered by chip selection.
- Add **time period**: preset chips `just now / this morning / this afternoon / custom`, custom = start + end time inputs. Compute `startedAt`/duration accordingly; `sessionsRepo.log` already accepts the fields — verify mapper passes `started_at` through.
- Keep 44px targets on mobile; both i18n files.

## Phase 3 — Math input unification

- New shared component `src/lib/components/MathInput.svelte`: CodeMirror 6 field (single- or multi-line prop) with a KaTeX **widget decoration** — `$…$` / `$$…$$` replaced by rendered math when the cursor is outside the span (same interaction as notes' live markdown marks).
- Use it in: **notes LiveEditor** (add the math decoration there — notes currently do NOT render math at all), **exam question form** (question text + each choice; replaces the separate liveTail preview rows), **flashcard front/back** editors.
- Read surfaces (exam run, flashcard study, bank rows) keep `MathText`.
- Unit tests for the decoration ranges helper (pure function: given doc text + cursor, return math spans to replace).

## Phase 4 — Exam design upgrade

- **Config page**: two-column desktop layout — options (subjects, difficulty, count, timer mode) left; sticky summary card right ("10 questions · Physics · ~30 min" + Start CTA). Styled selected states instead of plain outline pills.
- **Run screen**: header with progress bar + timer; choice rows with hover/selected states and letter badges; topic badges kept.
- **Results screen**: score hero + **per-topic breakdown** (topics now exist on questions) + "review these topics" links to the subject page.
- All five themes; EN/TH.

## Phase 5 — Desktop layout pass (mobile-column-on-PC fix)

Survey finding: nearly every page caps content at 560–780px (exam 600, tasks 600, timer 480, analytics 720, notes 760, groups 600…); only schedule uses the width.

- Introduce a wider standard content width (~960–1100px) and per-page multi-column grids **at ≥1024px only**; phone layouts untouched.
- Priority order: dashboard (hero + readiness side-by-side; subjects + quick-log as a row), analytics (stats row + 2-col chart/sessions), tasks (list + suggested/completed rail), notes list (2-col card grid), flashcards decks (grid), groups, insights, journey, scores.
- Timer stays intentionally narrow (focus surface); exam handled in Phase 4.

## Verification (every phase)

`npm run check` (0 errors) · `npx vitest run` green · browser-verify the exact changed surfaces at 1440px AND 390px, EN + TH, plus one dark theme · `code-review` on the diff → PR → user merge approval.
