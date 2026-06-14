<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { t } from '$lib/i18n';
  import type { InstallPlatform } from '$lib/pwa';

  export let open = false;
  export let platform: InstallPlatform = 'ios';

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  function close() { open = false; }

  $: steps = platform === 'ios'
    ? [$t.pwa.iosStep1, $t.pwa.iosStep2, $t.pwa.iosStep3]
    : [$t.pwa.manualStep1, $t.pwa.manualStep2];
</script>

{#if open}
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="sheet-overlay" on:click={close} role="presentation" transition:fade={{ duration: 200 }}></div>
    <div
      class="sheet glass-panel"
      role="dialog"
      aria-modal="true"
      aria-label={$t.pwa.installTitle}
      in:fly={{ y: 380, duration: 420, easing: backOut }}
      out:fly={{ y: 360, duration: 240, easing: cubicOut }}
    >
      <div class="sheet-handle"></div>
      <p class="sheet-title">{$t.pwa.installTitle}</p>
      <p class="sheet-sub">{platform === 'ios' ? $t.pwa.iosIntro : $t.pwa.manualIntro}</p>

      <ol class="steps">
        {#each steps as step, i}
          <li>
            <span class="num">{i + 1}</span>
            <span class="step-text">{step}</span>
          </li>
        {/each}
      </ol>

      <button class="done" on:click={close}>{$t.pwa.gotIt}</button>
    </div>
  </div>
{/if}

<style>
  .sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    border-radius: 20px 20px 0 0;
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    padding: 12px 20px calc(40px + env(safe-area-inset-bottom)); max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 18px; font-weight: 700; color: var(--text); }
  .sheet-sub { font-size: 13px; color: var(--muted); margin: 4px 0 18px; line-height: 1.4; }
  .steps { list-style: none; padding: 0; margin: 0 0 22px; display: flex; flex-direction: column; gap: 14px; }
  .steps li { display: flex; align-items: flex-start; gap: 12px; font-size: 15px; line-height: 1.45; color: var(--text); }
  .num {
    flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary);
    font-size: 13px; font-weight: 700;
  }
  .step-text { padding-top: 1px; }
  .done {
    display: block; width: 100%; padding: 13px; border: none; border-radius: var(--radius-md);
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
  }
</style>
