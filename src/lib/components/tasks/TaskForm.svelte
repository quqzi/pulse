<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import type { Subject, Priority } from '$lib/types';
  import Picker from '$lib/components/Picker.svelte';

  export let subjects: Subject[] = [];

  const dispatch = createEventDispatcher<{
    add: { title: string; priority: Priority; dueDate: string; subjectId: string; repeat: '' | 'daily' | 'weekly' };
    cancel: void;
  }>();

  let titleInput = '';
  let priorityInput: Priority = 'medium';
  let dueDateInput = '';
  let subjectIdInput = '';
  let repeatInput: '' | 'daily' | 'weekly' = '';
  let titleError = false;

  function priorityColor(p: Priority): string {
    return p === 'high' ? 'var(--priority-high)' : p === 'medium' ? 'var(--priority-med)' : 'var(--priority-low)';
  }

  function handleSubmit() {
    if (!titleInput.trim()) {
      titleError = true;
      setTimeout(() => titleError = false, 600);
      return;
    }
    dispatch('add', { title: titleInput.trim(), priority: priorityInput, dueDate: dueDateInput, subjectId: subjectIdInput, repeat: repeatInput });
    titleInput = ''; priorityInput = 'medium'; dueDateInput = ''; subjectIdInput = ''; repeatInput = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') dispatch('cancel');
  }
</script>

<div class="add-form card">
  <!-- svelte-ignore a11y_autofocus — form appears on explicit user action -->
  <input
    class="title-input"
    class:error={titleError}
    bind:value={titleInput}
    placeholder={$t.tasks.addPlaceholder}
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
    <Picker
      bind:value={subjectIdInput}
      options={subjects.map(s => ({ value: s.id, label: s.name, color: s.color }))}
      placeholder={$t.tasks.noSubject}
    />
    <Picker
      value={repeatInput}
      options={[
        { value: 'daily', label: $t.tasks.repeatDaily },
        { value: 'weekly', label: $t.tasks.repeatWeekly },
      ]}
      placeholder={$t.tasks.repeatNone}
      on:change={(e) => (repeatInput = e.detail.value as '' | 'daily' | 'weekly')}
    />
  </div>
  <div class="form-actions">
    <button class="btn-cancel" on:click={() => dispatch('cancel')}>{$t.common.cancel}</button>
    <button class="btn-add" on:click={handleSubmit}>{$t.tasks.addTask}</button>
  </div>
</div>

<style>
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
  .form-row > :global(.picker-trigger) { width: auto; font-size: 12px; padding: 5px 10px; }
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
  .title-input.error { color: var(--danger); }
  .title-input.error::placeholder { color: var(--danger); }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .title-input.error { animation: shake 200ms ease; }
</style>
