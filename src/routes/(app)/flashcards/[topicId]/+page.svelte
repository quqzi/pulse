<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { topics, subjects, flashcards, loadData, getAuthContext } from '$lib/stores/data';
  import { flashcardsRepo, topicsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import { presetDate } from '$lib/flashcards';
  import { localDateStr } from '$lib/utils';
  import { parseFlashcards, flashcardPrompt, type FlashcardDraft } from '$lib/import';
  import { toast } from '$lib/stores/toast';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ImportSheet from '$lib/components/ImportSheet.svelte';
  import MathText from '$lib/components/MathText.svelte';
  import MathToolbar from '$lib/components/MathToolbar.svelte';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';
  import type { Flashcard } from '$lib/types';

  onMount(() => {
    loadData($auth);
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  $: if ($auth.mode !== 'loading') loadData($auth);

  let prefersReduced = false;
  $: dur = prefersReduced ? 0 : 200;

  // Auto-start once the deck has loaded — onMount is too early (auth may
  // still be 'loading', making loadData a no-op and the deck empty).
  let autoStarted = false;
  $: if (!autoStarted && $page.url.searchParams.get('study') === '1' && deckCards.length > 0) {
    autoStarted = true;
    startStudy();
  }

  $: topicId = $page.params.topicId;
  $: topic = $topics.find(tp => tp.id === topicId);
  $: deckCards = $flashcards.filter(c => c.topicId === topicId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // ── card management ───────────────────────────────────────
  let editingId: string | null = null;
  let front = '';
  let back = '';

  let mathOpen = false;
  let frontEl: HTMLInputElement;
  let backEl: HTMLInputElement;
  let focusedField: 'front' | 'back' = 'front';

  function insertTex(tex: string) {
    const el = focusedField === 'front' ? frontEl : backEl;
    const cur = focusedField === 'front' ? front : back;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? start;
    const next = cur.slice(0, start) + tex + cur.slice(end);
    const hole = tex.includes('{}') ? tex.indexOf('{}') + 1 : tex.includes('()') ? tex.indexOf('()') + 1 : tex.length;
    if (focusedField === 'front') front = next; else back = next;
    queueMicrotask(() => { el?.focus(); el?.setSelectionRange(start + hole, start + hole); });
  }

  function startEdit(c: Flashcard) {
    editingId = c.id;
    front = c.front;
    back = c.back;
  }
  function resetForm() {
    editingId = null;
    front = '';
    back = '';
  }
  async function saveCard() {
    if (!front.trim() || !back.trim() || !topicId) return;
    const { userId } = getAuthContext();
    const existing = editingId ? deckCards.find(c => c.id === editingId) : null;
    await flashcardsRepo.save({
      id: existing?.id ?? newId(),
      userId: existing?.userId ?? userId,
      topicId,
      front: front.trim(),
      back: back.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    resetForm();
  }

  // ── AI import ─────────────────────────────────────────────
  let importOpen = false;
  let cardCount = 20;
  $: subjectName = $subjects.find(s => s.id === topic?.subjectId)?.name;
  $: importPrompt = flashcardPrompt(topic?.name ?? '', subjectName, cardCount);

  async function handleImport(e: CustomEvent<{ items: unknown[] }>) {
    if (!topicId) return;
    const { userId } = getAuthContext();
    const drafts = e.detail.items as FlashcardDraft[];
    for (const d of drafts) {
      await flashcardsRepo.save({
        id: newId(), userId, topicId,
        front: d.front, back: d.back,
        createdAt: new Date().toISOString(),
      });
    }
    importOpen = false;
    toast.success(get(t).importer.importedToast(drafts.length));
  }

  let deleteOpen = false;
  let pendingDeleteId: string | null = null;
  function promptDelete(id: string) { pendingDeleteId = id; deleteOpen = true; }
  async function doDelete() {
    if (pendingDeleteId) await flashcardsRepo.remove(pendingDeleteId);
    pendingDeleteId = null;
  }

  // Render at <body> so the overlay escapes `.main-content`'s stacking
  // context and layers above the fixed tab-bar.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  // ── study flow ────────────────────────────────────────────
  let studying = false;
  let studyIndex = 0;
  let revealed = false;
  let finished = false;

  function startStudy() {
    if (deckCards.length === 0) return;
    studying = true;
    studyIndex = 0;
    revealed = false;
    finished = false;
  }
  function nextCard() {
    if (studyIndex < deckCards.length - 1) {
      studyIndex += 1;
      revealed = false;
    } else {
      finished = true;
    }
  }
  async function schedule(days: number | null, pickedDate?: string) {
    if (topic && (days !== null || pickedDate)) {
      const next = pickedDate ?? presetDate(localDateStr(new Date()), days as number);
      await topicsRepo.save({ ...topic, nextStudyDate: next });
    }
    goto('/flashcards');
  }
  let pickDate = '';
</script>

<ConfirmDialog bind:open={deleteOpen} title={$t.flashcards.deleteCardTitle} message={$t.common.cannotUndo} on:confirm={doDelete} />

<svelte:window on:keydown={(e) => { if (studying && e.key === 'Escape' && !deleteOpen) studying = false; }} />

{#if studying}
  <div class="study-overlay" use:portal role="dialog" aria-modal="true">
    {#if !finished}
      {@const card = deckCards[studyIndex]}
      <div class="study-top">
        <button class="exit-btn" on:click={() => (studying = false)} aria-label={$t.common.close}>✕</button>
        <span class="study-progress">{$t.flashcards.progress(studyIndex + 1, deckCards.length)}</span>
      </div>
      <div class="study-bar" aria-hidden="true">
        <div class="study-bar-fill" style="transform: scaleX({(studyIndex + 1) / deckCards.length});"></div>
      </div>
      {#key studyIndex}
        <div class="study-card" in:fly={{ y: 14, duration: dur }}>
          <p class="study-front"><MathText text={card.front} /></p>
          {#if revealed}
            <div in:fly={{ y: 8, duration: dur }}>
              <div class="study-divider"></div>
              <p class="study-back"><MathText text={card.back} /></p>
            </div>
          {/if}
        </div>
      {/key}
      {#if revealed}
        <button class="study-action" on:click={nextCard}>{$t.flashcards.next}</button>
      {:else}
        <button class="study-action" on:click={() => (revealed = true)}>{$t.flashcards.reveal}</button>
      {/if}
    {:else}
      <div class="finish">
        <p class="finish-title">{$t.flashcards.finishTitle}</p>
        <div class="preset-grid">
          <button class="preset" on:click={() => schedule(1)}>{$t.flashcards.presetTomorrow}</button>
          <button class="preset" on:click={() => schedule(3)}>{$t.flashcards.preset3Days}</button>
          <button class="preset" on:click={() => schedule(7)}>{$t.flashcards.presetWeek}</button>
        </div>
        <div class="pick-row">
          <input type="date" bind:value={pickDate} aria-label={$t.flashcards.presetPick} />
          <button class="preset" disabled={!pickDate} on:click={() => schedule(null, pickDate)}>{$t.flashcards.presetPick}</button>
        </div>
        <button class="no-schedule" on:click={() => schedule(null)}>{$t.flashcards.noSchedule}</button>
      </div>
    {/if}
  </div>
{/if}

<div class="page">
  <div class="head">
    <button class="back-btn" on:click={() => goto('/flashcards')} aria-label={$t.flashcards.backToDecks}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
    </button>
    <h1 class="page-title">{topic?.name ?? '…'}</h1>
    <button class="import-open-btn" on:click={() => (importOpen = true)}>✦ {$t.importer.open}</button>
    {#if deckCards.length > 0}<button class="study-deck-btn" on:click={startStudy}>{$t.flashcards.study}</button>{/if}
  </div>

  <ImportSheet bind:open={importOpen} prompt={importPrompt} parse={parseFlashcards} on:import={handleImport} on:close={() => (importOpen = false)}>
    <div slot="options" class="opt-row">
      <span class="opt-label">{$t.importer.howMany}</span>
      {#each [10, 20, 30] as n (n)}
        <button class="opt-pill" class:active={cardCount === n} on:click={() => (cardCount = n)}>{n}</button>
      {/each}
    </div>
  </ImportSheet>

  {#if deckCards.length === 0}
    <p class="deck-empty">{$t.flashcards.deckEmpty}</p>
  {:else}
    <div class="card-list card">
      {#each deckCards as c, i (c.id)}
        <div class="card-row" class:divider={i > 0}>
          <div class="card-text">
            <p class="card-front"><MathText text={c.front} /></p>
            <p class="card-back"><MathText text={c.back} /></p>
          </div>
          <div class="card-actions">
            <button class="icon-btn" on:click={() => startEdit(c)} aria-label={$t.flashcards.editCard}>✎</button>
            <button class="icon-btn del" on:click={() => promptDelete(c.id)} aria-label={$t.flashcards.deleteCard}>✕</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="form card">
    <input class="field" bind:value={front} bind:this={frontEl} on:focus={() => (focusedField = 'front')} placeholder={$t.flashcards.frontPlaceholder} />
    <input class="field" bind:value={back} bind:this={backEl} on:focus={() => (focusedField = 'back')} placeholder={$t.flashcards.backPlaceholder} />
    {#if mathOpen}
      <MathToolbar on:insert={(e) => insertTex(e.detail.tex)} />
    {/if}
    {#if front.includes('$') || back.includes('$')}
      <div class="math-preview">
        {#if front.includes('$')}<p class="preview-line"><MathText text={front} /></p>{/if}
        {#if back.includes('$')}<p class="preview-line muted"><MathText text={back} /></p>{/if}
      </div>
    {/if}
    <div class="form-actions">
      <button class="math-toggle" class:active={mathOpen} on:click={() => (mathOpen = !mathOpen)} aria-label={$t.common.insertMath} aria-pressed={mathOpen}>√x</button>
      {#if editingId}<button class="btn-cancel" on:click={resetForm}>{$t.common.cancel}</button>{/if}
      <button class="btn-save" disabled={!front.trim() || !back.trim()} on:click={saveCard}>
        {editingId ? $t.flashcards.editCard : $t.flashcards.addCard}
      </button>
    </div>
  </div>
  <div class="bottom-spacer"></div>
</div>

<style>
  .page { padding: 20px 16px 0; max-width: 600px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-btn { background: var(--bg3); border: none; border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text); flex-shrink: 0; }
  .page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; margin-right: auto; }
  .study-deck-btn { padding: 8px 16px; border-radius: 16px; border: none; background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
  .import-open-btn { padding: 8px 14px; border-radius: 16px; border: 1.5px solid var(--border); background: var(--bg2); color: var(--text); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
  .import-open-btn:hover { background: var(--bg3); }
  .opt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .opt-label { font-size: 12px; color: var(--muted); margin-right: 2px; }
  .opt-pill { padding: 6px 12px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--bg); color: var(--muted); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 32px; }
  .opt-pill.active { border-color: var(--primary); background: var(--primary-l); color: var(--primary); }
  @media (max-width: 768px) { .import-open-btn, .study-deck-btn { min-height: 44px; } }
  .deck-empty { color: var(--muted); font-size: 14px; margin-bottom: 16px; }
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); }
  .card-list { overflow: hidden; margin-bottom: 16px; }
  .card-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; }
  .card-row.divider { border-top: 1px solid var(--border); }
  .card-text { flex: 1; min-width: 0; }
  .card-front { font-size: 14px; font-weight: 600; color: var(--text); margin: 0 0 2px; }
  .card-back { font-size: 13px; color: var(--muted); margin: 0; }
  .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .icon-btn { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); cursor: pointer; border-radius: 8px; font-size: 14px; }
  .icon-btn:hover { background: var(--bg3); }
  .icon-btn.del:hover { color: var(--danger); }
  .form { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .field { height: 36px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
  .field:focus { border-color: var(--primary); }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .math-toggle {
    margin-right: auto; padding: 6px 11px; border-radius: 8px;
    border: 1.5px solid var(--border); background: none; color: var(--muted);
    font-family: var(--font-mono); font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .math-toggle.active { border-color: var(--primary); color: var(--primary); background: var(--primary-l); }
  .math-preview { padding: 8px 10px; border-radius: 8px; background: var(--bg3); }
  .preview-line { margin: 0; font-size: 14px; color: var(--text); }
  .preview-line.muted { color: var(--muted); margin-top: 4px; }
  .btn-cancel { padding: 8px 14px; border-radius: 8px; border: 1.5px solid var(--border); background: none; color: var(--muted); font-family: inherit; font-size: 13px; cursor: pointer; }
  .btn-save { padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  .bottom-spacer { height: 40px; }

  .study-overlay { position: fixed; inset: 0; z-index: 1000; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; }
  .study-top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 16px; }
  .exit-btn { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; min-width: 44px; min-height: 44px; margin: -12px; }
  .study-progress { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .study-bar { position: absolute; top: 54px; left: 16px; right: 16px; height: 3px; border-radius: 2px; background: var(--bg3); overflow: hidden; }
  .study-bar-fill { height: 100%; width: 100%; background: var(--primary); border-radius: 2px; transform-origin: left; transition: transform 300ms ease-out; }
  .study-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 24px; width: 100%; max-width: 460px; min-height: 200px; display: flex; flex-direction: column; justify-content: center; }
  .study-front { font-size: 20px; font-weight: 600; color: var(--text); text-align: center; margin: 0; line-height: 1.4; }
  .study-divider { height: 1px; background: var(--border); margin: 20px 0; }
  .study-back { font-size: 17px; color: var(--text); text-align: center; margin: 0; line-height: 1.5; }
  .study-action { width: 100%; max-width: 460px; padding: 14px; border-radius: var(--radius-md); border: none; background: var(--primary); color: var(--bg); font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 120ms ease; }
  .study-action:active { transform: scale(0.98); }
  .finish { width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 12px; text-align: center; }
  .finish-title { font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
  .preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .preset { padding: 12px 8px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg2); color: var(--text); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform 120ms ease, background 120ms ease; }
  .preset:active:not(:disabled) { transform: scale(0.97); background: var(--bg3); }
  .preset:disabled { opacity: 0.4; cursor: not-allowed; }
  .pick-row { display: flex; gap: 8px; }
  .pick-row input { flex: 1; height: 40px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); font-family: inherit; font-size: 13px; }
  .no-schedule { padding: 10px; border-radius: 10px; border: none; background: none; color: var(--muted); font-family: inherit; font-size: 13px; cursor: pointer; }
</style>
