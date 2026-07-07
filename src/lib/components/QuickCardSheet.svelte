<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Picker from '$lib/components/Picker.svelte';
  import MathInput from '$lib/components/MathInput.svelte';
  import MathToolbar from '$lib/components/MathToolbar.svelte';
  import { subjects, topics, getAuthContext } from '$lib/stores/data';
  import { flashcardsRepo, topicsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import type { Topic } from '$lib/types';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void; created: { topicId: string } }>();

  const NEW_TOPIC = '__new__';

  let subjectId = '';
  let topicId = '';
  let newTopicName = '';
  let front = '';
  let back = '';
  let mathOpen = false;
  let frontEl: MathInput;
  let backEl: MathInput;
  let focusedField: 'front' | 'back' = 'front';
  let saving = false;

  $: subjectTopics = $topics.filter((tp) => tp.subjectId === subjectId);

  // Drop a stale topic selection when the subject changes underneath it.
  $: if (subjectId && topicId && topicId !== NEW_TOPIC && !subjectTopics.some((tp) => tp.id === topicId)) {
    topicId = '';
  }

  $: subjectOptions = $subjects.map((s) => ({ value: s.id, label: `${s.symbol} ${s.name}`, color: s.color }));
  $: topicOptions = [
    ...subjectTopics.map((tp) => ({ value: tp.id, label: tp.name })),
    { value: NEW_TOPIC, label: $t.flashcards.newDeckOption },
  ];

  $: creatingTopic = topicId === NEW_TOPIC;
  $: canSave =
    !!subjectId &&
    (creatingTopic ? newTopicName.trim().length > 0 : !!topicId) &&
    front.trim().length > 0 &&
    back.trim().length > 0 &&
    !saving;

  function insertTex(tex: string) {
    (focusedField === 'front' ? frontEl : backEl)?.insertSnippet(tex);
  }

  async function save() {
    if (!canSave) return;
    saving = true;
    const { userId } = getAuthContext();

    let targetTopicId = topicId;
    if (creatingTopic) {
      const orderIndex = subjectTopics.reduce((m, tp) => Math.max(m, tp.orderIndex + 1), 0);
      const topic: Topic = { id: newId(), subjectId, name: newTopicName.trim(), orderIndex };
      await topicsRepo.create(topic);
      targetTopicId = topic.id;
    }

    await flashcardsRepo.save({
      id: newId(),
      userId,
      topicId: targetTopicId,
      front: front.trim(),
      back: back.trim(),
      createdAt: new Date().toISOString(),
    });

    saving = false;
    toast.success(get(t).flashcards.cardAdded);
    dispatch('created', { topicId: targetTopicId });

    // Keep the sheet open for rapid multi-add: stay on the (now existing) deck,
    // clear only the card fields, and refocus the front.
    topicId = targetTopicId;
    newTopicName = '';
    front = '';
    back = '';
    focusedField = 'front';
    frontEl?.focus();
  }

  function onClose() {
    dispatch('close');
  }
</script>

<BottomSheet {open} label={$t.flashcards.newCardTitle} on:close={onClose}>
  <h2 class="sheet-title">{$t.flashcards.newCardTitle}</h2>

  {#if $subjects.length === 0}
    <p class="hint">{$t.flashcards.noSubjectsHint}</p>
    <a class="hint-link" href="/subjects">{$t.flashcards.goToSubjects}</a>
  {:else}
    <div class="field">
      <span class="field-label">{$t.flashcards.subjectField}</span>
      <Picker
        bind:value={subjectId}
        options={subjectOptions}
        placeholder={$t.flashcards.pickSubject}
        ariaLabel={$t.flashcards.subjectField}
      />
    </div>

    {#if subjectId}
      <div class="field">
        <span class="field-label">{$t.flashcards.deckField}</span>
        <Picker
          bind:value={topicId}
          options={topicOptions}
          placeholder={$t.flashcards.pickDeck}
          ariaLabel={$t.flashcards.deckField}
        />
      </div>
      {#if creatingTopic}
        <input
          class="text-input"
          bind:value={newTopicName}
          placeholder={$t.flashcards.newDeckPlaceholder}
          aria-label={$t.flashcards.newDeckPlaceholder}
        />
      {/if}
    {/if}

    <div class="field">
      <span class="field-label">{$t.flashcards.front}</span>
      <MathInput
        bind:value={front}
        bind:this={frontEl}
        on:focus={() => (focusedField = 'front')}
        placeholder={$t.flashcards.frontPlaceholder}
        ariaLabel={$t.flashcards.front}
      />
    </div>
    <div class="field">
      <span class="field-label">{$t.flashcards.back}</span>
      <MathInput
        bind:value={back}
        bind:this={backEl}
        on:focus={() => (focusedField = 'back')}
        placeholder={$t.flashcards.backPlaceholder}
        ariaLabel={$t.flashcards.back}
      />
    </div>

    {#if mathOpen}
      <MathToolbar on:insert={(e) => insertTex(e.detail.tex)} />
    {/if}

    <div class="actions">
      <button
        class="math-toggle"
        class:active={mathOpen}
        on:click={() => (mathOpen = !mathOpen)}
        aria-label={$t.common.insertMath}
        aria-pressed={mathOpen}>√x</button
      >
      <button class="btn-done" on:click={onClose}>{$t.common.done}</button>
      <button class="btn-save" disabled={!canSave} on:click={save}>{$t.flashcards.addCard}</button>
    </div>
  {/if}
</BottomSheet>

<style>
  .sheet-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .text-input {
    width: 100%;
    box-sizing: border-box;
    margin: -4px 0 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 9px 11px;
    font-size: 14px;
    color: var(--text);
    font-family: inherit;
  }
  .text-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .math-toggle {
    margin-right: auto;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    background: none;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .math-toggle.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-l);
  }
  .btn-done {
    padding: 9px 14px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    background: none;
    color: var(--muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-save {
    padding: 9px 18px;
    border-radius: 8px;
    border: none;
    background: var(--primary);
    color: var(--bg);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .hint {
    font-size: 14px;
    color: var(--muted);
    margin: 0 0 10px;
  }
  .hint-link {
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  @media (max-width: 768px) {
    .math-toggle,
    .btn-done,
    .btn-save {
      min-height: 44px;
    }
  }
</style>
