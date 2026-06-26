<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { t } from '$lib/i18n';
  import type { I18n } from '$lib/i18n/en';
  export let open = false;
  export let onClose: () => void = () => {};

  // Relocate to <body> so the sheet escapes any trapped stacking context and
  // renders above the fixed tab-bar (same reason as BottomSheet/SubjectEditSheet).
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  type NavKey = keyof I18n['nav'];

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) onClose();
  }

  const items: { key: NavKey; href: string; d: string }[] = [
    { key: 'tasks',      href: '/tasks',      d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    { key: 'schedule',   href: '/schedule',   d: 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
    { key: 'scores',     href: '/scores',     d: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6' },
    { key: 'exam',       href: '/exam',       d: 'M9 11l3 3 5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
    { key: 'flashcards', href: '/flashcards', d: 'M3 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 9h6M7 13h4' },
    { key: 'notes',      href: '/notes',      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h6' },
    { key: 'groups',     href: '/groups',     d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { key: 'insights',   href: '/insights',   d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 8v4M12 16h.01' },
    { key: 'journey',    href: '/journey',    d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    { key: 'settings',   href: '/settings',   d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
  ];
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="backdrop" on:click={onClose} role="presentation" transition:fade={{ duration: 180 }}></div>
    <div
      class="sheet glass-panel"
      role="dialog"
      aria-modal="true"
      aria-label={$t.nav.more}
      in:fly={{ y: 320, duration: 380, easing: backOut }}
      out:fly={{ y: 300, duration: 220, easing: cubicOut }}
    >
      <div class="sheet-handle"></div>
      <span class="sheet-title">{$t.nav.more}</span>
      <nav class="grid">
        {#each items as item}
          <a href={item.href} class="tile" on:click={onClose}>
            <span class="tile-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d={item.d} />
              </svg>
            </span>
            <span class="tile-label">{$t.nav[item.key]}</span>
          </a>
        {/each}
      </nav>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 201;
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    border-radius: 20px 20px 0 0;
    padding: 12px 16px calc(20px + env(safe-area-inset-bottom));
    max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 14px; }
  .sheet-title { display: block; font-size: 17px; font-weight: 700; margin: 0 4px 14px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 7px;
    padding: 14px 6px; border-radius: 14px; text-decoration: none;
    color: var(--text); background: color-mix(in srgb, var(--bg) 45%, transparent);
    border: 1px solid var(--border);
    transition: transform var(--dur-base) var(--ease-spring), background 140ms ease;
  }
  .tile:active { transform: scale(0.94); transition-duration: var(--dur-fast); }
  .tile-icon {
    width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary);
  }
  .tile-label { font-size: 11.5px; font-weight: 500; text-align: center; line-height: 1.2; }

  @media (max-width: 360px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
