<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { postChallenge } from '$lib/groups';
  import { t } from '$lib/i18n';
  import { examQuestions } from '$lib/stores/data';
  import type { ExamQuestion } from '$lib/types';

  export let open = false;
  export let gid: string;

  interface ExamSet {
    title: string;
    questionIds: string[];
  }

  const dispatch = createEventDispatcher<{ close: void; posted: void }>();
  let busyKey = '';

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

  async function pickExam(set: ExamSet) {
    if (busyKey) return;
    busyKey = set.title;
    try {
      if (await postChallenge(gid, set.questionIds, set.title)) {
        open = false;
        dispatch('posted');
        dispatch('close');
      }
    } finally {
      busyKey = '';
    }
  }
</script>

<BottomSheet {open} on:close={close}>
  <div class="sheet-header">
    <div>
      <h2>{$t.groups.newChallenge}</h2>
      <p>{$t.groups.sharePickerSub}</p>
    </div>
    <button type="button" class="close" aria-label={$t.common.close} disabled={Boolean(busyKey)} on:click={close}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  </div>

  {#if examSets.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.groups.noExamSets}</p>
    </div>
  {:else}
    <section>
      <h3>{$t.groups.shareExam}</h3>
      <div class="picker-list">
        {#each examSets as set (set.title)}
          <button type="button" class="picker-item" disabled={Boolean(busyKey)} on:click={() => pickExam(set)}>
            <span class="item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                <path d="m8 9 1.5 1.5L12 8M13 10h3M8 15h8" />
              </svg>
            </span>
            <span class="item-copy">
              <strong>{set.title}</strong>
              <small>{$t.groups.questions(set.questionIds.length)}</small>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</BottomSheet>

<style>
  .sheet-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0 2px 18px; }
  h2 { margin: 0; color: var(--text); font-size: 18px; }
  .sheet-header p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
  .close { width: 40px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--bg3); color: var(--text); cursor: pointer; }
  .close svg { width: 18px; height: 18px; }
  .close:disabled, .picker-item:disabled { cursor: default; opacity: 0.55; }
  section h3 { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .picker-list { display: flex; flex-direction: column; gap: 6px; }
  .picker-item { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 11px; padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
  .picker-item:hover { background: var(--bg3); }
  .item-icon { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; background: var(--primary-l); color: var(--primary); }
  .item-icon svg { width: 18px; height: 18px; }
  .item-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .item-copy strong { overflow-wrap: anywhere; font-size: 14px; }
  .item-copy small { color: var(--muted); font-size: 11px; }
  .empty-state { padding: 28px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); text-align: center; }
  .empty-title { margin: 0; color: var(--text); font-size: 14px; font-weight: 600; }
</style>
