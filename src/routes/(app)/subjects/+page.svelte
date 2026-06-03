<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, dueCards, loadData, getAuthContext } from '$lib/stores/data';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import SubjectEditSheet from '$lib/components/subjects/SubjectEditSheet.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { templatesRepo, subjectsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import type { Subject, Template, SubjectPreset } from '$lib/types';

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  $: dueBySubject = (subjectId: string) => {
    const subjectTopicIds = new Set($topics.filter((t) => t.subjectId === subjectId).map((t) => t.id));
    return $dueCards.filter((c) => subjectTopicIds.has(c.topicId)).length;
  };

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

  async function saveCurrentAsTemplate() {
    const name = prompt('Template name:');
    if (!name?.trim()) return;
    const { userId } = getAuthContext();
    const presets: SubjectPreset[] = $subjects.map((sub) => ({
      name: sub.name,
      symbol: sub.symbol,
      color: sub.color,
      colorRgb: sub.colorRgb,
      topics: $topics.filter((t) => t.subjectId === sub.id).map((t) => t.name),
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
    <h1 class="text-large-title">Subjects</h1>
    <div class="header-actions">
      <a href="/subjects/templates" class="templates-link">Templates</a>
      {#if $subjects.length > 0}
        <button class="overflow-btn" on:click={() => (overflowOpen = true)} aria-label="More options">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      {/if}
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
      saveCurrentAsTemplate();
    }}
  >
    Save current subjects as template
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

  .overflow-action {
    width: 100%; text-align: left; padding: 14px 8px; border: none; background: none;
    color: var(--text); font-family: inherit; font-size: 15px; font-weight: 500; cursor: pointer;
    border-radius: var(--radius-md);
  }
  .overflow-action:hover { background: var(--bg3); }

  @media (max-width: 768px) {
    .add-btn { width: 44px; height: 44px; }
    .overflow-btn { width: 44px; height: 44px; }
    .templates-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; }
  }
</style>
