# Mobile A11y — Touch Targets, Tab-bar Contrast, /review Message — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm), pending implementation plan
**Parent:** WS2.1 (interaction correctness) — the "mobile functionality audit" outcome.
**Source:** mobile audit (2026-06-03) — swept every page on iPhone emulation; no layout/overflow bugs, but many interactive controls fall below the touch-target minimum, plus two smaller a11y/UX gaps.

---

## 1. Problem

On a phone, many controls are smaller than the **44px** Apple-HIG touch-target minimum, making them error-prone to tap (measured in the audit):

| Page / component | Control | Current height |
|---|---|---|
| Timer | `.mode-tab` / `.focus-toggle` | 31px / 23px |
| Dashboard `QuickLog` | `.field-select` / `.log-btn` / `.duration-input` | 36–37px |
| Tasks | `.filter-btn` | 28px |
| Subjects | `.add-btn` / `.templates-link` | 32px / 18px |
| Scores | `.btn-add-score` | 31px |
| Settings | `.num-input` / range slider | 34px / 16px |

Two smaller gaps from the same audit:
- **Tab bar** inactive items use `color: var(--muted)` at `opacity: 0.55` — fails WCAG AA contrast.
- **`/review`** silently `goto('/dashboard')` when no SRS cards are due — feels broken (no explanation).

## 2. Goal

Every flagged interactive control is **≥44px** on phones; the bottom tab bar's inactive labels meet contrast; and landing on `/review` with nothing due gives a brief, friendly message instead of a silent redirect. **Desktop layouts are unchanged.**

## 3. Non-goals (YAGNI)

- No redesign of any control — only size/contrast/feedback.
- No change to desktop sizing (the 44px bumps are mobile-scoped).
- No new components; no schema/data changes.
- Other audit "Low" items (Insights placeholder CTA, energy-chip layout) are out of scope.

## 4. Decisions (from brainstorm)

- **Minimum touch target: 44px** (Apple HIG).
- **Scope the size bumps to `@media (max-width: 768px)`** — consistent with the app's breakpoint convention; desktop stays compact.
- **Bundle** all three fixes into one a11y slice.

## 5. Design

### 5.1 Touch targets (≥44px, mobile only)
For each flagged control, inside a `@media (max-width: 768px)` block in its own component's scoped `<style>`, set `min-height: 44px` and ensure content stays centered (add `display: flex; align-items: center; justify-content: center;` where the element isn't already laying out its content centered, e.g. button-like controls). Square icon buttons get `min-width: 44px` too. Specifically:
- `timer/+page.svelte`: `.mode-tab`, `.focus-toggle`.
- `QuickLog.svelte`: `.field-select`, `.log-btn`, `.duration-input`.
- `tasks/+page.svelte`: `.filter-btn`.
- `subjects/+page.svelte`: `.add-btn` (44×44 square), `.templates-link` (grow tap area via `padding` + `display: inline-flex; min-height: 44px; align-items: center`).
- `scores/+page.svelte` (or `scores/ScoreForm.svelte` — whichever owns `.btn-add-score`): `.btn-add-score`.
- `settings/+page.svelte`: `.num-input` (`min-height: 44px`); the range `<input type="range">` gets a taller hit area (wrap or `min-height: 44px` + padding so the touch zone ≥44px).

Form controls (`select`, `input`) need `box-sizing: border-box` (most already inherit it globally) so `min-height` + padding don't overflow.

### 5.2 Tab-bar contrast
In `TabBar.svelte`, the inactive `.tab-item` uses `color: var(--muted); opacity: 0.55`. Remove the `opacity: 0.55` so inactive items render at full-strength `var(--muted)`. Verify `var(--muted)` on the tab-bar background (`var(--bg2)`) meets **WCAG AA (≥4.5:1 for text, or ≥3:1 acceptable for the small icon+label nav)** across all five themes; if any theme falls short, introduce a dedicated `--tab-inactive` token (or darken `--muted`) for that theme. Active items are unchanged (`var(--primary)`, opacity 1).

### 5.3 `/review` nothing-due message
In `review/+page.svelte`, `onMount` currently does `if (queue.length === 0) { goto('/dashboard'); return; }`. Replace the silent redirect with a toast then redirect, using the existing toast store (`$lib/stores/toast`): push an info toast such as "No cards due — you're all caught up 🎉", then `goto('/dashboard')`. (Keep it a redirect, not a new empty-state page — YAGNI.)

## 6. Testing
No unit tests (scoped CSS + a one-line toast). **Browser / mobile-emulation** verification:
- On an iPhone viewport, measure each flagged control — every one is `height ≥ 44`.
- Tab bar: inactive items render without the 0.55 opacity; eyeball/contrast-check the inactive label against the bar across a light and a dark theme.
- `/review` with no due cards: a toast appears, then it lands on `/dashboard`.
- Desktop (≥768px): the controls are visually unchanged from before (the bumps don't apply).

## 7. File summary
| File | Change |
|---|---|
| `src/routes/(app)/timer/+page.svelte` | `.mode-tab`, `.focus-toggle` ≥44px (mobile) |
| `src/lib/components/QuickLog.svelte` | `.field-select`, `.log-btn`, `.duration-input` ≥44px (mobile) |
| `src/routes/(app)/tasks/+page.svelte` | `.filter-btn` ≥44px (mobile) |
| `src/routes/(app)/subjects/+page.svelte` | `.add-btn` 44×44, `.templates-link` tap area (mobile) |
| `scores` control owner (`scores/+page.svelte` or `ScoreForm.svelte`) | `.btn-add-score` ≥44px (mobile) |
| `src/routes/(app)/settings/+page.svelte` | `.num-input` ≥44px, range hit area (mobile) |
| `src/lib/components/TabBar.svelte` | drop inactive `opacity: 0.55`; verify/adjust contrast |
| `src/routes/(app)/review/+page.svelte` | toast before redirect when nothing due |

## 8. Next step
Invoke `superpowers:writing-plans`.
