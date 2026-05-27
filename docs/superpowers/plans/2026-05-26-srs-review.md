# SRS Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/review` page that walks the user through all due SRS cards one at a time, lets them self-rate recall (Again/Hard/Good/Easy), persists the SM-2 result, and shows a summary screen when done.

**Architecture:** A single new route `src/routes/(app)/review/+page.svelte` manages all review state (queue, current index, revealed state, summary). The dashboard gets a "Start Review" button wired to `goto('/review')`. No new stores or components are needed — the page reads from existing `dueCards`/`srsCards`/`subjects`/`topics` stores and calls `db.updateSrsCard()` directly. A module-level `RATINGS` constant makes the four rating options trivially configurable.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase JS v2, plain CSS tokens

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/routes/(app)/review/+page.svelte` | Full review flow: card display, rating, summary |
| Modify | `src/routes/(app)/dashboard/+page.svelte` | Add "Start Review" CTA button near due cards |

The layout (`+layout.svelte`) and sidebar do **not** need a nav link — `/review` is a utility flow entered from the dashboard.

---

### Task 1: Add "Start Review" button to the dashboard

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`

The button sits above `<TodaysPlan>`. It is only rendered when `$dueCards.length > 0`. It uses `goto('/review')` to navigate.

- [ ] **Step 1: Add the import for `goto` (already imported — confirm)**

Open `src/routes/(app)/dashboard/+page.svelte`. Line 3 already has:
```ts
import { goto } from '$app/navigation';
```
No change needed.

- [ ] **Step 2: Add the "Start Review" button block between `</div>` (subjects section) and `<TodaysPlan ...>`**

Find this section in the template (around line 100):
```svelte
  <TodaysPlan
    subjects={$subjects}
    topics={$topics}
    dueCards={$dueCards}
    on:start={handleStart}
  />
```

Replace it with:
```svelte
  {#if $dueCards.length > 0}
    <section class="review-section">
      <button class="review-cta" on:click={() => goto('/review')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Review {$dueCards.length} due card{$dueCards.length === 1 ? '' : 's'}
      </button>
    </section>
  {/if}

  <TodaysPlan
    subjects={$subjects}
    topics={$topics}
    dueCards={$dueCards}
    on:start={handleStart}
  />
```

- [ ] **Step 3: Add CSS for `.review-section` and `.review-cta` at the bottom of the `<style>` block in `dashboard/+page.svelte`**

Inside the `<style>` tag, after `.bottom-spacer { height: 32px; }`, add:
```css
  .review-section { margin-top: 20px; }
  .review-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .review-cta:active { transform: scale(0.97); transition: transform 80ms ease-in; }
```

- [ ] **Step 4: Manually verify in the browser**

Run the dev server (`npm run dev`) and go to `http://localhost:5173/dashboard`.

What to check:
- If you have ≥1 due SRS card: the "Review X due cards" button appears above Today's Plan, styled with primary color border and tinted background.
- If you have 0 due cards: the button is hidden entirely.
- Singular form: "Review 1 due card" (no trailing "s").
- Clicking the button navigates to `/review` (page will 404 until Task 2 is complete — that's expected).

- [ ] **Step 5: Commit**

```bash
git add src/routes/(app)/dashboard/+page.svelte
git commit -m "feat: add Start Review CTA button to dashboard"
```

---

### Task 2: Create the review page — skeleton, data loading, queue

**Files:**
- Create: `src/routes/(app)/review/+page.svelte`

This task builds the page shell, wires stores, and computes the ordered queue. No card UI yet.

- [ ] **Step 1: Create the file with script + empty template**

Create `src/routes/(app)/review/+page.svelte` with this content:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { srsCards, topics, subjects, dueCards, loadData, getAuthContext } from '$lib/stores/data';
  import { reviewCard } from '$lib/srs';
  import { db } from '$lib/db';
  import type { SrsCard, Topic, Subject } from '$lib/types';

  // Future extension point: ?filter=subject:ID can scope the review to one subject.
  // To implement, read `new URL(location.href).searchParams.get('filter')` here and
  // filter `queue` accordingly before the review starts.

  interface RatingOption {
    rating: 1 | 2 | 3 | 4;
    label: string;
    color: string;
  }

  const RATINGS: RatingOption[] = [
    { rating: 1, label: 'Again', color: '#ef4444' },
    { rating: 2, label: 'Hard',  color: '#f97316' },
    { rating: 3, label: 'Good',  color: '#22c55e' },
    { rating: 4, label: 'Easy',  color: '#3b82f6' },
  ];

  interface QueueItem {
    card: SrsCard;
    topic: Topic;
    subject: Subject;
  }

  let queue: QueueItem[] = [];
  let currentIndex = 0;
  let revealed = false;
  let done = false;

  // Summary: tally of ratings given (index 0 unused; indices 1–4 map to ratings)
  let ratingCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  $: current = queue[currentIndex] ?? null;
  $: progress = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 0;

  function buildQueue(
    cards: SrsCard[],
    topicList: Topic[],
    subjectList: Subject[]
  ): QueueItem[] {
    return cards.reduce<QueueItem[]>((acc, card) => {
      const topic = topicList.find(t => t.id === card.topicId);
      if (!topic) return acc;
      const subject = subjectList.find(s => s.id === topic.subjectId);
      if (!subject) return acc;
      acc.push({ card, topic, subject });
      return acc;
    }, []);
  }

  onMount(async () => {
    await loadData($auth);
    queue = buildQueue($dueCards, $topics, $subjects);
    if (queue.length === 0) {
      goto('/dashboard');
    }
  });
</script>

<div class="page">
  <!-- card UI goes here in Task 3 -->
  <p style="color:var(--muted)">Loading… ({queue.length} cards)</p>
</div>

<style>
  .page { padding: 20px 16px 0; max-width: 520px; margin: 0 auto; }
</style>
```

- [ ] **Step 2: Manually verify in the browser**

Navigate to `http://localhost:5173/review` directly.

What to check:
- If you have due cards: page renders "Loading… (N cards)" without crashing. Check browser console for TypeScript errors.
- If you have 0 due cards: browser immediately redirects to `/dashboard`.
- Page is within the app shell (sidebar visible on desktop, tab bar visible on mobile) — this works automatically because the file is under `(app)/`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: add /review page skeleton with queue builder"
```

---

### Task 3: Implement the card front face and reveal mechanic

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

Replace the placeholder `<div class="page">` template with the full card UI (front face + reveal button). The back face (rating buttons) comes in Task 4.

- [ ] **Step 1: Helper — overdue label**

Add this function inside the `<script>` block, after the `buildQueue` function:

```ts
  function dueLabel(dueDate: string): string {
    const today = new Date().toISOString().split('T')[0];
    if (dueDate === today) return 'Due today';
    const diff = Math.round(
      (new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000
    );
    return diff === 1 ? '1 day overdue' : `${diff} days overdue`;
  }
```

- [ ] **Step 2: Helper — interval preview string**

Add this function right after `dueLabel`:

```ts
  function intervalPreview(card: SrsCard, rating: 1 | 2 | 3 | 4): string {
    const result = reviewCard(card.ease, card.intervalDays, rating);
    if (result.intervalDays === 1) return 'tomorrow';
    return `${result.intervalDays} days`;
  }
```

- [ ] **Step 3: Replace the template `<div class="page">` block with the card front + progress bar**

Replace:
```svelte
<div class="page">
  <!-- card UI goes here in Task 3 -->
  <p style="color:var(--muted)">Loading… ({queue.length} cards)</p>
</div>
```

With:
```svelte
<div class="page">
  {#if done}
    <!-- summary screen — Task 5 -->
    <p style="color:var(--muted)">Done!</p>
  {:else if current}
    <div class="progress-row">
      <span class="progress-label">{currentIndex + 1} / {queue.length}</span>
      <div class="progress-track">
        <div class="progress-fill" style="transform: scaleX({progress / 100});"></div>
      </div>
    </div>

    <div class="card review-card">
      <div class="card-subject" style="color: {current.subject.color};">
        <span class="subject-dot" style="background: {current.subject.color};"></span>
        {current.subject.name}
      </div>

      <div class="card-topic">{current.topic.name}</div>

      <div class="card-meta">
        <span class="due-badge">{dueLabel(current.card.dueDate)}</span>
        <span class="interval-info">Current interval: {current.card.intervalDays}d</span>
      </div>

      {#if !revealed}
        <button
          class="reveal-btn"
          on:click={() => (revealed = true)}
        >
          Show ratings
        </button>
      {:else}
        <!-- rating buttons — Task 4 -->
        <div class="ratings-placeholder" style="height:60px;"></div>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Add CSS for all card-front elements at the bottom of the `<style>` block**

Replace the existing `<style>` block with:
```svelte
<style>
  .page { padding: 20px 16px 0; max-width: 520px; margin: 0 auto; }

  /* Progress */
  .progress-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .progress-label { font-size: 12px; color: var(--muted); flex-shrink: 0; min-width: 48px; }
  .progress-track {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 2px;
    transform-origin: left center;
    transition: transform 300ms ease;
  }

  /* Card */
  .review-card {
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 260px;
  }
  .card-subject {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .subject-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .card-topic {
    font-size: 26px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .due-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    padding: 3px 9px;
    border-radius: 20px;
  }
  .interval-info { font-size: 12px; color: var(--muted); }

  /* Reveal button */
  .reveal-btn {
    margin-top: auto;
    padding: 13px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
    text-align: center;
  }
  .reveal-btn:active { transform: scale(0.97); transition: transform 80ms ease-in; }
</style>
```

- [ ] **Step 5: Manually verify in the browser**

Navigate to `http://localhost:5173/review`.

What to check:
- Progress bar shows "1 / N" on the left and a thin filled bar.
- Card shows subject name (colored), topic name (large), "Due today" or "X days overdue" badge, and current interval.
- "Show ratings" button is visible. Clicking it makes the placeholder area appear (ratings will be wired in Task 4).
- Pressing Space does nothing yet (keyboard is Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: review page card front face with progress bar and reveal"
```

---

### Task 4: Implement rating buttons and card advancement

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

When revealed, show four rating buttons with next-interval previews. Clicking a button calls `reviewCard()`, updates the store and db, and advances to the next card (or sets `done = true`).

- [ ] **Step 1: Add the `rate` function inside the `<script>` block, after `intervalPreview`**

```ts
  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!current) return;
    const result = reviewCard(current.card.ease, current.card.intervalDays, rating);
    const updated: SrsCard = {
      ...current.card,
      ease: result.ease,
      intervalDays: result.intervalDays,
      dueDate: result.dueDate,
      reps: current.card.reps + 1,
    };

    // Update the store immediately so dueCards derived store recalculates
    srsCards.update(all => all.map(c => c.id === updated.id ? updated : c));

    // Persist
    const { userId, mode } = getAuthContext();
    await db.updateSrsCard(updated, mode);

    ratingCounts[rating] += 1;
    currentIndex += 1;
    revealed = false;

    if (currentIndex >= queue.length) {
      done = true;
    }
  }
```

- [ ] **Step 2: Replace the `ratings-placeholder` div with real rating buttons**

Find:
```svelte
        <!-- rating buttons — Task 4 -->
        <div class="ratings-placeholder" style="height:60px;"></div>
```

Replace with:
```svelte
        <div class="ratings-row">
          {#each RATINGS as r}
            <button
              class="rating-btn"
              style="--rating-color: {r.color};"
              on:click={() => rate(r.rating)}
            >
              <span class="rating-label">{r.label}</span>
              <span class="rating-preview">{intervalPreview(current.card, r.rating)}</span>
            </button>
          {/each}
        </div>
```

- [ ] **Step 3: Add CSS for the ratings row and buttons inside the `<style>` block**

Add after `.reveal-btn:active { ... }` and before `</style>`:
```css
  /* Rating buttons */
  .ratings-row {
    margin-top: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 400px) {
    .ratings-row { grid-template-columns: repeat(2, 1fr); }
  }
  .rating-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--rating-color);
    background: color-mix(in srgb, var(--rating-color) 8%, transparent);
    color: var(--rating-color);
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .rating-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .rating-label { font-size: 13px; font-weight: 700; }
  .rating-preview { font-size: 11px; font-weight: 500; opacity: 0.8; }
```

- [ ] **Step 4: Manually verify in the browser**

Navigate to `http://localhost:5173/review`.

What to check:
- After clicking "Show ratings", four buttons appear: Again (red), Hard (orange), Good (green), Easy (blue).
- Each button shows its label and the next interval (e.g., "Again / tomorrow", "Good / 5 days"). The previews are calculated live from the card's current ease/interval.
- Clicking a button advances to the next card, resets revealed to false, and the progress bar grows.
- After the last card, "Done!" text is shown (will be replaced by real summary in Task 5).
- Open browser DevTools → Application → LocalStorage (or Supabase table) and confirm the card's `dueDate`, `ease`, `intervalDays`, and `reps` changed after rating.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: rating buttons with interval preview and card advancement"
```

---

### Task 5: Implement the summary screen

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

When `done === true`, show a summary: total reviewed, breakdown per rating, and a "Back to Dashboard" button.

- [ ] **Step 1: Replace the `done` branch placeholder with the real summary template**

Find:
```svelte
  {#if done}
    <!-- summary screen — Task 5 -->
    <p style="color:var(--muted)">Done!</p>
```

Replace with:
```svelte
  {#if done}
    <div class="summary">
      <div class="summary-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>

      <h1 class="summary-title">Review complete</h1>
      <p class="summary-count">{queue.length} card{queue.length === 1 ? '' : 's'} reviewed</p>

      <div class="summary-breakdown">
        {#each RATINGS as r}
          {#if ratingCounts[r.rating] > 0}
            <div class="breakdown-row">
              <span class="breakdown-label" style="color: {r.color};">{r.label}</span>
              <span class="breakdown-bar-wrap">
                <span
                  class="breakdown-bar"
                  style="
                    background: {r.color};
                    transform: scaleX({ratingCounts[r.rating] / queue.length});
                  "
                ></span>
              </span>
              <span class="breakdown-count">{ratingCounts[r.rating]}</span>
            </div>
          {/if}
        {/each}
      </div>

      <button class="back-btn" on:click={() => goto('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
```

- [ ] **Step 2: Add CSS for the summary screen inside the `<style>` block**

Add after `.rating-preview { ... }` and before `</style>`:
```css
  /* Summary */
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding-top: 40px;
    text-align: center;
  }
  .summary-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .summary-title { font-size: 24px; font-weight: 700; color: var(--text); margin: 0; }
  .summary-count { font-size: 15px; color: var(--muted); margin: 0; }
  .summary-breakdown {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }
  .breakdown-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .breakdown-label {
    font-size: 13px;
    font-weight: 600;
    width: 40px;
    text-align: left;
    flex-shrink: 0;
  }
  .breakdown-bar-wrap {
    flex: 1;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }
  .breakdown-bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    transform-origin: left center;
    transition: transform 600ms ease;
  }
  .breakdown-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    width: 20px;
    text-align: right;
    flex-shrink: 0;
  }
  .back-btn {
    margin-top: 8px;
    padding: 13px 32px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--primary);
    color: var(--bg);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .back-btn:active { transform: scale(0.97); transition: transform 80ms ease-in; }
```

- [ ] **Step 3: Manually verify in the browser**

Navigate to `http://localhost:5173/review`, complete all cards.

What to check:
- Summary screen shows a checkmark icon in a tinted circle.
- "Review complete" heading and "N cards reviewed".
- Only ratings that were used appear in the breakdown (e.g., if you only hit Good and Easy, Again and Hard rows are hidden).
- Breakdown bars are proportional — a rating used 3/5 times has a bar roughly 60% wide.
- "Back to Dashboard" navigates to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: review summary screen with rating breakdown"
```

---

### Task 6: Keyboard shortcuts (Space to reveal, 1–4 to rate)

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

Add a `keydown` handler on `window` so users can navigate purely by keyboard.

- [ ] **Step 1: Add the keyboard handler inside the `<script>` block, after the `rate` function**

```ts
  function handleKey(e: KeyboardEvent) {
    // Ignore if focus is inside an input/button already (let button Space work naturally)
    if (e.target instanceof HTMLButtonElement) return;

    if (!done && current) {
      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        revealed = true;
        return;
      }
      if (revealed) {
        const digit = Number(e.key);
        if (digit >= 1 && digit <= 4) {
          rate(digit as 1 | 2 | 3 | 4);
        }
      }
    }
  }
```

- [ ] **Step 2: Attach the handler using `svelte:window` in the template**

Add this line at the very top of the template, before `<div class="page">`:
```svelte
<svelte:window on:keydown={handleKey} />
```

- [ ] **Step 3: Manually verify in the browser**

Navigate to `http://localhost:5173/review`. Do not click the reveal button — use the keyboard.

What to check:
- Pressing **Space** reveals the rating buttons (the card flips to show ratings).
- Pressing **1** rates "Again", **2** rates "Hard", **3** rates "Good", **4** rates "Easy".
- The page advances to the next card correctly.
- Pressing Space again on the next card reveals it again.
- Pressing a digit key when the card is NOT yet revealed does nothing.
- Clicking the "Back to Dashboard" button with mouse still works normally.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: keyboard shortcuts for SRS review (Space=reveal, 1-4=rate)"
```

---

### Task 7: Polish — empty state guard and back navigation

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

Add a loading state while `onMount` completes, and a back arrow for users who land here by URL without due cards.

- [ ] **Step 1: Add a `loading` flag to the script**

Add inside `<script>`, right after the store variable declarations (`let queue`, `let currentIndex`, etc.):
```ts
  let loading = true;
```

- [ ] **Step 2: Set `loading = false` at the end of `onMount`**

Find the `onMount` block:
```ts
  onMount(async () => {
    await loadData($auth);
    queue = buildQueue($dueCards, $topics, $subjects);
    if (queue.length === 0) {
      goto('/dashboard');
    }
  });
```

Replace with:
```ts
  onMount(async () => {
    await loadData($auth);
    queue = buildQueue($dueCards, $topics, $subjects);
    if (queue.length === 0) {
      goto('/dashboard');
      return;
    }
    loading = false;
  });
```

- [ ] **Step 3: Wrap the page content in a loading guard and add a back link**

Find the opening `<div class="page">` line and replace the full template (everything from `<div class="page">` to its closing `</div>`) with:

```svelte
<div class="page">
  {#if loading}
    <p class="loading-text">Loading…</p>
  {:else if done}
    <div class="summary">
      <div class="summary-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>

      <h1 class="summary-title">Review complete</h1>
      <p class="summary-count">{queue.length} card{queue.length === 1 ? '' : 's'} reviewed</p>

      <div class="summary-breakdown">
        {#each RATINGS as r}
          {#if ratingCounts[r.rating] > 0}
            <div class="breakdown-row">
              <span class="breakdown-label" style="color: {r.color};">{r.label}</span>
              <span class="breakdown-bar-wrap">
                <span
                  class="breakdown-bar"
                  style="
                    background: {r.color};
                    transform: scaleX({ratingCounts[r.rating] / queue.length});
                  "
                ></span>
              </span>
              <span class="breakdown-count">{ratingCounts[r.rating]}</span>
            </div>
          {/if}
        {/each}
      </div>

      <button class="back-btn" on:click={() => goto('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  {:else if current}
    <div class="top-bar">
      <button class="back-arrow" on:click={() => goto('/dashboard')} aria-label="Exit review">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="progress-row">
        <span class="progress-label">{currentIndex + 1} / {queue.length}</span>
        <div class="progress-track">
          <div class="progress-fill" style="transform: scaleX({progress / 100});"></div>
        </div>
      </div>
    </div>

    <div class="card review-card">
      <div class="card-subject" style="color: {current.subject.color};">
        <span class="subject-dot" style="background: {current.subject.color};"></span>
        {current.subject.name}
      </div>

      <div class="card-topic">{current.topic.name}</div>

      <div class="card-meta">
        <span class="due-badge">{dueLabel(current.card.dueDate)}</span>
        <span class="interval-info">Current interval: {current.card.intervalDays}d</span>
      </div>

      {#if !revealed}
        <button
          class="reveal-btn"
          on:click={() => (revealed = true)}
        >
          Show ratings
        </button>
      {:else}
        <div class="ratings-row">
          {#each RATINGS as r}
            <button
              class="rating-btn"
              style="--rating-color: {r.color};"
              on:click={() => rate(r.rating)}
            >
              <span class="rating-label">{r.label}</span>
              <span class="rating-preview">{intervalPreview(current.card, r.rating)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Add CSS for `loading-text`, `top-bar`, and `back-arrow`**

Add after `.back-btn:active { ... }` and before `</style>`:
```css
  /* Misc */
  .loading-text { color: var(--muted); font-size: 14px; margin-top: 60px; text-align: center; }
  .top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-arrow {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    line-height: 0;
    flex-shrink: 0;
    border-radius: 8px;
    transition: color 140ms ease;
  }
  .back-arrow:hover { color: var(--text); }
```

- [ ] **Step 5: Remove the now-duplicated `.progress-row` block from the old template position**

In this final template version, `.progress-row` lives inside `.top-bar`, so confirm there is no extra standalone `.progress-row` block floating outside `.top-bar`. The template in Step 3 is the complete replacement, so it's already correct if you copied it verbatim.

- [ ] **Step 6: Manually verify in the browser**

Navigate to `http://localhost:5173/review`.

What to check:
- A `←` back arrow appears at top-left next to the progress indicator.
- Clicking the back arrow returns to `/dashboard`.
- "Loading…" text is briefly visible then replaced by the card (or the page redirects if no due cards).
- The full review flow still works end-to-end: Space to reveal, 1–4 to rate, summary screen, "Back to Dashboard".
- On mobile (or narrow viewport, <400px): rating buttons wrap to a 2×2 grid instead of 4 columns.

- [ ] **Step 7: Commit**

```bash
git add src/routes/(app)/review/+page.svelte
git commit -m "feat: review page polish — loading state, back arrow, mobile ratings grid"
```

---

## Final File State Reference

After all tasks are complete, `src/routes/(app)/review/+page.svelte` will have this structure (for orientation — the actual code is defined task-by-task above):

- `<script>`: imports, `RATINGS` constant, `QueueItem` interface, state variables (`queue`, `currentIndex`, `revealed`, `done`, `ratingCounts`), `buildQueue`, `dueLabel`, `intervalPreview`, `rate`, `handleKey`, `onMount`
- `<svelte:window on:keydown={handleKey} />`
- `<div class="page">`: three branches — `{#if loading}`, `{:else if done}` (summary), `{:else if current}` (card)
- `<style>`: progress bar, review card, subject/topic/meta, reveal button, rating buttons, summary, misc

And `src/routes/(app)/dashboard/+page.svelte` gains a `{#if $dueCards.length > 0}` section with the `.review-cta` button.
