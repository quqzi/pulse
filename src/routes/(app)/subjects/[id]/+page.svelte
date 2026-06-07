<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, loadData } from '$lib/stores/data';
  import { newId } from '$lib/id';
  import { topicsRepo, srsRepo, subjectsRepo } from '$lib/data/entities';
  import { reviewCard, isDue } from '$lib/srs';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import SubjectEditSheet from '$lib/components/subjects/SubjectEditSheet.svelte';
  import { t, fmt } from '$lib/i18n';

  $: subjectId = $page.params.id;
  $: subject = $subjects.find(s => s.id === subjectId);
  $: subjectTopics = $topics.filter(tp => tp.subjectId === subjectId);
  $: cardForTopic = (topicId: string) => $srsCards.find(c => c.topicId === topicId);

  let newTopicName = '';
  let adding = false;
  let submitting = false;
  let editingTopicId: string | null = null;
  let editTopicName = '';
  let reviewingCard: { topicId: string; topicName: string } | null = null;

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

  async function handleReview(rating: 1 | 2 | 3 | 4) {
    if (!reviewingCard) return;
    const card = $srsCards.find(c => c.topicId === reviewingCard!.topicId);
    if (!card) return;
    const result = reviewCard(card.ease, card.intervalDays, rating);
    const updated = { ...card, ...result, reps: card.reps + 1 };
    await srsRepo.update(updated);
    reviewingCard = null;
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

{#if reviewingCard}
  <div class="overlay" on:click|self={() => reviewingCard = null}>
    <div class="review-card card">
      <p class="section-label" style="text-align:center; margin-bottom:12px;">{$t.subjects.review.toUpperCase()}</p>
      <h3 class="text-heading" style="text-align:center; margin-bottom:4px;">{reviewingCard.topicName}</h3>
      <p class="text-body" style="color: var(--muted); text-align: center; margin-bottom:24px;">{$t.subjects.howWell}</p>
      <div class="rating-row">
        {#each ([1,2,3,4] as const) as r}
          {@const ratingLabels = {1:$t.subjects.again,2:$t.subjects.hard,3:$t.subjects.good,4:$t.subjects.easy}}
          {@const colors = {1:'var(--srs-again)',2:'var(--srs-hard)',3:'var(--srs-good)',4:'var(--srs-easy)'}}
          <button
            class="rating-btn"
            style="background: {colors[r]};"
            on:click={() => handleReview(r)}
          >{ratingLabels[r]}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<div class="page">
  {#if !subject}
    <p class="text-body" style="color:var(--muted)">{$t.subjects.notFound}</p>
  {:else}
    <div class="page-header">
      <button class="back-btn" on:click={() => goto('/subjects')}>
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
          {@const card = cardForTopic(topic.id)}
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
              {#if card && editingTopicId !== topic.id}
                <span class="srs-status" class:due={card.reps > 0 && isDue(card.dueDate)} class:reviewed={card.reps > 0 && !isDue(card.dueDate)}>
                  {#if card.reps === 0}
                    {$t.subjects.new}
                  {:else if isDue(card.dueDate)}
                    {$t.subjects.dueToday}
                  {:else}
                    {$t.subjects.dueLabel($fmt.date(card.dueDate, { day: 'numeric', month: 'short' }))}
                  {/if}
                </span>
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
              {#if card && isDue(card.dueDate) && editingTopicId !== topic.id}
                <button
                  class="review-btn"
                  style="background: color-mix(in srgb, {subject.color} 12%, transparent); color: {subject.color};"
                  on:click={() => reviewingCard = { topicId: topic.id, topicName: topic.name }}
                >{$t.subjects.review}</button>
              {/if}
              {#if editingTopicId !== topic.id}
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
              <button class="del-btn" on:click={() => promptDeleteTopic(topic.id)}>
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
  .srs-status {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    margin-top: 2px;
    display: block;
  }
  .srs-status.due { color: var(--danger); }
  .srs-status.reviewed { color: var(--success); }
  .topic-actions { display: flex; align-items: center; gap: 6px; }
  .review-btn {
    padding: 5px 12px;
    border-radius: 16px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
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
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
  }
  .review-card { padding: 28px 24px; max-width: 320px; width: 100%; }
  .rating-row { display: flex; gap: 8px; }
  .rating-btn {
    flex: 1;
    padding: 11px 0;
    border-radius: 12px;
    border: none;
    color: #fff; /* stylelint-disable-line declaration-property-value-disallowed-list */
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .rating-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
</style>
