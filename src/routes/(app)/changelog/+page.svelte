<script lang="ts">
  import { slide } from 'svelte/transition';
  import { settings } from '$lib/stores/settings';
  import { t, fmt } from '$lib/i18n';
  import { CHANGELOG } from '$lib/changelog';

  $: lang = $settings.lang;
  // Newest version open by default; older ones collapsed.
  let open: Record<string, boolean> = { [CHANGELOG[0].version]: true };

  function toggle(version: string) {
    open = { ...open, [version]: !open[version] };
  }
</script>

<div class="page">
  <h1 class="text-large-title page-title">{$t.changelog.title}</h1>
  <p class="subtitle">{$t.changelog.subtitle}</p>

  <div class="sections">
    {#each CHANGELOG as entry (entry.version)}
      <div class="card section">
        <button class="section-head" on:click={() => toggle(entry.version)} aria-expanded={!!open[entry.version]}>
          <span class="ver">v{entry.version}</span>
          <span class="section-title">{lang === 'th' ? entry.title.th : entry.title.en}</span>
          <span class="date">{$fmt.date(entry.date + 'T00:00:00', { month: 'short', day: 'numeric' })}</span>
          <svg class="chev" class:open={open[entry.version]} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {#if open[entry.version]}
          <ul class="body" transition:slide={{ duration: 220 }}>
            {#each entry.items as item}
              <li>{lang === 'th' ? item.th : item.en}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .page { max-width: 640px; margin: 0 auto; }
  .page-title { margin-bottom: 2px; }
  .subtitle { font-size: 14px; color: var(--muted); margin-bottom: 20px; }
  .sections { display: flex; flex-direction: column; gap: 10px; }
  .section { overflow: hidden; }
  .section-head {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 16px; background: none; border: none; cursor: pointer;
    font-family: inherit; color: var(--text); text-align: left;
  }
  .ver {
    flex-shrink: 0; padding: 2px 8px; border-radius: 999px;
    background: var(--primary-l); color: var(--primary);
    font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .section-title { flex: 1; font-size: 15px; font-weight: 600; }
  .date { flex-shrink: 0; font-size: 12px; color: var(--muted); }
  .chev { color: var(--muted); transition: transform 200ms var(--ease-out, ease); flex-shrink: 0; }
  .chev.open { transform: rotate(180deg); }
  .body {
    list-style: none; padding: 0 16px 16px 18px; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .body li {
    position: relative; font-size: 14px; line-height: 1.5; color: var(--muted);
    padding-left: 16px;
  }
  .body li::before {
    content: ''; position: absolute; left: 0; top: 9px;
    width: 5px; height: 5px; border-radius: 50%; background: var(--primary);
  }
  @media (max-width: 768px) { .section-head { min-height: 44px; } }
</style>
