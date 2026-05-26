<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES, SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Template, SubjectPreset } from '$lib/types';

  onMount(() => loadData($auth));

  let creating = false;
  let newName = '';
  let newPresets: SubjectPreset[] = [];
  let newSubjectName = '';

  function addPresetRow() {
    const name = newSubjectName.trim();
    if (!name) return;
    const color = SUBJECT_COLOR_PALETTE[newPresets.length % SUBJECT_COLOR_PALETTE.length];
    newPresets = [...newPresets, { name, symbol: name.replace(/\s+/g, '').slice(0, 2), color: color.hex, colorRgb: color.rgb }];
    newSubjectName = '';
  }

  function removePreset(i: number) {
    newPresets = newPresets.filter((_, idx) => idx !== i);
  }

  function handlePresetKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addPresetRow(); }
  }

  async function saveTemplate() {
    if (!newName.trim() || newPresets.length === 0) return;
    const { userId, mode } = getAuthContext();
    const template: Template = {
      id: db.newId(),
      userId,
      name: newName.trim(),
      presets: newPresets,
      createdAt: new Date().toISOString(),
    };
    templates.update(all => [...all, template]);
    await db.saveTemplate(template, mode);
    creating = false;
    newName = '';
    newPresets = [];
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    const { mode } = getAuthContext();
    templates.update(all => all.filter(t => t.id !== template.id));
    await db.deleteTemplate(template.id, mode);
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">Templates</h1>
  </div>

  <p class="section-label">BUILT-IN</p>
  <div class="template-list">
    {#each BUILTIN_TEMPLATES as t}
      <a href="/subjects/templates/{t.id}" class="template-row card">
        <div class="template-info">
          <span class="template-name">{t.name}</span>
          <span class="template-count">{t.presets.length} subjects</span>
        </div>
        <div class="preview-dots">
          {#each t.presets.slice(0, 5) as p}
            <span class="dot" style="background:{p.color}"></span>
          {/each}
          {#if t.presets.length > 5}
            <span class="dot-more">+{t.presets.length - 5}</span>
          {/if}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </a>
    {/each}
  </div>

  {#if $templates.length > 0}
    <p class="section-label" style="margin-top:20px">CUSTOM</p>
    <div class="template-list">
      {#each $templates as t}
        <div class="template-row card custom-row">
          <a href="/subjects/templates/{t.id}" class="template-link">
            <div class="template-info">
              <span class="template-name">{t.name}</span>
              <span class="template-count">{t.presets.length} subjects</span>
            </div>
          </a>
          <button class="delete-tpl-btn" on:click={() => deleteTemplate(t)} aria-label="Delete template">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if creating}
    <div class="create-form card" style="margin-top:20px">
      <p class="sheet-title">New Template</p>
      <div class="field">
        <label class="field-label">Template name</label>
        <input class="field-input" bind:value={newName} placeholder="e.g. International Bac" />
      </div>
      <div class="field">
        <label class="field-label">Subjects</label>
        <div class="preset-list">
          {#each newPresets as preset, i}
            <div class="preset-row">
              <span class="preset-dot" style="background:{preset.color}"></span>
              <span class="preset-name">{preset.name}</span>
              <button class="remove-preset" on:click={() => removePreset(i)} aria-label="Remove">×</button>
            </div>
          {/each}
        </div>
        <div class="add-preset-row">
          <input
            class="field-input preset-input"
            bind:value={newSubjectName}
            placeholder="Subject name…"
            on:keydown={handlePresetKeydown}
          />
          <button class="add-preset-btn" on:click={addPresetRow} disabled={!newSubjectName.trim()}>Add</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" on:click={() => { creating = false; newName = ''; newPresets = []; }}>Cancel</button>
        <button class="btn-save" on:click={saveTemplate} disabled={!newName.trim() || newPresets.length === 0}>Save</button>
      </div>
    </div>
  {:else}
    <button class="new-tpl-btn" on:click={() => creating = true} style="margin-top:20px">
      + New template
    </button>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0; line-height: 0; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
  .template-list { display: flex; flex-direction: column; gap: 8px; }
  .template-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    text-decoration: none; color: var(--text);
  }
  .template-info { flex: 1; }
  .template-name { font-size: 15px; font-weight: 600; display: block; }
  .template-count { font-size: 12px; color: var(--muted); }
  .preview-dots { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-more { font-size: 11px; color: var(--muted); }
  .chevron { color: var(--muted); flex-shrink: 0; }
  .custom-row { padding: 0; }
  .template-link { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 0 14px 16px; text-decoration: none; color: var(--text); }
  .delete-tpl-btn { background: none; border: none; cursor: pointer; color: var(--muted); padding: 14px 16px; }

  .create-form { padding: 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .field { margin-bottom: 14px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid var(--border);
    border-radius: var(--radius-md); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--primary); }
  .preset-list { margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
  .preset-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--bg3); border-radius: 8px; }
  .preset-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .preset-name { flex: 1; font-size: 14px; }
  .remove-preset { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 18px; line-height: 1; padding: 0 4px; }
  .add-preset-row { display: flex; gap: 8px; }
  .preset-input { flex: 1; }
  .add-preset-btn {
    padding: 10px 16px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
  }
  .add-preset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .btn-cancel {
    flex: 1; padding: 10px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 10px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  .new-tpl-btn {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 16px;
    border: 1.5px dashed var(--border); border-radius: var(--radius-md);
    background: none; color: var(--muted); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: border-color 120ms ease, color 120ms ease;
  }
  .new-tpl-btn:hover { border-color: var(--primary); color: var(--text); }
</style>
