<script lang="ts">
  import { page } from '$app/stores';
  export let onMore: () => void = () => {};

  const tabs = [
    { label: 'Home',     href: '/dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22v-10h6v10' },
    { label: 'Timer',    href: '/timer',     d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 6v6l4 2' },
    { label: 'Subjects', href: '/subjects',  d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    { label: 'Stats',    href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
    { label: 'More',     href: '#more',      d: 'M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M19 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M5 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0' },
  ];
  $: path = $page.url.pathname;
</script>

<nav class="tab-bar">
  {#each tabs as tab}
    {#if tab.href === '#more'}
      <button class="tab-item" on:click={onMore} aria-label="More">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="{tab.d}" /></svg>
        <span class="tab-label">{tab.label}</span>
      </button>
    {:else}
      <a href={tab.href} class="tab-item" class:active={path.startsWith(tab.href)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="{tab.d}" /></svg>
        <span class="tab-label">{tab.label}</span>
      </a>
    {/if}
  {/each}
</nav>

<style>
  .tab-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    height: var(--tab-bar-height);
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(249,249,249,.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-around;
    z-index: 100;
  }
  :global(body.theme-dark) .tab-bar { background: rgba(28,28,30,.95); }
  .tab-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 12px; border-radius: 10px;
    border: none; background: transparent; color: var(--muted);
    text-decoration: none; cursor: pointer; font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 140ms ease;
  }
  .tab-item:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .tab-item.active { color: var(--primary); opacity: 1; }
  .tab-label { font-size: 9px; font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .tab-item, .tab-item:active { transition: none; transform: none; } }
</style>
