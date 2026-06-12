<script lang="ts">
  import { t } from '$lib/i18n';
  import type { I18n } from '$lib/i18n/en';
  export let open = false;
  export let onClose: () => void = () => {};

  type NavKey = keyof I18n['nav'];
  const items: { key: NavKey; href: string }[] = [
    { key: 'tasks',    href: '/tasks' },
    { key: 'schedule', href: '/schedule' },
    { key: 'scores',   href: '/scores' },
    { key: 'exam',     href: '/exam' },
    { key: 'flashcards', href: '/flashcards' },
    { key: 'insights', href: '/insights' },
    { key: 'journey',  href: '/journey' },
    { key: 'settings', href: '/settings' },
  ];
</script>

{#if open}
  <button class="backdrop" on:click={onClose} aria-label={$t.common.close}></button>
  <div class="drawer glass-panel" role="dialog">
    <div class="drawer-header">
      <span style="font-size:17px;font-weight:700">{$t.nav.more}</span>
      <button class="close-btn" on:click={onClose} aria-label={$t.common.close}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <nav>
      {#each items as item}
        <a href={item.href} class="drawer-item" on:click={onClose}>{$t.nav[item.key]}</a>
      {/each}
    </nav>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; border: none; cursor: pointer; }
  .drawer {
    position: fixed; top: 0; left: 0; bottom: 0; width: 80%; max-width: 320px;
    /* right edge only — the other three sides sit at the viewport edge */
    border: none;
    border-right: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
    border-radius: 0;
    z-index: 201; padding: 20px 16px; display: flex; flex-direction: column; gap: 8px; animation: slideIn 200ms ease-out;
  }
  @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
  .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .close-btn { background: none; border: none; cursor: pointer; color: var(--muted); }
  .drawer-item { display: block; padding: 13px 10px; border-radius: 10px; text-decoration: none; color: var(--text); font-size: 15px; font-weight: 500; transition: background 140ms ease; }
  .drawer-item:hover { background: var(--bg3); }
</style>
