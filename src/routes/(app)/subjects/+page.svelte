<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, dueDecks, loadData, getAuthContext } from '$lib/stores/data';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import SubjectEditSheet from '$lib/components/subjects/SubjectEditSheet.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { templatesRepo, subjectsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import type { Subject, Template, SubjectPreset } from '$lib/types';
  import { t } from '$lib/i18n';

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  $: dueBySubject = (subjectId: string) =>
    $dueDecks.filter((tp) => tp.subjectId === subjectId).length;

  // add flow (edit now lives on the subject detail page)
  let editOpen = false;

  function openAdd() {
    editOpen = true;
  }

  async function handleSave(e: CustomEvent<{ name: string; symbol: string; color: string; colorRgb: string }>) {
    const f = e.detail;
    const { userId } = getAuthContext();
    const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
    const subject: Subject = {
      id: newId(),
      userId,
      name: f.name,
      symbol: f.symbol,
      color: f.color,
      colorRgb: f.colorRgb,
      orderIndex: maxOrder + 1,
    };
    await subjectsRepo.save(subject);
  }

  // overflow menu → save current subjects as a template
  let overflowOpen = false;
  let templateNameOpen = false;
  let templateName = '';

  async function saveCurrentAsTemplate() {
    const name = templateName;
    templateNameOpen = false;
    templateName = '';
    if (!name?.trim()) return;
    const { userId } = getAuthContext();
    const presets: SubjectPreset[] = $subjects.map((sub) => ({
      name: sub.name,
      symbol: sub.symbol,
      color: sub.color,
      colorRgb: sub.colorRgb,
      topics: $topics.filter((tp) => tp.subjectId === sub.id).map((tp) => tp.name),
    }));
    const template: Template = {
      id: newId(),
      userId,
      name: name.trim(),
      presets,
      createdAt: new Date().toISOString(),
    };
    await templatesRepo.save(template);
  }
</script>

<div class="page">
  <div class="header-row">
    <h1 class="text-large-title">{$t.subjects.title}</h1>
    <div class="header-actions">
      <a href="/subjects/templates" class="templates-link">{$t.subjects.templates}</a>
      {#if $subjects.length > 0}
        <button class="overflow-btn" on:click={() => (overflowOpen = true)} aria-label={$t.subjects.moreOptions}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      {/if}
      <button class="add-btn" on:click={openAdd} aria-label={$t.subjects.addSubject}>+</button>
    </div>
  </div>

  {#if $subjects.length === 0}
    <EmptyState icon="book" title={$t.subjects.emptyTitle}>
      <a href="/subjects/templates" class="empty-action">{$t.subjects.browseTemplates} →</a>
    </EmptyState>
  {:else}
    <div class="subjects-grid stagger-children">
      {#each $subjects as subject (subject.id)}
        <div class="tile-wrapper">
          <SubjectTile
            {subject}
            topics={$topics}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
          {#if dueBySubject(subject.id) > 0}
            <div class="due-badge" style="background: {subject.color};">
              {dueBySubject(subject.id)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<SubjectEditSheet bind:open={editOpen} subject={null} on:save={handleSave} />

<BottomSheet open={overflowOpen} on:close={() => (overflowOpen = false)}>
  <button
    class="overflow-action"
    on:click={() => {
      overflowOpen = false;
      templateNameOpen = true;
    }}
  >
    {$t.subjects.saveAsTemplate}
  </button>
</BottomSheet>

<BottomSheet open={templateNameOpen} on:close={() => (templateNameOpen = false)}>
  <p class="tpl-sheet-title">{$t.subjects.saveAsTemplate}</p>
  <input
    class="tpl-name-input"
    bind:value={templateName}
    placeholder={$t.subjects.templateNamePlaceholder}
    on:keydown={(e) => { if (e.key === 'Enter' && templateName.trim()) saveCurrentAsTemplate(); }}
  />
  <button class="tpl-save-btn" disabled={!templateName.trim()} on:click={saveCurrentAsTemplate}>
    {$t.common.save}
  </button>
</BottomSheet>

<style>
  .page { padding: 24px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .templates-link { font-size: 14px; font-weight: 600; color: var(--primary); text-decoration: none; }
  .overflow-btn {
    width: 32px; height: 32px; border-radius: 8px; border: none;
    background: none; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .overflow-btn:hover { background: var(--bg3); color: var(--text); }
  .add-btn {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: var(--primary); color: var(--bg);
    font-size: 20px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }

  .subjects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }

  .tile-wrapper { position: relative; }
  .due-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    color: var(--bg); font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px; pointer-events: none;
  }

  .overflow-action {
    width: 100%; text-align: left; padding: 14px 8px; border: none; background: none;
    color: var(--text); font-family: inherit; font-size: 15px; font-weight: 500; cursor: pointer;
    border-radius: var(--radius-md);
  }
  .overflow-action:hover { background: var(--bg3); }

  .tpl-sheet-title { font-size: 16px; font-weight: 700; color: var(--text); margin: 4px 8px 12px; }
  .tpl-name-input {
    width: 100%; box-sizing: border-box; padding: 11px 13px; margin-bottom: 12px;
    border: 1.5px solid var(--border); border-radius: 12px;
    background: var(--bg3); color: var(--text);
    background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .tpl-name-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15); }
  .tpl-save-btn {
    width: 100%; padding: 11px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .tpl-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (max-width: 768px) {
    .add-btn { width: 44px; height: 44px; }
    .overflow-btn { width: 44px; height: 44px; }
    .templates-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; }
  }
</style>
