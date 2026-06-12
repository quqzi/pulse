<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { tasks, subjects, dueDecks, readinessScore, examSessions, loadData, getAuthContext } from '$lib/stores/data';
  import { todayDate } from '$lib/stores/clock';
  import { timerStore } from '$lib/stores/timer';
  import { tasksRepo } from '$lib/data/entities';
  import { completeTask } from '$lib/tasks';
  import { newId } from '$lib/id';
  import type { Task } from '$lib/types';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import TaskForm from '$lib/components/tasks/TaskForm.svelte';
  import TaskItem from '$lib/components/tasks/TaskItem.svelte';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';

  let adding = false;
  let showDone = false;

  const byDue = (a: Task, b: Task) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  };

  $: active = $tasks.filter(tp => !tp.completedAt);
  $: groups = [
    { key: 'overdue', label: $t.tasks.groupOverdue, items: active.filter(tp => tp.dueDate && tp.dueDate < $todayDate).sort(byDue) },
    { key: 'today', label: $t.tasks.groupToday, items: active.filter(tp => tp.dueDate === $todayDate).sort(byDue) },
    { key: 'upcoming', label: $t.tasks.groupUpcoming, items: active.filter(tp => !tp.dueDate || tp.dueDate > $todayDate).sort(byDue) },
  ];
  $: done = $tasks.filter(tp => !!tp.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  $: activeCount = active.length;

  // One-tap suggestions derived from study data; hidden once an identical
  // active task exists, so accepting a suggestion makes it disappear.
  $: suggestions = (() => {
    const out: { key: string; title: string; subjectId?: string }[] = [];
    const activeTitles = new Set(active.map(tp => tp.title));
    if ($subjects.length > 1) {
      const weakest = [...$subjects].sort((a, b) => ($readinessScore.bySubject[a.id] ?? 0) - ($readinessScore.bySubject[b.id] ?? 0))[0];
      const title = $t.tasks.suggReviewWeakest(weakest.name);
      if (!activeTitles.has(title)) out.push({ key: 'weak', title, subjectId: weakest.id });
    }
    const deck = $dueDecks[0];
    if (deck) {
      const title = $t.tasks.suggStudyDeck(deck.name);
      if (!activeTitles.has(title)) out.push({ key: 'deck', title, subjectId: deck.subjectId });
    }
    const weekAgo = Date.now() - 7 * 864e5;
    const recentMock = $examSessions.some(s => new Date(s.createdAt).getTime() > weekAgo);
    if ($subjects.length > 0 && !recentMock) {
      const title = $t.tasks.suggMockExam;
      if (!activeTitles.has(title)) out.push({ key: 'mock', title });
    }
    return out;
  })();

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  async function handleAdd(e: CustomEvent<{ title: string; priority: Task['priority']; dueDate: string; subjectId: string; repeat: '' | 'daily' | 'weekly' }>) {
    const { userId } = getAuthContext();
    const task: Task = {
      id: newId(),
      userId,
      subjectId: e.detail.subjectId || undefined,
      title: e.detail.title,
      priority: e.detail.priority,
      dueDate: e.detail.dueDate || undefined,
      repeat: e.detail.repeat || undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
    };
    await tasksRepo.save(task);
    adding = false;
  }

  async function addSuggestion(s: { title: string; subjectId?: string }) {
    const { userId } = getAuthContext();
    await tasksRepo.save({
      id: newId(),
      userId,
      subjectId: s.subjectId,
      title: s.title,
      priority: 'medium',
      dueDate: $todayDate,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
    });
  }

  async function toggleComplete(task: Task) {
    if (task.completedAt) {
      await tasksRepo.save({ ...task, completedAt: undefined });
    } else {
      await completeTask(task);
    }
  }

  function startTask(task: Task) {
    timerStore.update(tp =>
      tp.status === 'idle'
        ? { ...tp, subjectId: task.subjectId ?? null, topicId: null, taskId: task.id }
        : tp
    );
    goto('/timer');
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
    await tasksRepo.save(e.detail);
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

  {#if suggestions.length > 0}
    <div class="suggest-row">
      <span class="suggest-label">{$t.tasks.suggestedTitle}</span>
      <div class="suggest-chips">
        {#each suggestions as s (s.key)}
          <button class="suggest-chip" on:click={() => addSuggestion(s)}>
            <span class="suggest-plus">+</span>{s.title}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if activeCount === 0 && done.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.tasks.noAll}</p>
      <p class="empty-sub">{$t.tasks.emptyHint}</p>
    </div>
  {:else}
    {#each groups as group (group.key)}
      {#if group.items.length > 0}
        <h2 class="group-title" class:overdue-title={group.key === 'overdue'}>{group.label}</h2>
        <ul class="task-list stagger-children">
          {#each group.items as task (task.id)}
            <TaskItem
              {task}
              subjects={$subjects}
              on:complete={() => toggleComplete(task)}
              on:delete={() => promptDeleteTask(task)}
              on:save={saveTask}
              on:start={() => startTask(task)}
            />
          {/each}
        </ul>
      {/if}
    {/each}

    {#if done.length > 0}
      <button class="group-toggle" on:click={() => (showDone = !showDone)} aria-expanded={showDone}>
        <span class="group-title done-title">{$t.tasks.groupDone}</span>
        <span class="done-count">{done.length}</span>
        <svg class="chev" class:flip={showDone} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {#if showDone}
        <ul class="task-list">
          {#each done as task (task.id)}
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
    {/if}
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

  .suggest-row { margin-bottom: 16px; }
  .suggest-label {
    display: block; font-size: 11px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;
  }
  .suggest-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .suggest-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 999px;
    border: 1.5px dashed color-mix(in srgb, var(--primary) 35%, transparent);
    background: color-mix(in srgb, var(--primary) 6%, transparent);
    color: var(--text); font-size: 12.5px; font-weight: 500;
    cursor: pointer; font-family: inherit; text-align: left;
  }
  .suggest-chip:hover {
    border-style: solid; border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }
  .suggest-plus { color: var(--primary); font-weight: 700; }

  .group-title {
    font-size: 11px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    margin: 16px 0 6px; padding: 0;
  }
  .overdue-title { color: var(--danger); }
  .group-toggle {
    display: flex; align-items: center; gap: 8px;
    width: 100%; margin-top: 20px; padding: 4px 0;
    background: none; border: none; cursor: pointer; font-family: inherit;
    text-align: left;
  }
  .group-toggle .group-title { margin: 0; }
  .done-count {
    font-size: 10px; font-weight: 700; color: var(--muted);
    background: var(--bg3); border-radius: 999px; padding: 1px 7px;
  }
  .chev { color: var(--muted); transition: transform 160ms ease; }
  .chev.flip { transform: rotate(180deg); }

  .task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub   { font-size: 13px; color: var(--muted); }

  :global(body) {
    --priority-high: var(--danger);
    --priority-med:  var(--warning);
    --priority-low:  #6b7280;
  }
</style>
