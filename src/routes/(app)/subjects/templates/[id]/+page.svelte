<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES } from '$lib/constants';
  import { newId } from '$lib/id';
  import { subjectsRepo, topicsRepo } from '$lib/data/entities';
  import { t } from '$lib/i18n';
  import type { Subject, Topic } from '$lib/types';

  onMount(() => loadData($auth));

  $: templateId = $page.params.id;
  $: allTemplates = [...BUILTIN_TEMPLATES, ...$templates];
  $: template = allTemplates.find(t => t.id === templateId);
  $: existingNames = new Set($subjects.map(s => s.name.toLowerCase()));

  let checked: Set<string> = new Set();
  let initializedFor = '';

  $: if (template && template.id !== initializedFor) {
    initializedFor = template.id; // eslint-disable-line no-useless-assignment
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
    const { userId } = getAuthContext();
    const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
    const toAdd = template.presets.filter(p => checked.has(p.name) && !existingNames.has(p.name.toLowerCase()));

    const newSubjects: Subject[] = toAdd.map((p, i) => ({
      id: newId(),
      userId,
      name: p.name,
      symbol: p.symbol,
      color: p.color,
      colorRgb: p.colorRgb,
      orderIndex: maxOrder + 1 + i,
    }));
    await Promise.all(newSubjects.map(s => subjectsRepo.save(s)));

    for (let i = 0; i < toAdd.length; i++) {
      const preset = toAdd[i];
      const subject = newSubjects[i];
      const topicNames = preset.topics ?? [];
      for (let j = 0; j < topicNames.length; j++) {
        const topic: Topic = {
          id: newId(),
          subjectId: subject.id,
          name: topicNames[j],
          orderIndex: j,
        };
        await topicsRepo.create(topic);
      }
    }

    goto('/subjects');
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects/templates')} aria-label={$t.common.back}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">{template?.name ?? '…'}</h1>
  </div>

  {#if !template}
    <p class="text-body text-muted">{$t.subjects.templateNotFound}</p>
  {:else}
    <p class="hint">{$t.subjects.selectHint}</p>

    <ul class="preset-list stagger-children">
      {#each template.presets as preset}
        {@const alreadyAdded = existingNames.has(preset.name.toLowerCase())}
        {@const topicNames = preset.topics ?? []}
        <li>
          <button
            class="preset-row card"
            class:already={alreadyAdded}
            class:selected={checked.has(preset.name)}
            on:click={() => toggle(preset.name)}
            disabled={alreadyAdded}
          >
            <span class="preset-chip" style="background:{preset.color}24; background:color-mix(in srgb, {preset.color} 14%, transparent); color:{preset.color}">{preset.symbol}</span>
            <span class="preset-body">
              <span class="preset-name">{preset.name}</span>
              {#if topicNames.length > 0}
                <span class="preset-topics">{topicNames.slice(0, 3).join(' · ')}{topicNames.length > 3 ? ` +${topicNames.length - 3}` : ''}</span>
              {/if}
            </span>
            {#if alreadyAdded}
              <span class="already-label">{$t.subjects.alreadyAdded}</span>
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
        {$t.subjects.addSelected(selectedCount)}
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
    display: flex; align-items: center; gap: 12px; padding: 11px 14px;
    width: 100%; text-align: left; cursor: pointer;
    /* Explicit flat border — without this the <button> inherits the UA
       1.6px "outset" bevel, which the selected accent tinted into a heavy
       dark outline. */
    border: 1px solid transparent;
    transition: background 140ms ease, border-color 160ms ease, transform var(--dur-base) var(--ease-spring);
  }
  .preset-row:hover:not(:disabled) { background: var(--bg3); transform: scale(1.01); }
  .preset-row:active:not(:disabled) { transform: scale(0.985); transition-duration: var(--dur-fast); }
  .preset-row.selected { border-color: color-mix(in srgb, var(--primary) 35%, var(--border)); background: color-mix(in srgb, var(--primary) 5%, var(--bg2)); }
  .preset-row.already { opacity: 0.5; cursor: default; }
  .preset-chip {
    width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800;
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .preset-row:hover:not(:disabled) .preset-chip { transform: scale(1.08) rotate(-3deg); }
  .preset-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .preset-name { font-size: 15px; font-weight: 500; color: var(--text); }
  .preset-topics { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .already-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .check-circle { flex-shrink: 0; line-height: 0; transition: transform var(--dur-base) var(--ease-spring); }
  .check-circle.checked { transform: scale(1.15); }

  .sticky-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 12px 16px 32px;
    background: var(--bg3);
    background: color-mix(in srgb, var(--bg2) 72%, transparent);
    backdrop-filter: blur(20px) saturate(1.5);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    border-top: 1px solid var(--border);
    border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
    z-index: 100;
  }
  .btn-add {
    display: block; width: 100%; max-width: 600px; margin: 0 auto;
    padding: 14px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
