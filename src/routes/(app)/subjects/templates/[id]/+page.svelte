<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Subject } from '$lib/types';

  onMount(() => loadData($auth));

  $: templateId = $page.params.id;
  $: allTemplates = [...BUILTIN_TEMPLATES, ...$templates];
  $: template = allTemplates.find(t => t.id === templateId);
  $: existingNames = new Set($subjects.map(s => s.name.toLowerCase()));

  let checked: Set<string> = new Set();
  let initializedFor = '';

  $: if (template && template.id !== initializedFor) {
    initializedFor = template.id;
    checked = new Set(
      template.presets
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .map(p => p.name)
    );
  }

  $: selectedCount = checked.size;

  function toggle(name: string) {
    if (existingNames.has(name.toLowerCase())) return;
    const next = new Set(checked);
    if (next.has(name)) next.delete(name); else next.add(name);
    checked = next;
  }

  async function addSelected() {
    if (!template || selectedCount === 0) return;
    const { userId, mode } = getAuthContext();
    const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
    const toAdd = template.presets.filter(p => checked.has(p.name) && !existingNames.has(p.name.toLowerCase()));
    const newSubjects: Subject[] = toAdd.map((p, i) => ({
      id: db.newId(),
      userId,
      name: p.name,
      symbol: p.symbol,
      color: p.color,
      colorRgb: p.colorRgb,
      orderIndex: maxOrder + 1 + i,
    }));
    subjects.update(all => [...all, ...newSubjects]);
    await Promise.all(newSubjects.map(s => db.saveSubject(s, mode)));
    goto('/subjects');
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects/templates')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">{template?.name ?? '…'}</h1>
  </div>

  {#if !template}
    <p class="text-body text-muted">Template not found.</p>
  {:else}
    <p class="hint">Select subjects to add to your list. Already-added subjects are greyed out.</p>

    <ul class="preset-list">
      {#each template.presets as preset}
        {@const alreadyAdded = existingNames.has(preset.name.toLowerCase())}
        <li>
          <button
            class="preset-row card"
            class:already={alreadyAdded}
            on:click={() => toggle(preset.name)}
            disabled={alreadyAdded}
          >
            <span class="preset-symbol" style="color:{preset.color}">{preset.symbol}</span>
            <span class="preset-name">{preset.name}</span>
            {#if alreadyAdded}
              <span class="already-label">Added</span>
            {:else}
              <span class="check-circle" class:checked={checked.has(preset.name)}>
                {#if checked.has(preset.name)}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="var(--primary)" stroke="var(--primary)" stroke-width="1.5"/>
                    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="var(--border)" stroke-width="1.5"/>
                  </svg>
                {/if}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    <div class="sticky-footer">
      <button class="btn-add" on:click={addSelected} disabled={selectedCount === 0}>
        Add {selectedCount > 0 ? selectedCount : ''} subject{selectedCount !== 1 ? 's' : ''}
      </button>
    </div>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 120px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .back-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0; line-height: 0; }
  .hint { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
  .preset-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .preset-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    width: 100%; text-align: left; cursor: pointer;
    transition: background 120ms ease;
  }
  .preset-row:hover:not(:disabled) { background: var(--bg3); }
  .preset-row.already { opacity: 0.5; cursor: default; }
  .preset-symbol { font-size: 15px; font-weight: 700; width: 28px; flex-shrink: 0; }
  .preset-name { flex: 1; font-size: 15px; font-weight: 500; color: var(--text); }
  .already-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .check-circle { flex-shrink: 0; line-height: 0; }

  .sticky-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 12px 16px 32px; background: var(--bg2);
    border-top: 1px solid var(--border); z-index: 100;
  }
  .btn-add {
    display: block; width: 100%; max-width: 600px; margin: 0 auto;
    padding: 14px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
