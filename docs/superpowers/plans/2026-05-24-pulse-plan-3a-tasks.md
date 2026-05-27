# Plan 3A — Tasks Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Tasks feature to Pulse — create/complete/delete tasks with priorities, due dates, subject linking, undo toast, filtered list view, and a dashboard due-today section.

**Architecture:** Guest mode stores tasks in `localStorage` (`pulse_tasks`); authenticated mode upserts/deletes via Supabase (`tasks` table). A new `tasks` writable + `tasksDueToday` derived store live in `data.ts` alongside existing stores. The Tasks page handles all CRUD; the Dashboard shows a compact due-today row.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase JS v2, CSS custom properties (`--primary`, `--border`, etc.)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `Priority` type + `Task` interface |
| Modify | `src/lib/db.ts` | Add `getTasks`, `saveTask`, `deleteTask` methods + mapper |
| Modify | `src/lib/stores/data.ts` | Add `tasks` writable, `tasksDueToday` derived, update `loadData` |
| Modify | `src/routes/(app)/tasks/+page.svelte` | Full tasks page (replace stub) |
| Modify | `src/routes/(app)/dashboard/+page.svelte` | Add tasks-due-today section |
| Modify | `src/lib/i18n/en.ts` | Add `tasks` i18n namespace |

---

### Task 1: Add `Task` type + DB CRUD

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Append after the last interface in the file:

```ts
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  userId: string;
  subjectId?: string;
  title: string;
  priority: Priority;
  dueDate?: string;      // YYYY-MM-DD
  completedAt?: string;  // ISO timestamp, undefined = incomplete
  createdAt: string;     // ISO timestamp
}
```

- [ ] **Step 2: Add mapper + CRUD methods to `src/lib/db.ts`**

Add the import at line 4 (after existing type imports):
```ts
import type { Subject, Topic, SrsCard, StudySession, Task } from '$lib/types';
```

Add the mapper function after `mapSessionFromDb` (before `export const db = {`):
```ts
function mapTaskFromDb(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectId: row.subject_id as string | undefined,
    title: row.title as string,
    priority: row.priority as Task['priority'],
    dueDate: row.due_date as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
  };
}
```

Add these three methods inside `export const db = { ... }` after the `logSession` method (before the `newId` export):

```ts
  // ── TASKS ─────────────────────────────────────────────────
  async getTasks(userId: string, mode: Mode): Promise<Task[]> {
    if (mode === 'guest') return lsGet<Task>('pulse_tasks');
    const { data } = await supabase.from('tasks').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(mapTaskFromDb);
  },

  async saveTask(task: Task, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<Task>('pulse_tasks');
      const idx = all.findIndex(t => t.id === task.id);
      if (idx >= 0) all[idx] = task; else all.unshift(task);
      lsSet('pulse_tasks', all);
      return;
    }
    await supabase.from('tasks').upsert({
      id: task.id,
      user_id: task.userId,
      subject_id: task.subjectId ?? null,
      title: task.title,
      priority: task.priority,
      due_date: task.dueDate ?? null,
      completed_at: task.completedAt ?? null,
      created_at: task.createdAt,
    });
  },

  async deleteTask(taskId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_tasks', lsGet<Task>('pulse_tasks').filter(t => t.id !== taskId));
      return;
    }
    await supabase.from('tasks').delete().eq('id', taskId);
  },
```

- [ ] **Step 3: Run type check**

```powershell
cd C:\Users\HP\Documents\pulse
npx tsc --noEmit
```

Expected: 0 new errors (only the pre-existing a11y warnings).

- [ ] **Step 4: Commit**

```powershell
git add src/lib/types.ts src/lib/db.ts
git commit -m "feat: add Task type and db CRUD methods"
```

---

### Task 2: Add `tasks` store + update `loadData`

**Files:**
- Modify: `src/lib/stores/data.ts`

- [ ] **Step 1: Update `src/lib/stores/data.ts`**

Replace the entire file with:

```ts
import { writable, derived } from 'svelte/store';
import { db } from '$lib/db';
import type { Subject, Topic, SrsCard, StudySession, Task } from '$lib/types';
import type { AuthState } from '$lib/stores/auth';

export const subjects = writable<Subject[]>([]);
export const topics = writable<Topic[]>([]);
export const srsCards = writable<SrsCard[]>([]);
export const sessions = writable<StudySession[]>([]);
export const tasks = writable<Task[]>([]);

export const todaysSessions = derived(sessions, ($s) => {
  const today = new Date().toISOString().split('T')[0];
  return $s.filter(s => s.startedAt.startsWith(today));
});

export const dueCards = derived(srsCards, ($cards) => {
  const today = new Date().toISOString().split('T')[0];
  return $cards.filter(c => c.dueDate <= today);
});

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived(sessions, ($s) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => s.startedAt.split('T')[0]));
  let count = 0;
  const d = new Date();
  let base = d.toISOString().split('T')[0];
  if (!days.has(base)) {
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
    if (!days.has(base)) return 0;
  }
  while (days.has(base)) {
    count++;
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
  }
  return count;
});

export const tasksDueToday = derived(tasks, ($tasks) => {
  const today = new Date().toISOString().split('T')[0];
  return $tasks.filter(t => !t.completedAt && t.dueDate && t.dueDate <= today);
});

let _mode: 'guest' | 'authenticated' = 'guest';
let _userId = 'guest';

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  _mode = authState.mode;
  _userId = authState.mode === 'guest' ? 'guest' : (authState.user?.id ?? '');

  const [s, t, c, sess, tsk] = await Promise.all([
    db.getSubjects(_userId, _mode),
    db.getTopics(_userId, _mode),
    db.getSrsCards(_userId, _mode),
    db.getSessions(_userId, _mode),
    db.getTasks(_userId, _mode),
  ]);
  subjects.set(s);
  topics.set(t);
  srsCards.set(c);
  sessions.set(sess);
  tasks.set(tsk);
}

export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return { userId: _userId, mode: _mode };
}
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/stores/data.ts
git commit -m "feat: add tasks store and tasksDueToday derived"
```

---

### Task 3: Full Tasks page

**Files:**
- Modify: `src/routes/(app)/tasks/+page.svelte`

- [ ] **Step 1: Replace stub with full implementation**

Replace the entire content of `src/routes/(app)/tasks/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { tasks, loadData, getAuthContext } from '$lib/stores/data';
  import { subjects } from '$lib/stores/data';
  import { db } from '$lib/db';
  import type { Task, Priority } from '$lib/types';

  type Filter = 'active' | 'all' | 'done';

  let filter: Filter = 'active';
  let titleInput = '';
  let priorityInput: Priority = 'medium';
  let dueDateInput = '';
  let subjectIdInput = '';
  let adding = false;

  // undo toast state
  let undoTask: Task | null = null;
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  $: filtered = $tasks.filter(t => {
    if (filter === 'active') return !t.completedAt;
    if (filter === 'done')   return !!t.completedAt;
    return true;
  }).sort((a, b) => {
    // active tasks: sort by due date asc (overdue first), then priority
    if (!a.completedAt && !b.completedAt) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // done tasks: most recently completed first
    return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
  });

  $: activeCount = $tasks.filter(t => !t.completedAt).length;

  onMount(() => loadData($auth));

  async function addTask() {
    if (!titleInput.trim()) return;
    const { userId, mode } = getAuthContext();
    const task: Task = {
      id: db.newId(),
      userId,
      subjectId: subjectIdInput || undefined,
      title: titleInput.trim(),
      priority: priorityInput,
      dueDate: dueDateInput || undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
    };
    tasks.update(all => [task, ...all]);
    await db.saveTask(task, mode);
    titleInput = '';
    dueDateInput = '';
    subjectIdInput = '';
    priorityInput = 'medium';
    adding = false;
  }

  async function toggleComplete(task: Task) {
    const { mode } = getAuthContext();
    const updated: Task = {
      ...task,
      completedAt: task.completedAt ? undefined : new Date().toISOString(),
    };
    tasks.update(all => all.map(t => t.id === task.id ? updated : t));
    await db.saveTask(updated, mode);
  }

  function deleteTask(task: Task) {
    // cancel any pending undo timer
    if (undoTimer) clearTimeout(undoTimer);

    // optimistic remove
    tasks.update(all => all.filter(t => t.id !== task.id));

    // show undo toast
    undoTask = task;
    undoTimer = setTimeout(async () => {
      undoTask = null;
      undoTimer = null;
      const { mode } = getAuthContext();
      await db.deleteTask(task.id, mode);
    }, 4000);
  }

  function undoDelete() {
    if (!undoTask) return;
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    const restored = undoTask;
    undoTask = null;
    tasks.update(all => {
      const exists = all.find(t => t.id === restored.id);
      if (exists) return all;
      return [restored, ...all];
    });
  }

  function priorityColor(p: Priority): string {
    return p === 'high' ? 'var(--priority-high)' : p === 'medium' ? 'var(--priority-med)' : 'var(--priority-low)';
  }

  function isOverdue(task: Task): boolean {
    if (!task.dueDate || task.completedAt) return false;
    return task.dueDate < new Date().toISOString().split('T')[0];
  }

  function formatDate(d: string): string {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') addTask();
    if (e.key === 'Escape') { adding = false; titleInput = ''; }
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <h1 class="text-large-title">Tasks</h1>
    {#if activeCount > 0}
      <span class="count-badge">{activeCount}</span>
    {/if}
  </div>

  <!-- Add task -->
  {#if adding}
    <div class="add-form card">
      <input
        class="title-input"
        bind:value={titleInput}
        placeholder="Task title…"
        on:keydown={handleKeydown}
        autofocus
      />
      <div class="form-row">
        <div class="priority-group">
          {#each (['high','medium','low'] as Priority[]) as p}
            <button
              class="priority-btn"
              class:active={priorityInput === p}
              style="--dot:{priorityColor(p)}"
              on:click={() => priorityInput = p}
            >{p[0].toUpperCase()}</button>
          {/each}
        </div>
        <input type="date" class="date-input" bind:value={dueDateInput} />
        <select class="subject-select" bind:value={subjectIdInput}>
          <option value="">No subject</option>
          {#each $subjects as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" on:click={() => { adding = false; titleInput = ''; }}>Cancel</button>
        <button class="btn-add" on:click={addTask} disabled={!titleInput.trim()}>Add task</button>
      </div>
    </div>
  {:else}
    <button class="add-trigger" on:click={() => { adding = true; }}>
      <span class="plus">+</span> New task
    </button>
  {/if}

  <!-- Filters -->
  <div class="filter-row">
    {#each (['active','all','done'] as Filter[]) as f}
      <button
        class="filter-btn"
        class:active={filter === f}
        on:click={() => filter = f}
      >{f[0].toUpperCase() + f.slice(1)}</button>
    {/each}
  </div>

  <!-- Task list -->
  {#if filtered.length === 0}
    <div class="empty">
      {#if filter === 'active'}No active tasks — you're all caught up!
      {:else if filter === 'done'}No completed tasks yet.
      {:else}No tasks yet. Add one above.{/if}
    </div>
  {:else}
    <ul class="task-list">
      {#each filtered as task (task.id)}
        <li class="task-item" class:done={!!task.completedAt} class:overdue={isOverdue(task)}>
          <button class="check-btn" on:click={() => toggleComplete(task)} aria-label={task.completedAt ? 'Mark incomplete' : 'Mark complete'}>
            {#if task.completedAt}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="var(--primary)" stroke="var(--primary)" stroke-width="1.5"/>
                <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="var(--border)" stroke-width="1.5"/>
              </svg>
            {/if}
          </button>

          <div class="task-body">
            <span class="task-title">{task.title}</span>
            <div class="task-meta">
              <span class="priority-dot" style="background:{priorityColor(task.priority)}"></span>
              {#if task.dueDate}
                <span class="due-label" class:overdue-label={isOverdue(task)}>
                  {formatDate(task.dueDate)}
                </span>
              {/if}
              {#if task.subjectId}
                {@const subj = $subjects.find(s => s.id === task.subjectId)}
                {#if subj}
                  <span class="subject-chip" style="background:{subj.color}22;color:{subj.color}">{subj.symbol}</span>
                {/if}
              {/if}
            </div>
          </div>

          <button class="delete-btn" on:click={() => deleteTask(task)} aria-label="Delete task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<!-- Undo toast -->
{#if undoTask}
  <div class="toast">
    <span>Task deleted</span>
    <button class="undo-btn" on:click={undoDelete}>Undo</button>
  </div>
{/if}

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .count-badge {
    background: var(--primary); color: var(--bg);
    font-size: 12px; font-weight: 700; border-radius: 999px;
    padding: 1px 8px; min-width: 22px; text-align: center;
  }

  /* add trigger */
  .add-trigger {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 12px 16px;
    border: 1.5px dashed var(--border); border-radius: var(--radius-md);
    background: none; color: var(--muted); font-size: 14px; font-weight: 500;
    cursor: pointer; margin-bottom: 16px;
    transition: border-color 120ms ease, color 120ms ease;
  }
  .add-trigger:hover { border-color: var(--primary); color: var(--text); }
  .plus { font-size: 18px; line-height: 1; }

  /* add form */
  .add-form { padding: 14px 16px; margin-bottom: 16px; }
  .title-input {
    width: 100%; border: none; background: none; outline: none;
    font-family: inherit; font-size: 15px; color: var(--text);
    margin-bottom: 10px;
  }
  .form-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .priority-group { display: flex; gap: 4px; }
  .priority-btn {
    width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid var(--border);
    background: none; font-size: 11px; font-weight: 700; color: var(--muted);
    cursor: pointer; position: relative; transition: border-color 100ms ease, color 100ms ease;
  }
  .priority-btn::before {
    content: ''; position: absolute; top: 4px; right: 4px;
    width: 5px; height: 5px; border-radius: 50%; background: var(--dot);
  }
  .priority-btn.active { border-color: var(--dot); color: var(--text); }
  .date-input {
    height: 28px; padding: 0 8px; border: 1.5px solid var(--border);
    border-radius: 6px; background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 12px; outline: none;
  }
  .date-input:focus { border-color: var(--primary); }
  .subject-select {
    height: 28px; padding: 0 8px; border: 1.5px solid var(--border);
    border-radius: 6px; background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 12px; outline: none; cursor: pointer;
  }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn-cancel {
    padding: 6px 14px; border-radius: 8px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px; cursor: pointer;
  }
  .btn-add {
    padding: 6px 16px; border-radius: 8px; border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px;
    font-weight: 600; cursor: pointer;
  }
  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }

  /* filters */
  .filter-row { display: flex; gap: 4px; margin-bottom: 12px; }
  .filter-btn {
    padding: 5px 14px; border-radius: 999px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: all 120ms ease;
  }
  .filter-btn.active { background: var(--primary); color: var(--bg); border-color: var(--primary); }

  /* task list */
  .task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .task-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 12px; border-radius: var(--radius-md);
    background: var(--bg2); border: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .task-item:hover { background: var(--bg3); }
  .task-item.done .task-title { text-decoration: line-through; color: var(--muted); }
  .task-item.overdue { border-color: #ef444433; }

  .check-btn { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; line-height: 0; }
  .task-body { flex: 1; min-width: 0; }
  .task-title { font-size: 14px; font-weight: 500; color: var(--text); display: block; }
  .task-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .priority-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .due-label { font-size: 11px; color: var(--muted); }
  .due-label.overdue-label { color: #ef4444; font-weight: 600; }
  .subject-chip {
    font-size: 10px; font-weight: 700; padding: 1px 6px;
    border-radius: 999px; flex-shrink: 0;
  }
  .delete-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--muted); opacity: 0; transition: opacity 120ms ease;
    flex-shrink: 0;
  }
  .task-item:hover .delete-btn { opacity: 1; }

  /* empty state */
  .empty { text-align: center; color: var(--muted); font-size: 14px; padding: 48px 0; }

  /* undo toast */
  .toast {
    position: fixed; bottom: calc(var(--tab-bar-height, 60px) + 12px); left: 50%;
    transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px;
    background: var(--text); color: var(--bg);
    padding: 10px 16px; border-radius: 12px;
    font-size: 14px; font-weight: 500;
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
    z-index: 200; animation: slide-up 180ms ease;
  }
  .undo-btn {
    background: none; border: none; color: inherit; font-family: inherit;
    font-size: 14px; font-weight: 700; cursor: pointer; padding: 0;
    opacity: .8;
  }
  .undo-btn:hover { opacity: 1; }

  /* priority color vars (fallbacks if not in app.css) */
  :global(:root) {
    --priority-high: #ef4444;
    --priority-med:  #f59e0b;
    --priority-low:  #6b7280;
  }

  @keyframes slide-up {
    from { transform: translateX(-50%) translateY(8px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);   opacity: 1; }
  }
</style>
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add src/routes/"(app)"/tasks/+page.svelte
git commit -m "feat: implement full Tasks page with add/complete/delete/undo"
```

---

### Task 4: Dashboard — tasks-due-today section

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`

- [ ] **Step 1: Update dashboard imports and data**

In the `<script>` block, add to the imports from `$lib/stores/data`:
```ts
import {
  subjects, topics, srsCards, sessions,
  dueCards, todayHours, streak, loadData, getAuthContext,
  tasks, tasksDueToday,
} from '$lib/stores/data';
```

Also import `goto` is already there. No new imports needed beyond adding `tasks` and `tasksDueToday`.

- [ ] **Step 2: Add the tasks-due-today section to the template**

In `src/routes/(app)/dashboard/+page.svelte`, insert the following block **after** the `<TodaysPlan ... />` block and **before** the `<QuickLog ... />` block:

```svelte
  {#if $tasksDueToday.length > 0}
    <section class="tasks-section">
      <div class="section-label">TASKS DUE</div>
      <div class="card tasks-card">
        {#each $tasksDueToday.slice(0, 5) as task (task.id)}
          <div class="task-row">
            <button class="dash-check" on:click={async () => {
              const { mode } = getAuthContext();
              const updated = { ...task, completedAt: new Date().toISOString() };
              tasks.update(all => all.map(t => t.id === task.id ? updated : t));
              await db.saveTask(updated, mode);
            }} aria-label="Complete task">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="var(--border)" stroke-width="1.5"/>
              </svg>
            </button>
            <span class="dash-task-title">{task.title}</span>
            {#if task.dueDate}
              <span class="dash-due" class:overdue={task.dueDate < new Date().toISOString().split('T')[0]}>
                {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            {/if}
          </div>
          {#if task !== $tasksDueToday.slice(0, 5).at(-1)}
            <div class="task-divider"></div>
          {/if}
        {/each}
        {#if $tasksDueToday.length > 5}
          <a href="/tasks" class="see-more">+{$tasksDueToday.length - 5} more</a>
        {/if}
      </div>
    </section>
  {/if}
```

- [ ] **Step 3: Add styles to the dashboard `<style>` block**

Append inside `<style>`:
```css
  .tasks-section { margin-top: 20px; }
  .tasks-card { padding: 4px 0; }
  .task-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .dash-check { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; line-height: 0; }
  .dash-task-title { flex: 1; font-size: 14px; font-weight: 500; color: var(--text); }
  .dash-due { font-size: 12px; color: var(--muted); flex-shrink: 0; }
  .dash-due.overdue { color: #ef4444; font-weight: 600; }
  .task-divider { height: 1px; background: var(--border); margin: 0 14px; }
  .see-more { display: block; text-align: center; padding: 8px; font-size: 13px; color: var(--primary); text-decoration: none; font-weight: 500; }
```

- [ ] **Step 4: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```powershell
git add src/routes/"(app)"/dashboard/+page.svelte
git commit -m "feat: show tasks due today on dashboard"
```

---

### Task 5: i18n keys + Supabase migration note + final check

**Files:**
- Modify: `src/lib/i18n/en.ts`

- [ ] **Step 1: Add `tasks` namespace to `src/lib/i18n/en.ts`**

Inside `export const en = { ... }`, add after the `settings` block and before `common`:

```ts
  tasks: {
    title: 'Tasks',
    newTask: 'New task',
    addPlaceholder: 'Task title…',
    filterActive: 'Active',
    filterAll: 'All',
    filterDone: 'Done',
    noActive: "No active tasks — you're all caught up!",
    noDone: 'No completed tasks yet.',
    noAll: 'No tasks yet. Add one above.',
    priorityHigh: 'High',
    priorityMedium: 'Medium',
    priorityLow: 'Low',
    noSubject: 'No subject',
    deleted: 'Task deleted',
    undo: 'Undo',
    dueToday: 'TASKS DUE',
    seeMore: (n: number) => `+${n} more`,
  },
```

- [ ] **Step 2: Note for authenticated users — Supabase migration**

For authenticated mode, you must create the `tasks` table in Supabase before deploying. Run this SQL in the Supabase SQL editor:

```sql
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject_id   uuid references subjects(id) on delete set null,
  title        text not null,
  priority     text not null default 'medium' check (priority in ('high','medium','low')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table tasks enable row level security;
create policy "users own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index tasks_user_idx on tasks(user_id);
create index tasks_due_idx  on tasks(user_id, due_date) where completed_at is null;
```

Note: Guest mode works without this table (uses localStorage). Only needed when deploying for auth users.

- [ ] **Step 3: Final type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors (only the pre-existing a11y warnings from other files).

- [ ] **Step 4: Commit**

```powershell
git add src/lib/i18n/en.ts
git commit -m "feat: add tasks i18n keys"
```

- [ ] **Step 5: Push**

```powershell
git push origin master
```

---

## Self-Review

**Spec coverage (from 4E):**
- ✅ Priorities H/M/L — `Priority` type, selector in add form, color-coded dots
- ✅ Deadlines — `dueDate` field, date input, overdue highlighting in red
- ✅ Subject tagging — `subjectId` field, dropdown in form, chip in list
- ✅ Undo toast — optimistic delete, 4s timer, undo button restores to store
- ✅ Filtering — Active / All / Done tabs
- ✅ Dashboard integration — due-today section with quick-complete

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `Task.completedAt` — used as `undefined` (not null) throughout; LS stores undefined, Supabase mapper uses `row.completed_at as string | undefined`
- `db.saveTask` / `db.deleteTask` / `db.getTasks` — named consistently in types.ts, db.ts, data.ts, and tasks page
- `tasksDueToday` — defined in data.ts, imported in dashboard correctly
