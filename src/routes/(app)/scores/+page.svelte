<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { scores, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import ScoreForm from '$lib/components/scores/ScoreForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { MockScore } from '$lib/types';

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  let adding = false;
  let editingScore: MockScore | null = null;
  let activeSubjectId = 'all';


  function formatDate(d: string): string {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  $: filteredScores = (activeSubjectId === 'all'
    ? [...$scores]
    : $scores.filter(s => s.subjectId === activeSubjectId)
  ).sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  function trendData(subjectId: string): number[] {
    return $scores
      .filter(s => s.subjectId === subjectId)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .map(s => s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0);
  }

  function subjectName(subjectId: string): string {
    return $subjects.find(s => s.id === subjectId)?.name ?? 'Unknown';
  }

  function subjectColor(subjectId: string): string {
    return $subjects.find(s => s.id === subjectId)?.color ?? 'var(--primary)';
  }

  function subjectSymbol(subjectId: string): string {
    return $subjects.find(s => s.id === subjectId)?.symbol ?? '?';
  }

  $: scoredSubjectIds = [...new Set($scores.map(s => s.subjectId))];

  function openAdd() {
    editingScore = null;
    adding = true;
  }

  function openEdit(score: MockScore) {
    editingScore = score;
    adding = true;
  }

  async function handleSave(e: CustomEvent<MockScore>) {
    const entry = e.detail;
    const { userId, mode } = getAuthContext();
    const withUser: MockScore = { ...entry, userId };
    scores.update(all => {
      const idx = all.findIndex(s => s.id === withUser.id);
      if (idx >= 0) { const next = [...all]; next[idx] = withUser; return next; }
      return [withUser, ...all];
    });
    await db.saveScore(withUser, mode);
    adding = false;
    editingScore = null;
  }

  function handleCancel() {
    adding = false;
    editingScore = null;
  }

  let scoreConfirmOpen = false;
  let pendingDeleteScore: MockScore | null = null;

  function promptDeleteScore(score: MockScore) {
    pendingDeleteScore = score;
    scoreConfirmOpen = true;
  }

  async function doDeleteScore() {
    if (!pendingDeleteScore) return;
    const score = pendingDeleteScore;
    pendingDeleteScore = null;
    const { mode } = getAuthContext();
    scores.update(all => all.filter(s => s.id !== score.id));
    await db.deleteScore(score.id, mode);
  }
</script>

<ConfirmDialog
  bind:open={scoreConfirmOpen}
  title="Delete score?"
  message="This cannot be undone."
  on:confirm={doDeleteScore}
/>

<div class="page">
  <div class="header-row">
    <h1 class="page-title">Scores</h1>
    {#if !adding}
      <button class="btn-add-score" on:click={openAdd}>+ Add Score</button>
    {/if}
  </div>

  {#if adding}
    <ScoreForm
      subjects={$subjects}
      initial={editingScore}
      on:save={handleSave}
      on:cancel={handleCancel}
    />
  {/if}

  {#if $scores.length > 0}
    <div class="tab-row">
      <button
        class="tab-btn"
        class:active={activeSubjectId === 'all'}
        on:click={() => activeSubjectId = 'all'}
      >All</button>
      {#each scoredSubjectIds as sid}
        <button
          class="tab-btn"
          class:active={activeSubjectId === sid}
          style="--tab-color:{subjectColor(sid)}"
          on:click={() => activeSubjectId = sid}
        >{subjectSymbol(sid)}</button>
      {/each}
    </div>
  {/if}

  {#if filteredScores.length === 0}
    <div class="empty">
      {#if $scores.length === 0}
        No scores yet. Tap "Add Score" to record your first mock exam result.
      {:else}
        No scores for this subject.
      {/if}
    </div>
  {:else}
    <ul class="score-list">
      {#each filteredScores as score (score.id)}
        {@const color = subjectColor(score.subjectId)}
        {@const pct = score.maxScore > 0 ? Math.round((score.score / score.maxScore) * 100) : 0}
        {@const trend = trendData(score.subjectId)}
        <li class="score-item card">
          <div class="score-left">
            <span class="subj-chip" style="background:{color}22;color:{color}">
              {subjectSymbol(score.subjectId)}
            </span>
            <div class="score-meta">
              <span class="subj-name">{subjectName(score.subjectId)}</span>
              <span class="score-date">{formatDate(score.takenAt)}</span>
              {#if score.notes}
                <span class="score-notes">{score.notes}</span>
              {/if}
            </div>
          </div>

          <div class="score-right">
            <div class="score-display">
              <span class="score-fraction">{score.score} / {score.maxScore}</span>
              <span class="score-pct" style="color:{color}">{pct}%</span>
            </div>
            <div class="trend-bar-track">
              {#each trend as pt}
                <div
                  class="trend-bar-seg"
                  style="height:{pt}%;background:{color}"
                  title="{pt}%"
                ></div>
              {/each}
            </div>
          </div>

          <div class="item-actions">
            <button class="action-btn" on:click={() => openEdit(score)} aria-label="Edit score">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn danger" on:click={() => promptDeleteScore(score)} aria-label="Delete score">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 80px; max-width: 640px; margin: 0 auto; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); }

  .header-row {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
  }
  .btn-add-score {
    padding: 7px 16px; border-radius: 8px; border: none;
    background: var(--primary); color: var(--bg);
    font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: opacity 120ms ease;
  }
  .btn-add-score:hover { opacity: 0.85; }

  .tab-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 14px; }
  .tab-btn {
    padding: 5px 14px; border-radius: 999px; border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: all 120ms ease;
  }
  .tab-btn.active {
    background: var(--tab-color, var(--primary));
    color: #fff; /* stylelint-disable-line declaration-property-value-disallowed-list */
    border-color: var(--tab-color, var(--primary));
  }
  .tab-btn:first-child.active {
    background: var(--primary); color: var(--bg); border-color: var(--primary);
  }

  .score-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .score-item {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    transition: background 120ms ease; position: relative;
  }
  .score-item:hover { background: var(--bg3); }

  .score-left { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; }
  .subj-chip {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; flex-shrink: 0;
  }
  .score-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .subj-name { font-size: 13px; font-weight: 600; color: var(--text); }
  .score-date { font-size: 11px; color: var(--muted); }
  .score-notes { font-size: 11px; color: var(--muted); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .score-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
  .score-display { display: flex; flex-direction: column; align-items: flex-end; }
  .score-fraction { font-size: 15px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
  .score-pct { font-size: 11px; font-weight: 600; }

  .trend-bar-track { display: flex; align-items: flex-end; gap: 2px; height: 20px; width: 48px; }
  .trend-bar-seg { flex: 1; border-radius: 2px 2px 0 0; min-height: 2px; opacity: 0.7; }

  .item-actions {
    display: flex; flex-direction: column; gap: 4px;
    opacity: 0; transition: opacity 120ms ease;
  }
  .score-item:hover .item-actions { opacity: 1; }
  .action-btn {
    background: none; border: none; cursor: pointer; padding: 3px;
    color: var(--muted); line-height: 0; border-radius: 4px;
    transition: color 100ms ease, background 100ms ease;
  }
  .action-btn:hover { color: var(--text); background: var(--bg3); }
  .action-btn.danger:hover { color: var(--danger); }

  .empty { text-align: center; color: var(--muted); font-size: 14px; padding: 48px 0; }

  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); }
</style>
