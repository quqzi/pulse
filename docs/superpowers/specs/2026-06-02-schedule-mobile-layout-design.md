# Schedule Mobile Layout — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm), pending implementation plan
**Parent:** WS2.2 (responsive layout & adaptivity) — pulled forward because the schedule's mobile layout is actively blocking use. Roadmap: `docs/superpowers/specs/2026-05-29-pulse-roadmap-and-foundation-design.md` §5.2.
**Builds on:** WS2.1a (schedule touch drag — move incl. cross-day, resize via Pointer Events), now on `master`.

---

## 1. Problem

On a phone the schedule page is hard to use, for two reasons:

1. **Scroll isn't contained.** The week-nav header and day-of-week labels don't stay pinned, so scrolling doesn't feel anchored to the actual time-grid.
2. **The side panels are switched off.** The current mobile CSS simply hides them:
   ```css
   @media (max-width: 768px) {
     .left-panel { display: none; }                          /* MiniMonth week-picker */
     :global(.schedule-sidebar) { display: none !important; } /* THIS WEEK / BY SUBJECT / SRS / AI */
     .main-area { overflow-x: auto; }
   }
   ```
   This hides not just stats but the **AI accept-all / reject-all** controls — a *functional* gap: you cannot bulk-confirm auto-scheduled blocks on mobile. (Per-block accept/dismiss via the block popover still works.)

The ExamBanner stays visible (it lives inside `.main-area`, not a hidden panel).

## 2. Goals

- On phone, the page fills the viewport and **does not page-scroll**; the week-nav header and day-of-week row are **pinned**, and only the **time-grid body** scrolls.
- All hidden panel content is reachable on mobile: AI accept/reject, THIS WEEK, BY SUBJECT, SRS due, and the week picker.
- Pending AI suggestions are **always surfaced** (a visible count), closing the functional gap.
- The full 7-day week stays visible on phone, preserving the week overview and the cross-day drag from WS2.1a.
- Desktop layout is unchanged.

## 3. Non-goals (YAGNI)

- No change to the desktop 3-column layout.
- No master-detail / iPad tier work here (that's the broader WS2.2). This slice is phone-focused; the `≥768px` layout is untouched except where shared CSS is refactored.
- No new schedule features. Reuse existing panel components as-is.
- Not building the WS2 `viewport` tier store now — a local `matchMedia` suffices for this slice (consolidate later when WS2.1's viewport work lands).

## 4. Chosen approach: bottom sheet

The grid stays the hero with contained scroll. A slim, always-visible **trigger tab** at the bottom of the grid opens a **bottom sheet** containing all the panel content. (Chosen over "panels below grid" — which reintroduces page scroll and shrinks the grid — and "Week/Summary tabs" — which puts stats a tab away from the grid.)

## 5. Design

### 5.1 Scroll containment & grid (phone)
**Root cause (verified):** WeekGrid *already* self-contains its scroll — `.grid-header`, `.load-bar-row`, `.allday-row` are `flex-shrink:0` (pinned) and only `.grid-scroll` scrolls. The page-scroll problem is the **app layout**: `(app)/+layout.svelte` makes `.main-content` `overflow-y: auto` with `20px` padding inside a `100dvh` shell, so the schedule (a fixed-height app) sits in a *scrolling, padded* container and the whole thing scrolls.

**Fix — make the schedule route full-bleed:**
- The `/schedule` route opts `.main-content` out of its padding and `overflow-y: auto` (e.g. a route-conditional `full-bleed` class on `.main-content` in `(app)/+layout.svelte`, keyed off `$page.route.id`). Other routes keep the padded, scrolling content area.
- With that, `.schedule-wrap` (`height: 100%`, `overflow: hidden`) fills the shell minus the tab bar; WeekGrid's existing internal scroll is then the only scroll, and its day-of-week header row stays pinned. **No structural change to WeekGrid is required.**
- Full **7-day week**; columns stay narrow with the existing `min-width:560px` + `.main-area { overflow-x:auto }` horizontal scroll (preserves overview + cross-day drag reach).
- **ExamBanner** becomes a slim one-line strip on phone so it doesn't eat grid height.

### 5.2 Bottom sheet
- **Closed:** a slim persistent tab at the bottom of the grid (above the app tab bar): `▴ Week summary` + an **AI pill** showing the pending count (e.g. `3 AI`), visible only when `> 0`.
- **Open:** slides up over the grid (~75% height) with a grab handle and a dimmed backdrop. Closes on swipe-down, backdrop tap, or handle tap. Safe-area aware at the bottom. Respects `prefers-reduced-motion`.
- **Contents** (priority order):
  1. **AI Suggestions** — accept-all / reject-all (top; it's the action)
  2. **THIS WEEK** — planned vs goal + progress bar
  3. **BY SUBJECT** + **SRS DUE**
  4. **Jump to week** (MiniMonth) — selecting a week navigates *and* closes the sheet
- Content is the **existing `ScheduleSidebar` and `MiniMonth` components rendered inside the sheet** — no logic duplicated.

### 5.3 Components & wiring
- **New:** `src/lib/components/BottomSheet.svelte` — reusable sheet. Props: `open: boolean`; default slot for content; emits `close`. Grab handle, dimmed backdrop, swipe-down/tap-to-close, `env(safe-area-inset-bottom)`, `prefers-reduced-motion`. Built generic so the WS2 popover→bottom-sheet pattern can reuse it.
- **`schedule/+page.svelte`:**
  - Reactive `isMobile` from `matchMedia('(max-width: 768px)')` — **same breakpoint as the existing `.left-panel` / `.schedule-sidebar` hide rules**, so JS and CSS agree at the boundary. SSR-safe (default desktop; set on mount; listen for changes).
  - Desktop (`!isMobile`): existing 3-column layout, unchanged.
  - Mobile (`isMobile`): render the trigger tab (AI pill from `$scheduleSlots.filter(s => s.isAiSuggested).length`) + `<BottomSheet bind:open>` wrapping `<MiniMonth …>` and `<ScheduleSidebar …>` with their existing props/handlers (incl. `acceptAll` / `rejectAll`, `weekSelect`).
  - On `weekSelect` from the sheet's MiniMonth: update `viewedWeekStart` and close the sheet.
- **`(app)/+layout.svelte`:** add a route-conditional `full-bleed` class to `.main-content` for `/schedule` (removes the `20px` padding and `overflow-y:auto` on that route only). **No WeekGrid change** — it already pins its header rows and scrolls its body.
- **`ExamBanner.svelte`:** a compact one-line variant under 768px.
- The existing `display:none` mobile rules for `.left-panel` / `.schedule-sidebar` remain (those desktop placements stay hidden on phone); their content now reappears inside the sheet.

### 5.4 Data flow
No new data. The AI pending count derives from the existing `scheduleSlots` store. `ScheduleSidebar` / `MiniMonth` keep their current props and events; the sheet just relocates where they render on mobile.

## 6. Testing
- **Unit:** a small pure helper `pendingAiCount(slots)` (or equivalent) with a test (counts `isAiSuggested`), so the pill count has a tested source.
- **Browser / mobile emulation** (same approach as WS2.1a — iPhone viewport, touch): page fills viewport with no page-scroll; header + day row pinned while the time body scrolls; trigger tab + AI pill render; sheet opens with all four sections; accept-all / reject-all work; MiniMonth week-pick navigates and closes the sheet; desktop layout unchanged at ≥768px.

## 7. File summary
| File | Change |
|---|---|
| `src/lib/components/BottomSheet.svelte` | **new** — reusable bottom sheet |
| `src/routes/(app)/schedule/+page.svelte` | mobile branch (trigger + sheet), `isMobile`, scroll-containment CSS |
| `src/routes/(app)/+layout.svelte` | full-bleed `.main-content` on the `/schedule` route (no padding / page-scroll) |
| `src/lib/components/calendar/ExamBanner.svelte` | compact one-line mobile variant |
| (a small `pendingAiCount` helper + test) | tested source for the pill |

## 8. Next step
Invoke `superpowers:writing-plans` to turn this into an implementation plan.
