<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { shareDeck, shareExamSet } from '$lib/groups';
  import { examQuestions, flashcards, subjects, topics } from '$lib/stores/data';
  import { t } from '$lib/i18n';
  import type { ExamQuestion } from '$lib/types';

  export let open = false;
  export let gid: string;

  interface ExamSet {
    title: string;
    questionIds: string[];
  }

  const dispatch = createEventDispatcher<{ close: void; refresh: void }>();
  let busyKey = '';

  $: decks = $topics
    .map(topic => ({
      topic,
      subjectName: $subjects.find(subject => subject.id === topic.subjectId)?.name,
      count: $flashcards.filter(card => card.topicId === topic.id).length,
    }))
    .filter(deck => deck.count > 0);
  $: examSets = buildExamSets($examQuestions);

  function buildExamSets(questions: ExamQuestion[]): ExamSet[] {
    const grouped = new Map<string, string[]>();
    for (const question of questions) {
      const ids = grouped.get(question.subject) ?? [];
      ids.push(question.id);
      grouped.set(question.subject, ids);
    }
    return [...grouped].map(([title, questionIds]) => ({ title, questionIds }));
  }

  function close() {
    if (busyKey) return;
    open = false;
    dispatch('close');
  }

  async function pickDeck(topicId: string) {
    if (busyKey) return;
    busyKey = `deck:${topicId}`;
    try {
      if (await shareDeck(gid, topicId)) {
        dispatch('refresh');
        closeAfterShare();
      }
    } finally {
      busyKey = '';
    }
  }

  async function pickExam(set: ExamSet) {
    if (busyKey) return;
    busyKey = `exam:${set.title}`;
    try {
      if (await shareExamSet(gid, set.questionIds, set.title)) {
        dispatch('refresh');
        closeAfterShare();
      }
    } finally {
      busyKey = '';
    }
  }

  function closeAfterShare() {
    open = false;
    dispatch('close');
  }
</script>

<BottomSheet {open} on:close={close}>
  <div class="sheet-header">
    <div>
      <h2>{$t.groups.sharePickerTitle}</h2>
      <p>{$t.groups.sharePickerSub}</p>
    </div>
    <button type="button" class="close" aria-label={$t.common.close} disabled={Boolean(busyKey)} on:click={close}>×</button>
  </div>

  {#if decks.length === 0 && examSets.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.groups.noShareable}</p>
    </div>
  {:else}
    {#if decks.length > 0}
      <section>
        <h3>{$t.groups.shareDeck}</h3>
        <div class="picker-list">
          {#each decks as deck (deck.topic.id)}
            <button type="button" class="picker-item" disabled={Boolean(busyKey)} on:click={() => pickDeck(deck.topic.id)}>
              <span class="item-icon" aria-hidden="true">▤</span>
              <span class="item-copy">
                <strong>{deck.topic.name}</strong>
                <small>{deck.subjectName ? `${deck.subjectName} · ` : ''}{$t.groups.cards(deck.count)}</small>
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if examSets.length > 0}
      <section>
        <h3>{$t.groups.shareExam}</h3>
        <div class="picker-list">
          {#each examSets as set (set.title)}
            <button type="button" class="picker-item" disabled={Boolean(busyKey)} on:click={() => pickExam(set)}>
              <span class="item-icon" aria-hidden="true">✓</span>
              <span class="item-copy">
                <strong>{set.title}</strong>
                <small>{$t.groups.questions(set.questionIds.length)}</small>
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</BottomSheet>

<style>
  .sheet-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0 2px 18px; }
  h2 { margin: 0; color: var(--text); font-size: 18px; }
  .sheet-header p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
  .close { width: 40px; height: 40px; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 50%; background: var(--bg3); color: var(--text); font: inherit; font-size: 22px; line-height: 1; cursor: pointer; }
  .close:disabled, .picker-item:disabled { cursor: default; opacity: 0.55; }
  section + section { margin-top: 20px; }
  section h3 { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .picker-list { display: flex; flex-direction: column; gap: 6px; }
  .picker-item { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 11px; padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
  .picker-item:hover { background: var(--bg3); }
  .item-icon { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; background: var(--primary-l); color: var(--primary); font-size: 17px; font-weight: 700; }
  .item-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .item-copy strong { overflow-wrap: anywhere; font-size: 14px; }
  .item-copy small { color: var(--muted); font-size: 11px; }
  .empty-state { padding: 28px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); text-align: center; }
  .empty-title { margin: 0; color: var(--text); font-size: 14px; font-weight: 600; }
</style>
