<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, flashcards, loadData } from '$lib/stores/data';
  import { newId } from '$lib/id';
  import { topicsRepo, subjectsRepo } from '$lib/data/entities';
  import { deckState } from '$lib/flashcards';
  import { localDateStr } from '$lib/utils';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import SubjectEditSheet from '$lib/components/subjects/SubjectEditSheet.svelte';
  import { t, fmt } from '$lib/i18n';

  $: subjectId = $page.params.id;
  $: subject = $subjects.find(s => s.id === subjectId);
  $: subjectTopics = $topics.filter(tp => tp.subjectId === subjectId);
  $: today = localDateStr(new Date());
  $: cardCountFor = (topicId: string) => $flashcards.filter(c => c.topicId === topicId).length;

  let newTopicName = '';
  let adding = false;
  let submitting = false;
  let editingTopicId: string | null = null;
  let editTopicName = '';

  let subjectEditOpen = false;

  async function handleSubjectSave(
    e: CustomEvent<{ name: string; symbol: string; color: string; colorRgb: string }>
  ) {
    if (!subject) return;
    const f = e.detail;
    await subjectsRepo.save({
      ...subject,
      name: f.name,
      symbol: f.symbol,
      color: f.color,
      colorRgb: f.colorRgb,
    });
  }

  async function handleSubjectDelete() {
    if (!subject) return;
    await subjectsRepo.removeCascade(subject.id);
    goto('/subjects');
  }

  async function addTopic() {
    if (submitting || !newTopicName.trim() || !subjectId) return;
    submitting = true;
    try {
      const topic = {
        id: newId(),
        subjectId,
        name: newTopicName.trim(),
        orderIndex: subjectTopics.length,
      };
      await topicsRepo.create(topic);
      newTopicName = '';
      adding = false;
    } finally {
      submitting = false;
    }
  }

  function startEditTopic(topic: import('$lib/types').Topic) {
    editingTopicId = topic.id;
    editTopicName = topic.name;
  }

  async function saveEditTopic(topic: import('$lib/types').Topic) {
    const trimmed = editTopicName.trim();
    if (!trimmed || trimmed === topic.name) {
      editingTopicId = null;
      return;
    }
    await topicsRepo.save({ ...topic, name: trimmed });
    editingTopicId = null;
  }

  function cancelEditTopic() {
    editingTopicId = null;
  }

  async function toggleDone(topic: import('$lib/types').Topic) {
    await topicsRepo.save({ ...topic, done: !topic.done });
  }

  let editingNoteId: string | null = null;
  let editNoteText = '';

  function startEditNote(topic: import('$lib/types').Topic) {
    editingNoteId = topic.id;
    editNoteText = topic.note ?? '';
  }

  async function saveEditNote(topic: import('$lib/types').Topic) {
    const note = editNoteText.trim();
    if ((note || undefined) === (topic.note ?? undefined)) {
      editingNoteId = null;
      return;
    }
    await topicsRepo.save({ ...topic, note: note || undefined });
    editingNoteId = null;
  }

  function cancelEditNote() {
    editingNoteId = null;
  }

  let topicConfirmOpen = false;
  let pendingDeleteTopicId: string | null = null;

  function promptDeleteTopic(topicId: string) {
    pendingDeleteTopicId = topicId;
    topicConfirmOpen = true;
  }

  async function doDeleteTopic() {
    if (!pendingDeleteTopicId) return;
    const topicId = pendingDeleteTopicId;
    pendingDeleteTopicId = null;
    await topicsRepo.removeCascade(topicId);
  }

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<ConfirmDialog
  bind:open={topicConfirmOpen}
  title={$t.subjects.deleteTopicTitle}
  message={$t.subjects.deleteTopicMessage}
  on:confirm={doDeleteTopic}
/>

<div class="page">
  {#if !subject}
    <p class="text-body" style="color:var(--muted)">{$t.subjects.notFound}</p>
  {:else}
    <div class="page-header">
      <button class="back-btn" on:click={() => goto('/subjects')} aria-label={$t.common.back}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5m7-7l-7 7 7 7"/>
        </svg>
      </button>
      <div class="subject-header" style="color: {subject.color};">
        <span class="subject-symbol">{subject.symbol}</span>
        <h1 class="text-large-title">{subject.name}</h1>
      </div>
      <button class="subject-edit-btn" on:click={() => (subjectEditOpen = true)}>{$t.common.edit}</button>
    </div>

    <div class="section-label topics-label">{$t.subjects.topics.toUpperCase()}</div>

    {#if subjectTopics.length === 0}
      <p class="text-body empty">{$t.subjects.noTopics}</p>
    {:else}
      <div class="topics-list card">
        {#each subjectTopics as topic, i (topic.id)}
          {@const cardCount = cardCountFor(topic.id)}
          {@const state = deckState(topic.nextStudyDate, cardCount, today)}
          <div class="topic-row" class:divider={i > 0}>
            <button
              class="done-checkbox"
              class:checked={topic.done}
              on:click={() => toggleDone(topic)}
              aria-label={topic.done ? $t.subjects.unmarkCovered : $t.subjects.markCovered}
            >
              {#if topic.done}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
                  <path d="M8 12l3 3 5-6" stroke="var(--bg)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2" fill="none" />
                </svg>
              {/if}
            </button>
            <div class="topic-info">
              {#if editingTopicId === topic.id}
                <input
                  class="edit-input"
                  bind:value={editTopicName}
                  on:keydown={e => {
                    if (e.key === 'Enter') saveEditTopic(topic);
                    if (e.key === 'Escape') cancelEditTopic();
                  }}
                  on:blur={() => saveEditTopic(topic)}
                />
              {:else}
                <span class="topic-name topic-name-text">{topic.name}</span>
              {/if}
              {#if state !== 'empty' && editingTopicId !== topic.id}
                <a class="deck-status" class:due={state === 'new' || state === 'due'} href="/flashcards/{topic.id}">
                  {$t.flashcards.cardsCount(cardCount)} ·
                  {#if state === 'new'}{$t.flashcards.stateNew}
                  {:else if state === 'due'}{$t.flashcards.stateDue}
                  {:else}{$t.flashcards.nextOn($fmt.date(topic.nextStudyDate + 'T00:00:00', { day: 'numeric', month: 'short' }))}{/if}
                </a>
              {/if}
              {#if editingNoteId === topic.id}
                <input
                  class="note-input"
                  bind:value={editNoteText}
                  placeholder={$t.subjects.notePlaceholder}
                  on:keydown={e => {
                    if (e.key === 'Enter') saveEditNote(topic);
                    if (e.key === 'Escape') cancelEditNote();
                  }}
                  on:blur={() => saveEditNote(topic)}
                />
              {:else if topic.note}
                <p class="topic-note">{topic.note}</p>
              {/if}
            </div>
            <div class="topic-actions">
              {#if (state === 'new' || state === 'due') && editingTopicId !== topic.id}
                <a
                  class="review-btn"
                  style="background: color-mix(in srgb, {subject.color} 12%, transparent); color: {subject.color};"
                  href="/flashcards/{topic.id}?study=1"
                >{$t.flashcards.study}</a>
              {/if}
              {#if editingTopicId !== topic.id}
                <a class="icon-btn deck-btn" href="/flashcards/{topic.id}" aria-label={$t.nav.flashcards}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                    <path d="M7 9h6M7 13h4" />
                  </svg>
                </a>
                <button
                  class="icon-btn note-btn"
                  class:has-note={!!topic.note}
                  on:click={() => startEditNote(topic)}
                  aria-label={topic.note ? $t.subjects.editNote : $t.subjects.addNote}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 13h6M9 17h4" />
                  </svg>
                </button>
                <button class="icon-btn edit-icon" on:click={() => startEditTopic(topic)} aria-label={$t.subjects.editTopicLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              {/if}
              <button class="del-btn" on:click={() => promptDeleteTopic(topic.id)} aria-label={$t.common.delete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if adding}
      <div class="add-row">
        <!-- svelte-ignore a11y_autofocus — field appears on explicit user action -->
        <input
          type="text"
          placeholder={$t.subjects.topicName}
          bind:value={newTopicName}
          class="field-input"
          autofocus
          on:keydown={e => e.key === 'Enter' && addTopic()}
        />
        <button class="btn-primary add-btn" on:click={addTopic} disabled={!newTopicName.trim() || submitting}>{$t.common.add}</button>
        <button class="cancel-btn" on:click={() => { adding = false; newTopicName = ''; }}>{$t.common.cancel}</button>
      </div>
    {:else}
      <button
        class="add-topic-btn"
        style="color: {subject.color};"
        on:click={() => adding = true}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        {$t.subjects.addTopic}
      </button>
    {/if}
  {/if}
</div>

<SubjectEditSheet
  bind:open={subjectEditOpen}
  {subject}
  on:save={handleSubjectSave}
  on:delete={handleSubjectDelete}
/>

<style>
  .page { padding: 20px 16px; max-width: 600px; margin: 0 auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .back-btn {
    background: var(--bg3);
    border: none;
    border-radius: 10px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text);
    flex-shrink: 0;
  }
  .subject-header { display: flex; align-items: center; gap: 10px; margin-right: auto; }
  .subject-edit-btn {
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .subject-edit-btn:hover { background: var(--bg3); }
  @media (max-width: 768px) {
    .subject-edit-btn { min-height: 44px; }
  }
  .subject-symbol { font-size: 22px; font-weight: 800; }
  h1 { margin: 0; }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .topics-label { padding: 0 2px; }
  .empty { color: var(--muted); margin-bottom: 12px; }
  .topics-list { padding: 0; overflow: hidden; margin-bottom: 12px; }
  .topic-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
  }
  .topic-row.divider { border-top: 1px solid var(--border); }
  .done-checkbox {
    width: 28px; height: 28px; border-radius: 8px; border: none;
    background: transparent; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .done-checkbox.checked { color: var(--primary); }
  .done-checkbox:hover { background: var(--bg3); }
  @media (max-width: 768px) {
    .done-checkbox, .icon-btn, .del-btn { min-width: 44px; min-height: 44px; }
  }
  .topic-note { font-size: 12px; color: var(--muted); margin: 2px 0 0; line-height: 1.4; }
  .note-input {
    width: 100%; margin-top: 4px; padding: 4px 8px;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text); font-family: inherit; font-size: 12px; outline: none;
  }
  .note-input:focus { border-color: var(--primary); }
  .note-btn.has-note { color: var(--primary); }
  .topic-info { flex: 1; min-width: 0; }
  .topic-name { font-size: 15px; font-weight: 500; color: var(--text); display: block; }
  .deck-status {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    margin-top: 2px;
    display: block;
    text-decoration: none;
  }
  .deck-status.due { color: var(--danger); }
  .deck-status:hover { text-decoration: underline; }
  .topic-actions { display: flex; align-items: center; gap: 6px; }
  .review-btn {
    padding: 5px 12px;
    border-radius: 16px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .review-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .del-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .del-btn:hover { background: var(--bg3); color: var(--danger); }
  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Always visible on touch; the hover-fade is a desktop-only nicety. */
  .edit-icon {
    opacity: 1;
    transition: opacity 140ms ease;
  }
  @media (hover: hover) {
    .edit-icon { opacity: 0; }
    .topic-row:hover .edit-icon { opacity: 1; }
  }
  .edit-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--primary);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 14px;
    color: var(--text);
    font-family: inherit;
    outline: none;
  }
  .add-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .field-input {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid var(--primary);
    border-radius: 10px;
    background: var(--bg2);
    color: var(--text);
    font-size: 15px;
    outline: none;
  }
  .add-btn {
    padding: 10px 18px;
    border-radius: 10px;
    background: var(--primary);
    color: var(--bg);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
  .add-btn:disabled { opacity: 0.4; }
  .cancel-btn {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--bg3);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
  .add-topic-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 2px;
    margin-top: 4px;
  }
</style>
