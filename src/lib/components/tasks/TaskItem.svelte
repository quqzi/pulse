<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Task, Subject, Priority } from '$lib/types';

  export let task: Task;
  export let subjects: Subject[];

  const dispatch = createEventDispatcher<{
    complete: void;
    delete: void;
    save: Task;
  }>();

  let editing = false;
  let editTitle = '';
  let editDueDate = '';
  let editPriority: Priority = 'medium';
  let editSubjectId: string | undefined = undefined;

  function priorityColor(p: Priority): string {
    return p === 'high' ? 'var(--priority-high)' : p === 'medium' ? 'var(--priority-med)' : 'var(--priority-low)';
  }

  function isOverdue(): boolean {
    if (!task.dueDate || task.completedAt) return false;
    return task.dueDate < new Date().toISOString().split('T')[0];
  }

  function formatDate(d: string): string {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function startEdit() {
    editing = true;
    editTitle = task.title;
    editDueDate = task.dueDate ?? '';
    editPriority = task.priority;
    editSubjectId = task.subjectId;
  }

  function saveEdit() {
    if (!editTitle.trim()) { editing = false; return; }
    dispatch('save', {
      ...task,
      title: editTitle.trim(),
      dueDate: editDueDate || undefined,
      priority: editPriority,
      subjectId: editSubjectId,
    });
    editing = false;
  }

  $: overdue = isOverdue();
  $: subj = task.subjectId ? subjects.find(s => s.id === task.subjectId) : null;
</script>

<li class="task-item" class:done={!!task.completedAt} class:overdue>
  {#if editing}
    <div class="task-edit-form">
      <input
        class="edit-input"
        bind:value={editTitle}
        placeholder="Task title"
        on:keydown={e => e.key === 'Escape' && (editing = false)}
      />
      <div class="edit-row">
        <input type="date" class="edit-input" bind:value={editDueDate} />
        <select class="edit-input" bind:value={editPriority}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select class="edit-input" bind:value={editSubjectId}>
          <option value={undefined}>No subject</option>
          {#each subjects as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
      <div class="edit-actions">
        <button class="btn-save" on:click={saveEdit}>Save</button>
        <button class="btn-cancel-edit" on:click={() => editing = false}>Cancel</button>
      </div>
    </div>
  {:else}
    <button class="check-btn" on:click={() => dispatch('complete')} aria-label={task.completedAt ? 'Mark incomplete' : 'Mark complete'}>
      {#if task.completedAt}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--primary)" stroke="var(--primary)" stroke-width="1.5"/>
          <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
          <span class="due-label" class:overdue-label={overdue}>
            {formatDate(task.dueDate)}
          </span>
        {/if}
        {#if subj}
          <span class="subject-chip" style="background:{subj.color}22;color:{subj.color}">{subj.symbol}</span>
        {/if}
      </div>
    </div>

    <button class="icon-btn" on:click={startEdit} aria-label="Edit task">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>

    <button class="delete-btn" on:click={() => dispatch('delete')} aria-label="Delete task">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  {/if}
</li>

<style>
  .task-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 12px; border-radius: var(--radius-md);
    background: var(--bg2); border: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .task-item:hover { background: var(--bg3); }
  .task-item.done .task-title { text-decoration: line-through; color: var(--muted); }
  .task-item.overdue { border-color: rgba(239,68,68,0.2); }

  .check-btn { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; line-height: 0; }
  .task-body { flex: 1; min-width: 0; }
  .task-title { font-size: 14px; font-weight: 500; color: var(--text); display: block; }
  .task-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .priority-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .due-label { font-size: 11px; color: var(--muted); }
  .due-label.overdue-label { color: var(--danger); font-weight: 600; }
  .subject-chip {
    font-size: 10px; font-weight: 700; padding: 1px 6px;
    border-radius: 999px; flex-shrink: 0;
  }
  .icon-btn {
    background: none; border: none; color: var(--muted); cursor: pointer;
    padding: 4px; border-radius: 6px; line-height: 0; flex-shrink: 0;
    opacity: 0; transition: opacity 120ms ease;
  }
  .task-item:hover .icon-btn { opacity: 1; }
  .icon-btn:hover { color: var(--text); background: var(--bg3); }
  .delete-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--muted); opacity: 0; transition: opacity 120ms ease; flex-shrink: 0;
  }
  .task-item:hover .delete-btn { opacity: 1; }

  .task-edit-form { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; width: 100%; }
  .edit-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .edit-input {
    flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 10px; font-size: 13px; color: var(--text); font-family: inherit;
  }
  .edit-input:focus { border-color: var(--primary); outline: none; }
  .edit-actions { display: flex; gap: 8px; }
  .btn-save {
    padding: 6px 14px; border-radius: 6px; border: none;
    background: var(--primary); color: var(--bg); font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .btn-cancel-edit {
    padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text); font-size: 13px;
    font-weight: 500; cursor: pointer; font-family: inherit;
  }
</style>
