<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { importShare, type GroupShare } from '$lib/groups';
  import { t } from '$lib/i18n';
  import { subjects } from '$lib/stores/data';

  export let open: boolean;
  export let share: GroupShare;

  interface FlashcardPayload {
    topicName: string;
    subjectName: string | null;
    cards: { front: string; back: string }[];
  }

  interface ExamPayload {
    title: string;
    questions: { text: string }[];
  }

  const CREATE_NEW = '__create_new__';
  const dispatch = createEventDispatcher<{ done: void }>();

  let title = '';
  let targetSubjectId = '';
  let newSubjectName = '';
  let selected: boolean[] = [];
  let importing = false;

  $: flashcardPayload = share.kind === 'flashcard_deck' ? share.payload as FlashcardPayload : null;
  $: examPayload = share.kind === 'exam_set' ? share.payload as ExamPayload : null;
  $: items = flashcardPayload
    ? flashcardPayload.cards.map(card => `${card.front} — ${card.back}`)
    : examPayload?.questions.map(question => question.text) ?? [];
  $: selectedIndices = selected.flatMap((checked, index) => checked ? [index] : []);

  $: if (open) seed();

  function seed() {
    const initialTitle = (flashcardPayload?.topicName ?? examPayload?.title) || share.title;
    title = initialTitle;
    selected = items.map(() => true);
    importing = false;

    if (flashcardPayload) {
      const suggestedName = flashcardPayload.subjectName?.trim() || flashcardPayload.topicName;
      const existing = $subjects.find(subject => subject.name.toLocaleLowerCase() === suggestedName.toLocaleLowerCase());
      targetSubjectId = existing?.id ?? CREATE_NEW;
      newSubjectName = suggestedName;
    } else {
      targetSubjectId = '';
      newSubjectName = '';
    }
  }

  function close() {
    if (importing) return;
    open = false;
  }

  function setAll(checked: boolean) {
    selected = items.map(() => checked);
  }

  async function confirm() {
    if (importing || selectedIndices.length === 0) return;
    importing = true;
    try {
      await importShare(share, {
        targetSubjectId: share.kind === 'flashcard_deck' && targetSubjectId !== CREATE_NEW
          ? targetSubjectId
          : undefined,
        newSubjectName: share.kind === 'flashcard_deck' && targetSubjectId === CREATE_NEW
          ? newSubjectName
          : undefined,
        title,
        selectedIndices,
      });
      dispatch('done');
      open = false;
    } finally {
      importing = false;
    }
  }
</script>

<BottomSheet {open} on:close={close}>
  <div class="sheet-header">
    <div>
      <h2>{$t.groups.importTitle}</h2>
      <p>{share.kind === 'flashcard_deck' ? $t.groups.shareDeck : $t.groups.shareExam}</p>
    </div>
    <button type="button" class="close" aria-label={$t.common.close} disabled={importing} on:click={close}>×</button>
  </div>

  <label class="field" for="import-share-title">
    <span>{$t.groups.importName}</span>
    <input id="import-share-title" type="text" bind:value={title} disabled={importing} />
  </label>

  {#if flashcardPayload}
    <label class="field" for="import-share-target">
      <span>{$t.groups.importTarget}</span>
      <select id="import-share-target" bind:value={targetSubjectId} disabled={importing}>
        {#each $subjects as subject (subject.id)}
          <option value={subject.id}>{subject.name}</option>
        {/each}
        <option value={CREATE_NEW}>{$t.groups.createNew}</option>
      </select>
    </label>

    {#if targetSubjectId === CREATE_NEW}
      <label class="field" for="import-share-subject">
        <span>{$t.groups.newSubjectName}</span>
        <input id="import-share-subject" type="text" bind:value={newSubjectName} disabled={importing} />
      </label>
    {/if}
  {:else}
    <p class="subject-note">{$t.groups.keepSubjectTags}</p>
  {/if}

  <section class="preview" aria-labelledby="import-preview-heading">
    <div class="preview-header">
      <div>
        <h3 id="import-preview-heading">{$t.groups.importPreview}</h3>
        <p>{$t.groups.itemsSelected(selectedIndices.length, items.length)}</p>
      </div>
      <div class="selection-actions">
        <button type="button" disabled={importing || selectedIndices.length === items.length} on:click={() => setAll(true)}>
          {$t.groups.selectAll}
        </button>
        <button type="button" disabled={importing || selectedIndices.length === 0} on:click={() => setAll(false)}>
          {$t.groups.selectNone}
        </button>
      </div>
    </div>

    <div class="item-list">
      {#each items as item, index (index)}
        <label class="item">
          <input type="checkbox" bind:checked={selected[index]} disabled={importing} />
          <span>{item}</span>
        </label>
      {/each}
    </div>
  </section>

  <button type="button" class="confirm" disabled={importing || selectedIndices.length === 0} on:click={confirm}>
    {$t.groups.importSelected}
  </button>
</BottomSheet>

<style>
  .sheet-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0 2px 18px; }
  h2 { margin: 0; color: var(--text); font-size: 18px; }
  .sheet-header p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
  .close { width: 40px; height: 40px; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 50%; background: var(--bg3); color: var(--text); font: inherit; font-size: 22px; line-height: 1; cursor: pointer; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; color: var(--text); font-size: 12px; font-weight: 600; }
  input[type="text"], select { width: 100%; min-height: 44px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; background: var(--bg2); color: var(--text); font: inherit; }
  .subject-note { margin: -2px 0 14px; color: var(--muted); font-size: 12px; }
  .preview { margin-top: 4px; }
  .preview-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .preview-header h3 { margin: 0; color: var(--text); font-size: 14px; }
  .preview-header p { margin: 3px 0 0; color: var(--muted); font-size: 11px; }
  .selection-actions { display: flex; gap: 6px; }
  .selection-actions button { min-height: 36px; padding: 6px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
  .item-list { display: flex; flex-direction: column; gap: 6px; }
  .item { min-height: 44px; display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg2); color: var(--text); font-size: 13px; line-height: 1.4; cursor: pointer; }
  .item input { width: 18px; height: 18px; flex: 0 0 auto; margin: 0; accent-color: var(--primary); }
  .item span { min-width: 0; overflow-wrap: anywhere; }
  .confirm { width: 100%; min-height: 46px; margin-top: 16px; border: 1px solid var(--primary); border-radius: 10px; background: var(--primary); color: var(--bg); font: inherit; font-weight: 700; cursor: pointer; }
  button:disabled, input:disabled, select:disabled { cursor: default; opacity: 0.55; }

  @media (max-width: 480px) {
    .preview-header { flex-direction: column; }
    .selection-actions { width: 100%; }
    .selection-actions button { flex: 1; min-height: 44px; }
  }
</style>
