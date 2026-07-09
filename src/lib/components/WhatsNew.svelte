<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { settings } from '$lib/stores/settings';
  import { t } from '$lib/i18n';
  import { CHANGELOG } from '$lib/changelog';
  import { whatsNewOpen, closeWhatsNew } from '$lib/whatsNew';

  // Portal to <body> so it escapes the trapped stacking context above the tab-bar.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  $: lang = $settings.lang;
  $: entry = CHANGELOG[0];
</script>

{#if $whatsNewOpen}
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="overlay" on:click={closeWhatsNew} role="presentation" transition:fade={{ duration: 180 }}></div>
    <div
      class="card glass-panel"
      role="dialog"
      aria-modal="true"
      aria-label={$t.pwa.whatsNew}
      in:scale={{ start: 0.92, duration: 360, easing: backOut }}
      out:scale={{ start: 0.96, duration: 180, easing: cubicOut }}
    >
      <p class="eyebrow">{$t.pwa.whatsNew} · v{entry.version}</p>
      <h2 class="title">{lang === 'th' ? entry.title.th : entry.title.en}</h2>
      <ul class="items">
        {#each entry.items as item}
          <li>
            <span class="check">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
            <span>{lang === 'th' ? item.th : item.en}</span>
          </li>
        {/each}
      </ul>
      <button class="cta" on:click={closeWhatsNew}>{$t.pwa.gotIt}</button>
    </div>
  </div>
{/if}

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 300; }
  .card {
    position: fixed; z-index: 301;
    left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: calc(100% - 32px); max-width: 420px; max-height: 80vh; overflow-y: auto;
    border: 1px solid var(--border);
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    border-radius: 20px; padding: 24px 22px;
  }
  .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--primary); margin-bottom: 6px; }
  .title { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 16px; }
  .items { list-style: none; padding: 0; margin: 0 0 22px; display: flex; flex-direction: column; gap: 12px; }
  .items li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.45; color: var(--text); }
  .check {
    flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; margin-top: 1px;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary);
  }
  .cta {
    display: block; width: 100%; padding: 13px; border: none; border-radius: var(--radius-md);
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
  }
</style>
