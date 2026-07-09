<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import { localDateStr } from '$lib/utils';
  import { newId } from '$lib/id';
  import Picker from '$lib/components/Picker.svelte';
  import type { Subject, MockScore } from '$lib/types';

  export let subjects: Subject[];
  export let initial: MockScore | null = null;

  const dispatch = createEventDispatcher<{
    save: MockScore;
    cancel: void;
  }>();

  function todayStr(): string {
    return localDateStr(new Date());
  }

  let subjectId = initial?.subjectId ?? (subjects[0]?.id ?? '');
  let rawScore = initial ? String(initial.score) : '';
  let rawMax = initial ? String(initial.maxScore) : '100';
  let takenAt = initial?.takenAt ?? todayStr();
  let notes = initial?.notes ?? '';

  let scoreError = false;

  function handleSave() {
    const score = parseFloat(rawScore);
    const maxScore = parseFloat(rawMax);
    if (!subjectId || isNaN(score) || isNaN(maxScore) || maxScore <= 0 || score < 0) {
      scoreError = true;
      setTimeout(() => scoreError = false, 600);
      return;
    }
    const entry: MockScore = {
      id: initial?.id ?? newId(),
      userId: initial?.userId ?? '',
      subjectId,
      score,
      maxScore,
      takenAt,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    dispatch('save', entry);
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="form card" on:keydown={handleKeydown} role="form">
  <div class="form-row">
    <span class="field-label" id="sf-subject-label">{$t.scores.subjectLabel}</span>
    <Picker
      bind:value={subjectId}
      options={subjects.map(s => ({ value: s.id, label: s.name, color: s.color }))}
      ariaLabel={$t.scores.subjectLabel}
    />
  </div>

  <div class="form-row score-row">
    <label class="field-label" for="sf-score">{$t.scores.scoreLabel}</label>
    <div class="score-inputs" class:error={scoreError}>
      <input
        id="sf-score"
        class="field-input score-num"
        type="number"
        min="0"
        bind:value={rawScore}
        placeholder="42"
      />
      <span class="slash">/</span>
      <input
        class="field-input score-num"
        type="number"
        min="1"
        bind:value={rawMax}
        placeholder="100"
      />
    </div>
  </div>

  <div class="form-row">
    <label class="field-label" for="sf-date">{$t.scores.dateLabel}</label>
    <input id="sf-date" class="field-input date-input" type="date" bind:value={takenAt} />
  </div>

  <div class="form-row">
    <label class="field-label" for="sf-notes">{$t.scores.notesLabel}</label>
    <input
      id="sf-notes"
      class="field-input notes-input"
      type="text"
      bind:value={notes}
      placeholder={$t.scores.notesPlaceholder}
    />
  </div>

  <div class="form-actions">
    <button class="btn-cancel" on:click={handleCancel}>{$t.common.cancel}</button>
    <button class="btn-save" on:click={handleSave}>
      {initial ? $t.scores.saveChanges : $t.scores.addScoreShort}
    </button>
  </div>
</div>

<style>
  .form { padding: 14px 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }

  .form-row { display: flex; align-items: center; gap: 10px; }
  .field-label { font-size: 13px; color: var(--muted); width: 56px; flex-shrink: 0; }

  .field-input {
    height: 30px; padding: 0 10px; border: 1.5px solid var(--border);
    border-radius: 6px; background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 13px; outline: none;
    transition: border-color 100ms ease;
  }
  .field-input:focus { border-color: var(--primary); }

  .score-inputs { display: flex; align-items: center; gap: 6px; }
  .score-inputs.error .field-input { border-color: var(--danger); }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .score-inputs.error { animation: shake 200ms ease; }
  .score-num { width: 64px; text-align: right; }
  .slash { color: var(--muted); font-size: 16px; }

  .date-input { width: 136px; }
  .notes-input { flex: 1; }

  .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .btn-cancel {
    padding: 6px 14px; border-radius: 8px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px; cursor: pointer;
  }
  .btn-save {
    padding: 6px 16px; border-radius: 8px; border: none;
    background: var(--primary); color: var(--bg); font-family: inherit;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
</style>
