# WS2 — Multi-device & Interaction Correctness — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm), pending implementation plans
**Roadmap parent:** `docs/superpowers/specs/2026-05-29-pulse-roadmap-and-foundation-design.md` §5–§8 (WS2)
**Builds on:** WS1 data-layer foundation (complete — repository engine, stores restructure, settings sync)

---

## 1. Problem & motivation

Pulse today assumes a desktop mouse and a single 768px breakpoint that flips straight
from phone to the full desktop sidebar. This causes three concrete, user-felt problems:

1. **Features that don't work on touch at all.** `CalBlock` (schedule blocks) is
   `mousedown`-only — its drag event is literally typed `MouseEvent` (`CalBlock.svelte:85`,
   `:15`). On a phone or iPad you **cannot move or resize a scheduled block**. WeekGrid has
   partial touch support for *creating* blocks but not *manipulating* them.
2. **Floating UI clips at screen edges.** Anchored elements use static offsets with no
   collision handling. `BlockPopover` is positioned with a hard-coded
   `left: 0; width: 240px` (`WeekGrid.svelte:581`) and overflows the viewport near the
   right edge. The same trap exists across other floating/absolute elements.
3. **iPad feels like a stretched phone.** At 768px the app jumps to the desktop sidebar
   and a ~600px content column, wasting the tablet's space.

The user's explicit ask: *"the UI not working well for phone — something only supports
desktop like moving a block on schedule. Also check everything else if it works on mobile."*
WS2 is therefore reframed from "make it look right on tablet" to **"make existing features
actually work on every device, then make the layouts native to each tier."**

## 2. Goals

- Every existing interaction works by **touch** (mouse + touch + pen unified).
- No floating element clips or overflows at any screen edge, on any tier.
- A real **iPad tier** (768–1023px) with native-feeling layout and navigation.
- Phone layouts are usable single-column; the schedule is operable on a small screen.
- The PWA is rotation-friendly, theme-aware, installable, and has an offline fallback.

## 3. Non-goals (YAGNI)

- No motion/animation polish — that is WS6, sequenced last by request.
- No redesign of the three design languages (Vercel / Apple / Resend stay).
- No new backend services.
- No third-party **UI component** library. (`@floating-ui/dom` is a positioning *utility*,
  not a component kit — explicitly in scope per §6 decision.)
- No new features — WS2 is correctness + adaptivity for what already exists.

## 4. Decomposition & sequencing

One WS2 spec (this document); `writing-plans` slices it into three small, independently
shippable sub-plans — matching the WS1 rhythm (one roadmap → plans 1.1–1.4).

**Chosen approach: correctness-first.**

| Sub-plan | Title | Why this order |
|---|---|---|
| **WS2.1** | Interaction & touch correctness | Fixes the broken-on-mobile pain first; everything else sits on correct interactions. |
| **WS2.2** | Responsive layout & adaptivity | Native per-tier layouts on a correct interaction base. |
| **WS2.3** | PWA | Cleanly independent; good final polish. |

Sequence: **2.1 → 2.2 → 2.3**, each its own branch + PR.

## 5. Shared primitives (foundation)

Three small, single-purpose units that the sub-plans consume. Introduced as needed
(WS2.1 brings the tier convention + the two actions; WS2.2 leans on them for layout).

### 5.1 Breakpoint tiers
Two numeric breakpoints, three tiers. CSS custom properties cannot be used in media
queries (documented gotcha), so the breakpoints are a **convention** applied consistently.

| Tier | Range | Navigation | Content |
|------|-------|-----------|---------|
| Phone | `< 768px` | bottom tab bar *(today)* | single column, full-screen pages |
| iPad | `768–1023px` | **icon rail** (icons + hover labels) | 2-column; master-detail |
| Desktop | `≥ 1024px` | full sidebar *(today)* | multi-column / bento |

- **CSS:** raw `768` / `1024`, documented in one convention comment block in `app.css`.
- **JS logic:** `src/lib/stores/viewport.ts` — a `matchMedia`-backed readable store exposing
  `tier: 'phone' | 'ipad' | 'desktop'`. Components read it **only** for behavioural
  decisions (popover→bottom-sheet, master-detail toggle, WeekGrid day count). Pure styling
  stays in CSS. SSR-safe default (`desktop`) to avoid a hydration flash; updates on mount.

### 5.2 `src/lib/actions/anchored.ts`
A thin Svelte `use:` action wrapping **`@floating-ui/dom`**. Responsibilities:
- measure anchor rect + floating element size after render;
- **flip** vertically/horizontally when there's no room;
- **shift/clamp** within the viewport with a gutter;
- under 768px, collapse a transient popover to a **centered bottom-sheet**;
- safe-area aware (`env(safe-area-inset-*)`).
API sketch: `use:anchored={{ anchor, placement, strategy, sheetUnder: 768 }}`.

### 5.3 `src/lib/actions/draggable.ts`
A Svelte action using **Pointer Events** — one code path for mouse + touch + pen. Provides
drag-move and resize with: long-press-to-grab on touch (so the page still scrolls),
`touch-action` management to avoid scroll/drag conflict, and pointer capture. Emits
normalized `dragstart / dragmove / dragend` detail with `PointerEvent` payloads.

## 6. Decisions made (during brainstorm)

- **Positioning engine: `@floating-ui/dom`** (not a hand-rolled action). Correctness is the
  goal of WS2.1; collision math is where positioning bugs hide, so use the tested ~1–2kb
  tree-shakeable utility. Wrapped behind `anchored.ts` so the dependency is swappable.
- **Touch: Pointer Events**, not parallel touch handlers — unifies input modalities.
- **Master-detail: container queries**, so panes respond to pane width, not just viewport.
- **WeekGrid decomposition is bundled into WS2.2** (we're already reworking it for responsive
  + touch; it's 813 lines and oversized).
- **Master-detail is included** for subjects / schedule / scores on iPad+ (the most opinionated
  UX shift in WS2; full-page nav remains on phone).

---

## 7. WS2.1 — Interaction & touch correctness

### 7.1 Touch / pointer drag
- Build `draggable.ts` (§5.3).
- Refactor `CalBlock` drag-move + resize off `mousedown`/`MouseEvent` onto the action;
  change the `dragStart` event payload type `MouseEvent → PointerEvent`.
- Reconcile `WeekGrid`'s existing mouse + touch handlers through the same action so create,
  move, and resize share one path.
- Long-press-to-grab on touch; `touch-action` CSS so vertical week-scroll still works.

### 7.2 Anchored positioning + audit
- Build `anchored.ts` (§5.2); apply to `BlockPopover` (removes `WeekGrid.svelte:581`
  `left:0; width:240px`).
- **Audit + fix every floating / absolutely-positioned interactive element:**
  `BlockPopover`, `ConfirmDialog`, `MoreDrawer`, native `<select>` dropdowns, `QuickLog`,
  `ScoreForm` controls, `Toaster`.
- Each verified at screen **edges and corners** on phone + iPad + desktop.
- Transient popovers collapse to a centered bottom-sheet under 768px; safe-area aware.

### 7.3 Mobile functionality audit
- Systematic sweep of **every** app route on phone + iPad: dashboard, timer, subjects,
  `subjects/[id]`, `subjects/templates`, `subjects/templates/[id]`, tasks, analytics,
  schedule, scores, journey, insights, settings, and **`review`** (SRS flashcards).
- **Known desktop-only gap to fix here:** the `review` page rates cards via **keyboard
  shortcuts**, which don't exist on touch — it needs touch-accessible rating controls
  (on-screen buttons / swipe), not just a responsive layout.
- For each route: does every interaction work by touch? **Fix interaction-correctness gaps
  here; defer pure-layout gaps to WS2.2.** The audit checklist is recorded in the WS2.1 plan
  and its results captured as the plan executes.

### 7.4 Tab-bar contrast (a11y)
- Replace `TabBar.svelte` inactive `opacity: 0.55` (fails contrast) with a token-based muted
  color meeting WCAG AA in all five themes.

### 7.5 Verification
- Edge/corner positioning checks at all three tiers added to the `verify` routine.
- Touch exercised via Playwright touch emulation / chrome-devtools device mode.

---

## 8. WS2.2 — Responsive layout & adaptivity

### 8.1 Navigation per tier
- Phone bottom tab bar *(today)* / **iPad icon rail** (icons + hover labels — new state) /
  desktop full sidebar *(today)*. Implemented in `Sidebar.svelte` + `(app)/+layout.svelte`,
  driven by `$viewport.tier`.

### 8.2 Layout adaptivity
- **Dashboard:** stack (phone) → 2-col (iPad) → bento/3-col (desktop); drop the fixed 600px
  cap for a fluid max-width per tier.
- **Master-detail** on iPad+ for subjects / schedule / scores (list left, detail right);
  push-navigation on phone. Container queries on the panes.
- **WeekGrid:** fewer days / horizontal scroll on phone, full week on iPad+.

### 8.3 WeekGrid decomposition
- Decompose the 813-line `WeekGrid.svelte` into focused units (grid shell, day column,
  block layer, popover, now-line/shading helpers) as part of the responsive rework.

### 8.4 Verification
- Each page validated at phone / iPad / desktop widths; master-detail flows verified on iPad.

---

## 9. WS2.3 — PWA

All manifest changes are in `vite.config.ts` (`@vite-pwa/sveltekit`, `generateSW`).

- Remove `orientation: 'portrait'` → allow iPad rotation.
- `theme_color`: set a neutral default (currently the stale `#f43f5e`); the runtime
  `<meta id="meta-theme-color">` in `app.html` already tracks the live theme — manifest value
  is static at build, so a neutral default is correct.
- **Offline fallback page** via workbox `navigateFallback` (the app uses `generateSW`).
- **Install prompt:** capture `beforeinstallprompt`, show a tasteful custom prompt component.

### 9.1 Verification
- Installable (Lighthouse PWA), rotates on iPad, offline page renders with no network,
  install prompt appears and dismisses cleanly.

---

## 10. File-level change map (indicative)

| File | WS2.x | Change |
|---|---|---|
| `src/lib/stores/viewport.ts` | 2.1 | **new** — tier store |
| `src/lib/actions/anchored.ts` | 2.1 | **new** — floating-ui wrapper |
| `src/lib/actions/draggable.ts` | 2.1 | **new** — pointer-events drag/resize |
| `src/lib/components/calendar/CalBlock.svelte` | 2.1 | mouse→pointer drag/resize |
| `src/lib/components/calendar/WeekGrid.svelte` | 2.1 / 2.2 | reconcile drag; responsive; decompose |
| `src/lib/components/*` (popovers/dialogs/drawer) | 2.1 | adopt `anchored` |
| `src/lib/components/TabBar.svelte` | 2.1 | contrast fix |
| `src/app.css` | 2.1 / 2.2 | breakpoint convention; tier layouts |
| `src/lib/components/Sidebar.svelte` | 2.2 | icon-rail state |
| `src/routes/(app)/+layout.svelte` | 2.2 | tier-driven nav |
| `src/routes/(app)/{dashboard,subjects,schedule,scores}/+page.svelte` | 2.2 | bento / master-detail |
| `vite.config.ts` | 2.3 | manifest: orientation, theme_color |
| install-prompt component + offline page | 2.3 | **new** |

New dependency: `@floating-ui/dom`.

## 11. Next step

Invoke `superpowers:writing-plans` to turn **WS2.1** into the first implementation plan.
WS2.2 and WS2.3 get their plans when their turn comes.
