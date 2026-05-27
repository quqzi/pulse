<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { tasks, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import type { Task, Priority } from '$lib/types';

  type Filter = 'active' | 'all' | 'done';

  let filter: Filter = 'all';
  let titleInput = '';
  let priorityInput: Priority = 'medium';
  let dueDateInput = '';
  let subjectIdInput = '';
  let adding = false;
  let titleError = false;

  // undo toast state
  let undoTask: Task | null = null;
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  // edit state
  let editingTaskId: string | null = null;
  let editTaskTitle = '';
  let editTaskDueDate = '';
  let editTaskPriority: Task['priority'] = 'medium';
  let editTaskSubjectId: string | undefined = undefined;

  $: filtered = $tasks.filter(t => {
    if (filter === 'active') return !t.completedAt;
    if (filter === 'done')   return !!t.completedAt;
    return true;
  }).sort((a, b) => {
    if (!a.completedAt && !b.completedAt) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
  });

  $: activeCount = $tasks.filter(t => !t.completedAt).length;

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  async function addTask() {
    if (!titleInput.trim()) { titleError = true; setTimeout(() => titleError = false, 600); return; }
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
    if (!confirm(`Delete "${task.title}"?`)) return;
    if (undoTimer) clearTimeout(undoTimer);
    tasks.update(all => all.filter(t => t.id !== task.id));
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

  function startEditTask(task: Task) {
    editingTaskId = task.id;
    editTaskTitle = task.title;
    editTaskDueDate = task.dueDate ?? '';
    editTaskPriority = task.priority;
    editTaskSubjectId = task.subjectId;
  }

  async function saveEditTask() {
    const task = $tasks.find(t => t.id === editingTaskId);
    if (!task || !editTaskTitle.trim()) { editingTaskId = null; return; }
    const { mode } = getAuthContext();
    const updated: Task = {
      ...task,
      title: editTaskTitle.trim(),
      dueDate: editTaskDueDate || undefined,
      priority: editTaskPriority,
      subjectId: editTaskSubjectId,
    };
    tasks.update(all => all.map(t => t.id === task.id ? updated : t));
    await db.saveTask(updated, mode);
    editingTaskId = null;
  }

  function cancelEditTask() {
    editingTaskId = null;
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

  {#if adding}
    <div class="add-form card">
      <input
        class="title-input"
        class:error={titleError}
        bind:value={titleInput}
        placeholder="Task title…"
        on:keydown={handleKeydown}
        on:input={() => titleError = false}
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
        <button class="btn-add" on:click={addTask}>Add task</button>
      </div>
    </div>
  {:else}
    <button class="add-trigger" on:click={() => { adding = true; }}>
      <span class="plus">+</span> New task
    </button>
  {/if}

  <div class="filter-row">
    {#each (['active','all','done'] as Filter[]) as f}
      <button
        class="filter-btn"
        class:active={filter === f}
        on:click={() => filter = f}
      >{f[0].toUpperCase() + f.slice(1)}</button>
    {/each}
  </div>

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
          {#if editingTaskId === task.id}
            <div class="task-edit-form">
              <input
                class="edit-input"
                bind:value={editTaskTitle}
                placeholder="Task title"
                on:keydown={e => e.key === 'Escape' && cancelEditTask()}
              />
              <div class="edit-row">
                <input type="date" class="edit-input" bind:value={editTaskDueDate} />
                <select class="edit-input" bind:value={editTaskPriority}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select class="edit-input" bind:value={editTaskSubjectId}>
                  <option value={undefined}>No subject</option>
                  {#each $subjects as s}
                    <option value={s.id}>{s.name}</option>
                  {/each}
                </select>
              </div>
              <div class="edit-actions">
                <button class="btn-save" on:click={saveEditTask}>Save</button>
                <button class="btn-cancel-edit" on:click={cancelEditTask}>Cancel</button>
              </div>
            </div>
          {:else}
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

            <button class="icon-btn" on:click={() => startEditTask(task)} aria-label="Edit task">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>

            <button class="delete-btn" on:click={() => deleteTask(task)} aria-label="Delete task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

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
  .title-input.error { color: #ef4444; }
  .title-input.error::placeholder { color: #ef4444; }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .title-input.error { animation: shake 200ms ease; }

  .filter-row { display: flex; gap: 4px; margin-bottom: 12px; }
  .filter-btn {
    padding: 5px 14px; border-radius: 999px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: all 120ms ease;
  }
  .filter-btn.active { background: var(--primary); color: var(--bg); border-color: var(--primary); }

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
  .icon-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    line-height: 0;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .task-item:hover .icon-btn { opacity: 1; }
  .icon-btn:hover { color: var(--text); background: var(--bg3); }
  .delete-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--muted); opacity: 0; transition: opacity 120ms ease;
    flex-shrink: 0;
  }
  .task-item:hover .delete-btn { opacity: 1; }

  .task-edit-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
    width: 100%;
  }
  .edit-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .edit-input {
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--text);
    font-family: inherit;
  }
  .edit-input:focus { border-color: var(--primary); outline: none; }
  .edit-actions {
    display: flex;
    gap: 8px;
  }
  .btn-save {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    background: var(--primary);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-cancel-edit {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .empty { text-align: center; color: var(--muted); font-size: 14px; padding: 48px 0; }

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
