<script lang="ts">
  import { slide } from 'svelte/transition';
  import { settings } from '$lib/stores/settings';
  import { t } from '$lib/i18n';
  import { GUIDE } from '$lib/guide';

  $: lang = $settings.lang;
  // First section open by default; the rest collapsed.
  let open: Record<string, boolean> = { [GUIDE[0].id]: true };

  function toggle(id: string) {
    open = { ...open, [id]: !open[id] };
  }
</script>

<div class="page">
  <h1 class="text-large-title page-title">{$t.guide.title}</h1>
  <p class="subtitle">{$t.guide.subtitle}</p>

  <div class="sections">
    {#each GUIDE as section (section.id)}
      <div class="card section">
        <button class="section-head" on:click={() => toggle(section.id)} aria-expanded={!!open[section.id]}>
          <span class="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={section.icon} />
            </svg>
          </span>
          <span class="section-title">{lang === 'th' ? section.title.th : section.title.en}</span>
          <svg class="chev" class:open={open[section.id]} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {#if open[section.id]}
          <ul class="body" transition:slide={{ duration: 220 }}>
            {#each section.body as line}
              <li>{lang === 'th' ? line.th : line.en}</li>
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
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding: 16px; background: none; border: none; cursor: pointer;
    font-family: inherit; color: var(--text); text-align: left;
  }
  .icon {
    flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary);
  }
  .section-title { flex: 1; font-size: 15px; font-weight: 600; }
  .chev { color: var(--muted); transition: transform 200ms var(--ease-out, ease); flex-shrink: 0; }
  .chev.open { transform: rotate(180deg); }
  .body {
    list-style: none; padding: 0 16px 16px 62px; margin: 0;
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
  @media (max-width: 768px) {
    .section-head { min-height: 44px; }
  }
</style>
