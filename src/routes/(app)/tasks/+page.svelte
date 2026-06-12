<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { tasks, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { tasksRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import type { Task } from '$lib/types';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import TaskForm from '$lib/components/tasks/TaskForm.svelte';
  import TaskItem from '$lib/components/tasks/TaskItem.svelte';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';

  type Filter = 'active' | 'all' | 'done';

  let filter: Filter = 'all';
  let adding = false;

  $: filtered = $tasks.filter(tp => {
    if (filter === 'active') return !tp.completedAt;
    if (filter === 'done')   return !!tp.completedAt;
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

  $: activeCount = $tasks.filter(tp => !tp.completedAt).length;

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  async function handleAdd(e: CustomEvent<{ title: string; priority: Task['priority']; dueDate: string; subjectId: string }>) {
    const { userId } = getAuthContext();
    const task: Task = {
      id: newId(),
      userId,
      subjectId: e.detail.subjectId || undefined,
      title: e.detail.title,
      priority: e.detail.priority,
      dueDate: e.detail.dueDate || undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
    };
    await tasksRepo.save(task);
    adding = false;
  }

  async function toggleComplete(task: Task) {
    const updated: Task = {
      ...task,
      completedAt: task.completedAt ? undefined : new Date().toISOString(),
    };
    await tasksRepo.save(updated);
  }

  let taskConfirmOpen = false;
  let pendingDeleteTask: Task | null = null;

  function promptDeleteTask(task: Task) {
    pendingDeleteTask = task;
    taskConfirmOpen = true;
  }

  async function doDeleteTask() {
    if (!pendingDeleteTask) return;
    const snapshot = pendingDeleteTask;
    pendingDeleteTask = null;
    await tasksRepo.remove(snapshot.id);
    toast.success(get(t).common.deletedUndo, {
      label: get(t).common.undo,
      fn: () => tasksRepo.save(snapshot),
    });
  }

  async function saveTask(e: CustomEvent<Task>) {
    const updated = e.detail;
    await tasksRepo.save(updated);
  }
</script>

<ConfirmDialog
  bind:open={taskConfirmOpen}
  title={$t.tasks.deleteTitle}
  message={$t.tasks.deleteMessage}
  on:confirm={doDeleteTask}
/>

<div class="page-enter page">
  <div class="header-row">
    <h1 class="text-large-title">{$t.tasks.title}</h1>
    {#if activeCount > 0}
      <span class="count-badge">{activeCount}</span>
    {/if}
  </div>

  {#if adding}
    <TaskForm subjects={$subjects} on:add={handleAdd} on:cancel={() => adding = false} />
  {:else}
    <button class="add-trigger" on:click={() => { adding = true; }}>
      <span class="plus">+</span> {$t.tasks.newTask}
    </button>
  {/if}

  <div class="filter-row">
    <button class="filter-btn" class:active={filter === 'active'} on:click={() => filter = 'active'}>{$t.tasks.filterActive}</button>
    <button class="filter-btn" class:active={filter === 'all'}    on:click={() => filter = 'all'}>{$t.tasks.filterAll}</button>
    <button class="filter-btn" class:active={filter === 'done'}   on:click={() => filter = 'done'}>{$t.tasks.filterDone}</button>
  </div>

  {#if filtered.length === 0}
    <div class="empty-state">
      <p class="empty-title">
        {#if filter === 'active'}{$t.tasks.noActive}
        {:else if filter === 'done'}{$t.tasks.noDone}
        {:else}{$t.tasks.noAll}{/if}
      </p>
      <p class="empty-sub">{$t.tasks.emptyHint}</p>
    </div>
  {:else}
    <ul class="task-list">
      {#each filtered as task (task.id)}
        <TaskItem
          {task}
          subjects={$subjects}
          on:complete={() => toggleComplete(task)}
          on:delete={() => promptDeleteTask(task)}
          on:save={saveTask}
        />
      {/each}
    </ul>
  {/if}
</div>

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

  .filter-row { display: flex; gap: 4px; margin-bottom: 12px; }
  .filter-btn {
    padding: 5px 14px; border-radius: 999px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .filter-btn.active { background: var(--primary); color: var(--bg); border-color: var(--primary); }

  .task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub   { font-size: 13px; color: var(--muted); }

  :global(body) {
    --priority-high: var(--danger);
    --priority-med:  var(--warning);
    --priority-low:  #6b7280;
  }

  @media (max-width: 768px) {
    .filter-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
</style>
