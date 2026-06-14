<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { canInstall, promptInstall } from '$lib/pwa';

  const DISMISS_KEY = 'pulse.installDismissed';
  let dismissed = browser ? !!localStorage.getItem(DISMISS_KEY) : true;

  // The banner respects a one-time dismissal; the Settings button (which reads
  // canInstall directly) stays available even after the banner is dismissed.
  $: show = $canInstall && !dismissed;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  async function install() {
    await promptInstall();
    dismissed = true;
    localStorage.setItem(DISMISS_KEY, '1');
  }

  function dismiss() {
    dismissed = true;
    localStorage.setItem(DISMISS_KEY, '1');
  }
</script>

{#if show}
  <div use:portal class="install-banner glass-panel" transition:fly={{ y: 90, duration: 340, easing: cubicOut }}>
    <div class="head">
      <span class="badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
        </svg>
      </span>
      <div class="copy">
        <p class="title">{$t.pwa.installTitle}</p>
        <p class="body">{$t.pwa.installBody}</p>
      </div>
    </div>
    <div class="actions">
      <button class="dismiss" on:click={dismiss}>{$t.pwa.notNow}</button>
      <button class="install" on:click={install}>{$t.pwa.install}</button>
    </div>
  </div>
{/if}

<style>
  .install-banner {
    position: fixed; z-index: 250;
    left: 12px; right: 12px;
    bottom: calc(var(--tab-bar-height, 0px) + 12px + env(safe-area-inset-bottom));
    max-width: 480px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 12px;
    padding: 14px 16px; border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  }
  .head { display: flex; align-items: center; gap: 12px; }
  .badge {
    flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary);
  }
  .copy { flex: 1; min-width: 0; }
  .title { font-size: 14px; font-weight: 700; color: var(--text); }
  .body { font-size: 12px; color: var(--muted); line-height: 1.35; }
  .actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
  .dismiss {
    padding: 8px 10px; border: none; background: none; color: var(--muted);
    font-family: inherit; font-size: 13px; cursor: pointer; border-radius: 8px;
  }
  .install {
    padding: 8px 16px; border: none; border-radius: 10px;
    background: var(--primary); color: var(--bg);
    font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  /* On desktop the tab-bar is hidden; anchor a touch higher off the corner. */
  @media (min-width: 768px) {
    .install-banner { left: auto; right: 20px; bottom: 20px; margin: 0; width: 380px; }
  }
</style>
