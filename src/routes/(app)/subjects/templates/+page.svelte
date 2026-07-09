<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES, SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import { templatesRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import type { Template, SubjectPreset } from '$lib/types';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ImportSheet from '$lib/components/ImportSheet.svelte';
  import { parseTemplate, templatePrompt, type SubjectPresetDraft } from '$lib/import';
  import { toast } from '$lib/stores/toast';
  import { get } from 'svelte/store';
  import { t } from '$lib/i18n';

  onMount(() => loadData($auth));

  let creating = false;
  let newName = '';
  let newPresets: SubjectPreset[] = [];
  let newSubjectName = '';

  // ── AI / JSON import (same pattern as flashcard & exam import) ──
  let importOpen = false;
  let importGoal = 'TCAS';
  let importCount = 6;
  let importLanguage = '';
  let importFocus = '';
  $: importPrompt = templatePrompt(importGoal, importCount, importLanguage || undefined, importFocus.trim() || undefined);

  function handleTemplateImport(e: CustomEvent<{ items: unknown[] }>) {
    const drafts = e.detail.items as SubjectPresetDraft[];
    const base = newPresets.length;
    const added: SubjectPreset[] = drafts.map((d, i) => {
      const color = SUBJECT_COLOR_PALETTE[(base + i) % SUBJECT_COLOR_PALETTE.length];
      return {
        name: d.name,
        symbol: d.symbol || d.name.replace(/\s+/g, '').slice(0, 2),
        color: color.hex,
        colorRgb: color.rgb,
        topics: d.topics,
      };
    });
    newPresets = [...newPresets, ...added];
    if (!newName.trim()) newName = importGoal.trim();
    creating = true;
    importOpen = false;
    toast.success(get(t).importer.importedToast(added.length));
  }

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

  let topicInputs: string[] = [];
  $: if (topicInputs.length !== newPresets.length) {
    topicInputs = newPresets.map((_, i) => topicInputs[i] ?? '');
  }

  function addTopic(presetIdx: number, name: string) {
    if (!name.trim()) return;
    newPresets = newPresets.map((p, i) =>
      i !== presetIdx ? p : { ...p, topics: [...(p.topics ?? []), name.trim()] }
    );
  }

  function removeTopic(presetIdx: number, topicIdx: number) {
    newPresets = newPresets.map((p, i) =>
      i !== presetIdx ? p : { ...p, topics: (p.topics ?? []).filter((_, ti) => ti !== topicIdx) }
    );
  }

  async function saveTemplate() {
    if (!newName.trim() || newPresets.length === 0) return;
    const { userId } = getAuthContext();
    const template: Template = {
      id: newId(),
      userId,
      name: newName.trim(),
      presets: newPresets,
      createdAt: new Date().toISOString(),
    };
    await templatesRepo.save(template);
    creating = false;
    newName = '';
    newPresets = [];
  }

  let templateConfirmOpen = false;
  let pendingDeleteTemplate: Template | null = null;

  function promptDeleteTemplate(template: Template) {
    pendingDeleteTemplate = template;
    templateConfirmOpen = true;
  }

  async function doDeleteTemplate() {
    if (!pendingDeleteTemplate) return;
    const template = pendingDeleteTemplate;
    pendingDeleteTemplate = null;
    await templatesRepo.remove(template.id);
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects')} aria-label={$t.common.back}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">{$t.subjects.templates}</h1>
  </div>

  <p class="section-label">{$t.subjects.builtIn}</p>
  <div class="template-list">
    {#each BUILTIN_TEMPLATES as tp}
      <a href="/subjects/templates/{tp.id}" class="template-row card">
        <div class="template-info">
          <span class="template-name">{tp.name}</span>
          <span class="template-count">{$t.subjects.subjectsCount(tp.presets.length)}</span>
        </div>
        <div class="preview-dots">
          {#each tp.presets.slice(0, 5) as p}
            <span class="dot" style="background:{p.color}"></span>
          {/each}
          {#if tp.presets.length > 5}
            <span class="dot-more">+{tp.presets.length - 5}</span>
          {/if}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </a>
    {/each}
  </div>

  {#if $templates.length > 0}
    <p class="section-label" style="margin-top:20px">{$t.subjects.custom}</p>
    <div class="template-list">
      {#each $templates as tp}
        <div class="template-row card custom-row">
          <a href="/subjects/templates/{tp.id}" class="template-link">
            <div class="template-info">
              <span class="template-name">{tp.name}</span>
              <span class="template-count">{$t.subjects.subjectsCount(tp.presets.length)}</span>
            </div>
          </a>
          <button class="delete-tpl-btn" on:click={() => promptDeleteTemplate(tp)} aria-label={$t.subjects.deleteTemplateLabel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <ConfirmDialog
    bind:open={templateConfirmOpen}
    title={$t.subjects.deleteTemplateTitle}
    message={$t.common.cannotUndo}
    on:confirm={doDeleteTemplate}
  />

  {#if creating}
    <div class="create-form card" style="margin-top:20px">
      <p class="sheet-title">{$t.subjects.newTemplate}</p>
      <div class="field">
        <label class="field-label" for="tpl-name">{$t.subjects.templateName}</label>
        <input id="tpl-name" class="field-input" bind:value={newName} placeholder={$t.subjects.templateNamePlaceholder} />
      </div>
      <div class="field">
        <span class="field-label">{$t.subjects.title}</span>
        <div class="preset-list">
          {#each newPresets as preset, i}
            <div class="preset-row">
              <span class="preset-dot" style="background:{preset.color}"></span>
              <span class="preset-name">{preset.name}</span>
              <button class="remove-preset" on:click={() => removePreset(i)} aria-label={$t.common.remove}>×</button>
            </div>
            {#if preset.topics && preset.topics.length > 0}
              <div class="topic-chips">
                {#each preset.topics as topic, ti}
                  <span class="topic-chip">
                    {topic}
                    <button class="chip-remove" on:click={() => removeTopic(i, ti)}>×</button>
                  </span>
                {/each}
              </div>
            {/if}
            <div class="topic-input-row">
              <input
                class="topic-input"
                placeholder={$t.subjects.addTopicPlaceholder}
                bind:value={topicInputs[i]}
                on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(i, topicInputs[i]); topicInputs[i] = ''; } }}
              />
              <button class="add-topic-btn" on:click={() => { addTopic(i, topicInputs[i]); topicInputs[i] = ''; }}>+</button>
            </div>
          {/each}
        </div>
        <div class="add-preset-row">
          <input
            class="field-input preset-input"
            bind:value={newSubjectName}
            placeholder={$t.subjects.subjectNamePlaceholder}
            on:keydown={handlePresetKeydown}
          />
          <button class="add-preset-btn" on:click={addPresetRow} disabled={!newSubjectName.trim()}>{$t.common.add}</button>
        </div>
        <button class="import-tpl-btn in-form" on:click={() => (importOpen = true)}>✦ {$t.importer.open}</button>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" on:click={() => { creating = false; newName = ''; newPresets = []; }}>{$t.common.cancel}</button>
        <button class="btn-save" on:click={saveTemplate} disabled={!newName.trim() || newPresets.length === 0}>{$t.common.save}</button>
      </div>
    </div>
  {:else}
    <div class="tpl-cta-row" style="margin-top:20px">
      <button class="new-tpl-btn" on:click={() => creating = true}>+ {$t.subjects.newTemplate}</button>
      <button class="import-tpl-btn" on:click={() => (importOpen = true)}>✦ {$t.importer.open}</button>
    </div>
  {/if}
</div>

<ImportSheet bind:open={importOpen} prompt={importPrompt} parse={parseTemplate} on:import={handleTemplateImport} on:close={() => (importOpen = false)}>
  <div slot="options" class="opt-block">
    <label class="opt-label" for="tpl-goal">{$t.importer.goalLabel}</label>
    <input id="tpl-goal" class="goal-input" bind:value={importGoal} placeholder={$t.importer.goalPlaceholder} />
    <div class="opt-row">
      <span class="opt-label">{$t.importer.howMany}</span>
      {#each [4, 6, 8, 10] as n (n)}
        <button class="opt-pill" class:active={importCount === n} on:click={() => (importCount = n)}>{n}</button>
      {/each}
    </div>
    <div class="opt-row">
      <span class="opt-label">{$t.importer.language}</span>
      <button class="opt-pill" class:active={importLanguage === ''} on:click={() => (importLanguage = '')}>{$t.importer.languageAuto}</button>
      <button class="opt-pill" class:active={importLanguage === 'Thai'} on:click={() => (importLanguage = 'Thai')}>{$t.importer.languageThai}</button>
      <button class="opt-pill" class:active={importLanguage === 'English'} on:click={() => (importLanguage = 'English')}>{$t.importer.languageEnglish}</button>
    </div>
    <label class="opt-label" for="tpl-focus">{$t.importer.focus}</label>
    <input id="tpl-focus" class="goal-input" bind:value={importFocus} placeholder={$t.importer.focusPlaceholder} />
  </div>
</ImportSheet>

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0; line-height: 0; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
  .template-list { display: flex; flex-direction: column; gap: 8px; }
  .template-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    text-decoration: none; color: var(--text);
    transition: transform var(--dur-base) var(--ease-spring), border-color 160ms ease, background 160ms ease;
  }
  @media (hover: hover) {
    .template-row:hover {
      transform: translateY(-1px) scale(1.01);
      background: var(--bg3);
      border-color: var(--border);
      border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
    }
    .template-row:hover .chevron { transform: translateX(2px); }
  }
  .template-row:active { transform: scale(0.985); transition-duration: var(--dur-fast); }
  .template-info { flex: 1; }
  .template-name { font-size: 15px; font-weight: 600; display: block; }
  .template-count { font-size: 12px; color: var(--muted); }
  .preview-dots { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-more { font-size: 11px; color: var(--muted); }
  .chevron { color: var(--muted); flex-shrink: 0; transition: transform var(--dur-base) var(--ease-spring); }
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
  .topic-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 2px 16px; }
  .topic-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; color: var(--text); }
  .chip-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
  .chip-remove:hover { color: var(--text); }
  .topic-input-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px 6px 16px; }
  .topic-input { flex: 1; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; color: var(--text); font-family: inherit; outline: none; }
  .topic-input:focus { border-color: var(--primary); }
  .add-topic-btn { font-size: 16px; background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); cursor: pointer; padding: 2px 8px; }
  .add-topic-btn:hover { color: var(--text); background: var(--bg3); }

  .tpl-cta-row { display: flex; gap: 8px; }
  .tpl-cta-row .new-tpl-btn { flex: 1; width: auto; margin: 0; justify-content: center; }
  .import-tpl-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 12px 16px; border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    border: 1.5px solid color-mix(in srgb, var(--primary) 30%, var(--border));
    background: var(--primary-l); color: var(--primary);
    font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .import-tpl-btn:hover { background: color-mix(in srgb, var(--primary) 14%, var(--bg2)); }
  .import-tpl-btn.in-form { width: 100%; margin-top: 10px; }

  .opt-block { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
  .goal-input {
    width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px;
    border: 1.5px solid var(--border); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 14px; outline: none;
  }
  .goal-input:focus { border-color: var(--primary); }
  .opt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .opt-label { font-size: 13px; color: var(--muted); font-weight: 600; }
  .opt-pill {
    padding: 7px 14px; border-radius: 999px; border: 1.5px solid var(--border);
    background: var(--bg); color: var(--muted); font-family: inherit; font-size: 13px;
    font-weight: 600; cursor: pointer; min-height: 36px;
  }
  .opt-pill.active { border-color: var(--primary); background: var(--primary-l); color: var(--primary); }
</style>
