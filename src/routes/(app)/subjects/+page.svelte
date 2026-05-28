<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, dueCards, loadData, getAuthContext } from '$lib/stores/data';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import { db } from '$lib/db';
  import { SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import type { Subject } from '$lib/types';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  $: dueBySubject = (subjectId: string) => {
    const subjectTopicIds = new Set($topics.filter(t => t.subjectId === subjectId).map(t => t.id));
    return $dueCards.filter(c => subjectTopicIds.has(c.topicId)).length;
  };

  let sheetOpen = false;
  let editingSubject: Subject | null = null;
  let sheetName = '';
  let sheetSymbol = '';
  let sheetColor = SUBJECT_COLOR_PALETTE[0];
  let savingSubject = false;

  function openAdd() {
    editingSubject = null;
    sheetName = '';
    sheetSymbol = '';
    sheetColor = SUBJECT_COLOR_PALETTE[0];
    sheetOpen = true;
  }

  function openEdit(subject: Subject) {
    editingSubject = subject;
    sheetName = subject.name;
    sheetSymbol = subject.symbol;
    sheetColor = SUBJECT_COLOR_PALETTE.find(c => c.hex === subject.color) ?? { hex: subject.color, rgb: subject.colorRgb };
    sheetOpen = true;
  }

  function closeSheet() { sheetOpen = false; }

  $: if (sheetName && !editingSubject) {
    sheetSymbol = sheetName.replace(/\s+/g, '').slice(0, 2);
  }

  async function saveSubject() {
    if (savingSubject || !sheetName.trim()) return;
    savingSubject = true;
    try {
      const { userId, mode } = getAuthContext();
      if (editingSubject) {
        const updated: Subject = {
          ...editingSubject,
          name: sheetName.trim(),
          symbol: (sheetSymbol || sheetName.slice(0, 2)).slice(0, 2),
          color: sheetColor.hex,
          colorRgb: sheetColor.rgb,
        };
        subjects.update(all => all.map(s => s.id === updated.id ? updated : s));
        await db.saveSubject(updated, mode);
      } else {
        const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
        const subject: Subject = {
          id: db.newId(),
          userId,
          name: sheetName.trim(),
          symbol: (sheetSymbol || sheetName.slice(0, 2)).slice(0, 2),
          color: sheetColor.hex,
          colorRgb: sheetColor.rgb,
          orderIndex: maxOrder + 1,
        };
        subjects.update(all => [...all, subject]);
        await db.saveSubject(subject, mode);
      }
      closeSheet();
    } finally {
      savingSubject = false;
    }
  }

  let subjectConfirmOpen = false;

  function promptDeleteSubject() {
    if (!editingSubject) return;
    subjectConfirmOpen = true;
  }

  async function doDeleteSubject() {
    if (!editingSubject) return;
    const { mode } = getAuthContext();
    const id = editingSubject.id;
    const removedTopicIds = new Set($topics.filter(t => t.subjectId === id).map(t => t.id));
    subjects.update(all => all.filter(s => s.id !== id));
    topics.update(all => all.filter(t => t.subjectId !== id));
    srsCards.update(all => all.filter(c => !removedTopicIds.has(c.topicId)));
    closeSheet();
    await db.deleteSubject(id, mode);
  }
</script>

<div class="page">
  <div class="header-row">
    <h1 class="text-large-title">Subjects</h1>
    <div class="header-actions">
      <a href="/subjects/templates" class="templates-link">Templates</a>
      <button class="add-btn" on:click={openAdd} aria-label="Add subject">+</button>
    </div>
  </div>

  {#if $subjects.length === 0}
    <div class="empty-state">
      <p class="text-body empty">No subjects yet.</p>
      <a href="/subjects/templates" class="btn-primary-link">Browse templates</a>
    </div>
  {:else}
    <div class="subjects-grid">
      {#each $subjects as subject (subject.id)}
        <div class="tile-wrapper">
          <SubjectTile
            {subject}
            topics={$topics}
            cards={$srsCards}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
          {#if dueBySubject(subject.id) > 0}
            <div class="due-badge" style="background: {subject.color};">
              {dueBySubject(subject.id)}
            </div>
          {/if}
          <button class="edit-btn" on:click|stopPropagation={() => openEdit(subject)} aria-label="Edit subject">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:open={subjectConfirmOpen}
  title="Delete subject?"
  message="All its topics and SRS cards will also be deleted. This cannot be undone."
  on:confirm={doDeleteSubject}
/>

{#if sheetOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="sheet-overlay" on:click={closeSheet} role="presentation"></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <p class="sheet-title">{editingSubject ? 'Edit Subject' : 'New Subject'}</p>

    <div class="field">
      <label class="field-label">Name</label>
      <input class="field-input" bind:value={sheetName} placeholder="e.g. Physics" />
    </div>

    <div class="field">
      <label class="field-label">Symbol <span class="field-hint">(2 chars)</span></label>
      <input class="field-input sym-input" bind:value={sheetSymbol} maxlength="2" placeholder="Ph" />
    </div>

    <div class="field">
      <label class="field-label">Color</label>
      <div class="color-swatches">
        {#each SUBJECT_COLOR_PALETTE as c}
          <button
            class="swatch"
            class:selected={sheetColor.hex === c.hex}
            style="background:{c.hex}"
            on:click={() => sheetColor = c}
            aria-label={c.hex}
          ></button>
        {/each}
      </div>
    </div>

    <div class="sheet-actions">
      {#if editingSubject}
        <button class="btn-delete" on:click={promptDeleteSubject}>Delete</button>
      {/if}
      <button class="btn-cancel" on:click={closeSheet}>Cancel</button>
      <button class="btn-save" on:click={saveSubject} disabled={!sheetName.trim() || savingSubject}>Save</button>
    </div>
  </div>
{/if}

<style>
  .page { padding: 24px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .templates-link { font-size: 14px; font-weight: 600; color: var(--primary); text-decoration: none; }
  .add-btn {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: var(--primary); color: var(--bg);
    font-size: 20px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }

  .empty-state { text-align: center; padding: 48px 0; }
  .empty { color: var(--muted); margin-bottom: 16px; }
  .btn-primary-link {
    display: inline-block; padding: 10px 20px; border-radius: var(--radius-md);
    background: var(--primary); color: var(--bg); font-size: 14px; font-weight: 600;
    text-decoration: none;
  }

  .subjects-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (min-width: 480px) { .subjects-grid { grid-template-columns: repeat(4, 1fr); } }

  .tile-wrapper { position: relative; }
  .due-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    color: var(--bg); font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px; pointer-events: none;
  }
  .edit-btn {
    position: absolute; bottom: -4px; right: -4px;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--bg2); border: 1px solid var(--border);
    color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 120ms ease;
  }
  .tile-wrapper:hover .edit-btn { opacity: 1; }

  /* sheet */
  .sheet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200;
  }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    background: var(--bg2); border-radius: 20px 20px 0 0;
    padding: 12px 20px 40px; max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
  .field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid var(--border);
    border-radius: var(--radius-md); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--primary); }
  .sym-input { width: 72px; text-align: center; font-weight: 700; }
  .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch {
    width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid transparent;
    cursor: pointer; transition: transform 100ms ease;
  }
  .swatch.selected { border-color: var(--text); transform: scale(1.15); }
  .sheet-actions { display: flex; gap: 8px; margin-top: 24px; }
  .btn-delete {
    padding: 10px 16px; border-radius: var(--radius-md); border: none;
    background: var(--danger-soft); color: var(--danger); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-cancel {
    flex: 1; padding: 10px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 10px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
