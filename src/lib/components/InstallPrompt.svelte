<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { t } from '$lib/i18n';

  // The beforeinstallprompt event (non-standard; not in lib.dom).
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  const DISMISS_KEY = 'pulse.installDismissed';
  let deferred: BeforeInstallPromptEvent | null = null;
  let show = false;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  onMount(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own
      deferred = e as BeforeInstallPromptEvent;
      show = true;
    };
    const onInstalled = () => {
      show = false;
      localStorage.setItem(DISMISS_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  });

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    show = false;
    localStorage.setItem(DISMISS_KEY, '1');
  }

  function dismiss() {
    show = false;
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
