# Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four visual/UX bugs: sidebar layout gap, missing delete confirmations, schedule page scrolling past the calendar, and dark mode contrast issues.

**Architecture:** All changes are isolated to CSS or single-file logic tweaks. No new types, stores, or DB calls.

**Tech Stack:** SvelteKit 2, plain CSS tokens, TypeScript

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/routes/(app)/+layout.svelte` | Modify | Fix double sidebar-width padding |
| `src/routes/(app)/subjects/templates/+page.svelte` | Modify | Add confirm before delete |
| `src/routes/(app)/subjects/+page.svelte` | Modify | Add confirm before subject/topic delete |
| `src/routes/(app)/tasks/+page.svelte` | Modify | Add confirm before task delete |
| `src/routes/(app)/scores/+page.svelte` | Modify | Verify confirm exists (already present — just check) |
| `src/lib/components/calendar/WeekGrid.svelte` | Modify | Constrain grid height, internal scroll |
| `src/routes/(app)/schedule/+page.svelte` | Modify | Remove any overflow that lets page scroll |
| `src/app.css` | Modify | Fix dark mode icon/text contrast |

---

### Task 1: Fix sidebar layout gap

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

The sidebar is `position: fixed` — it does not participate in flex layout. The `.sidebar-slot` placeholder div already pushes `.main-content` to the right. But `.main-content` also has `padding-left: calc(var(--sidebar-width) + 28px)` which adds another `--sidebar-width` of space, causing a visible gap.

- [ ] **Step 1: Open the file and locate the desktop media query**

Read `src/routes/(app)/+layout.svelte`. Find:
```css
@media (min-width: 768px) {
  .sidebar-slot { display: block; width: var(--sidebar-width); flex-shrink: 0; }
  .tabbar-slot  { display: none; }
  .main-content { padding: 28px 28px 28px calc(var(--sidebar-width) + 28px); }
}
```

- [ ] **Step 2: Fix the padding**

Change the `.main-content` rule inside the media query to:
```css
.main-content { padding: 28px; }
```

- [ ] **Step 3: Verify visually**

Run `npm run dev`. Navigate to any page on desktop (≥768px). The sidebar should sit flush against the main content with no gap.

- [ ] **Step 4: Commit**

```powershell
git add "src/routes/(app)/+layout.svelte"
git commit -m "fix: remove double sidebar-width offset in main content padding"
```

---

### Task 2: Add delete confirmations

**Files:**
- Modify: `src/routes/(app)/subjects/templates/+page.svelte`
- Modify: `src/routes/(app)/subjects/+page.svelte`
- Modify: `src/routes/(app)/tasks/+page.svelte`

Pattern to apply everywhere: guard every destructive action with `window.confirm`. If user cancels, return early.

- [ ] **Step 1: Fix templates delete**

In `src/routes/(app)/subjects/templates/+page.svelte`, find the `deleteTemplate` function:
```ts
async function deleteTemplate(template: Template) {
  const { mode } = getAuthContext();
  templates.update(all => all.filter(t => t.id !== template.id));
  await db.deleteTemplate(template.id, mode);
}
```

Replace with:
```ts
async function deleteTemplate(template: Template) {
  if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
  const { mode } = getAuthContext();
  templates.update(all => all.filter(t => t.id !== template.id));
  await db.deleteTemplate(template.id, mode);
}
```

- [ ] **Step 2: Fix subjects delete**

In `src/routes/(app)/subjects/+page.svelte`, find the delete subject handler (look for `db.deleteSubject` or `subjects.update`). Add the same guard:
```ts
if (!confirm(`Delete "${subject.name}" and all its topics and cards? This cannot be undone.`)) return;
```

- [ ] **Step 3: Fix topics delete**

In the same file or `src/routes/(app)/subjects/[id]/+page.svelte`, find the delete topic handler. Add:
```ts
if (!confirm(`Delete topic "${topic.name}"? Its SRS cards will also be deleted.`)) return;
```

- [ ] **Step 4: Fix tasks delete**

In `src/routes/(app)/tasks/+page.svelte`, find the delete task handler. Add:
```ts
if (!confirm(`Delete "${task.title}"?`)) return;
```

- [ ] **Step 5: Verify scores already has confirm**

In `src/routes/(app)/scores/+page.svelte`, find the delete handler and confirm `window.confirm` is already called. No change needed if it is.

- [ ] **Step 6: Commit**

```powershell
git add "src/routes/(app)/subjects/templates/+page.svelte" "src/routes/(app)/subjects/+page.svelte" "src/routes/(app)/subjects/[id]/+page.svelte" "src/routes/(app)/tasks/+page.svelte"
git commit -m "fix: add delete confirmations to templates, subjects, topics, and tasks"
```

---

### Task 3: Fix schedule page — calendar internal scroll

**Files:**
- Modify: `src/lib/components/calendar/WeekGrid.svelte`
- Modify: `src/routes/(app)/schedule/+page.svelte`

The time-grid should scroll internally (the hours column), not cause the outer page to scroll.

- [ ] **Step 1: Read the current WeekGrid structure**

Open `src/lib/components/calendar/WeekGrid.svelte`. Find the outermost container and the time-grid/hours container. Note the current height and overflow settings.

- [ ] **Step 2: Constrain the grid container**

The hours grid (the scrollable time area) needs a fixed height with `overflow-y: auto`. Find the `.time-grid` or equivalent container and ensure it has:
```css
.time-grid {
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* required in flex children for overflow to work */
}
```

- [ ] **Step 3: Ensure the schedule page doesn't overflow**

In `src/routes/(app)/schedule/+page.svelte`, the `.schedule-wrap` already has `overflow: hidden`. Confirm `.main-area` also has `overflow: hidden` and `min-height: 0`. The layout should be:
```css
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Go to `/schedule`. The page itself should not scroll — only the time grid inside the calendar should scroll when you scroll on it.

- [ ] **Step 5: Commit**

```powershell
git add "src/lib/components/calendar/WeekGrid.svelte" "src/routes/(app)/schedule/+page.svelte"
git commit -m "fix: constrain schedule calendar to internal scroll, prevent page scroll"
```

---

### Task 4: Fix dark mode contrast

**Files:**
- Modify: `src/app.css`

Icons using `--muted` in dark themes blend into the background. Also some text is hard to read.

- [ ] **Step 1: Identify the dark theme CSS blocks**

Open `src/app.css`. Find the theme blocks for `vercel-dark`, `apple-dark`, and `resend`. Look at the `--muted` value in each:
- `vercel-dark`: look for something like `--muted: #525252` or similar
- `apple-dark`: similar
- `resend`: always dark

- [ ] **Step 2: Increase --muted contrast in dark themes**

For each dark theme block, increase `--muted` lightness so it's clearly readable against the background. Target: muted text should be at least 4.5:1 contrast against `--bg`. Example adjustments (exact values depend on what's there — read the file first):

```css
/* vercel-dark — increase from current to at minimum: */
--muted: #a1a1aa; /* was e.g. #71717a — too dark */

/* apple-dark */
--muted: #ababab;

/* resend */
--muted: #888888;
```

The goal is sidebar nav labels, card subtitles, and icon strokes are clearly visible in dark mode.

- [ ] **Step 3: Check icon active state**

In `src/lib/components/Sidebar.svelte`, active nav items use `.nav-item.active { color: var(--primary); }`. In `vercel-dark`, `--primary` is `#ededed` (near white) on a dark background — this should be fine. But check that inactive icons (`color: var(--muted)`) are visible too.

- [ ] **Step 4: Verify across themes**

Run `npm run dev`. Switch to each dark theme in Settings. Check:
- Sidebar nav labels and icons visible
- Card subtitle text readable
- SRS health / stat card secondary text readable

- [ ] **Step 5: Commit**

```powershell
git add src/app.css
git commit -m "fix: improve muted text contrast in dark mode themes"
```

---

### Task 5: Type-check and final verification

- [ ] **Step 1: Run type check**

```powershell
npm run check
```

Expected: 0 errors (warnings about a11y in pre-existing files are OK).

- [ ] **Step 2: Push**

```powershell
git push origin master
```
