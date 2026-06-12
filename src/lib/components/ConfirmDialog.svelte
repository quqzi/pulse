<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';

  export let open = false;
  export let title: string | null = null;
  export let message = '';
  export let confirmLabel: string | null = null;
  export let danger = true;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  // Render at <body> so the dialog escapes `.main-content`'s trapped stacking
  // context and layers above the fixed tab-bar and any (also body-portaled) sheet.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  // Move keyboard focus into the dialog on open; restore it to the previously
  // focused control when the dialog closes.
  function focusTrap(node: HTMLElement) {
    const prev = document.activeElement as HTMLElement | null;
    (node.querySelector('.btn-confirm') as HTMLElement | null)?.focus();
    return { destroy() { prev?.focus?.(); } };
  }

  function confirm() { dispatch('confirm'); open = false; }
  function cancel() { dispatch('cancel'); open = false; }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) cancel();
  }

  function handleKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter') confirm();
  }
</script>

<svelte:window on:keydown={handleKey} />

{#if open}
  <div use:portal class="backdrop" on:click={handleBackdrop} role="dialog" aria-modal="true" tabindex="-1"
    on:keydown|stopPropagation={(e) => e.key === 'Escape' && cancel()}>
    <div class="dialog glass-panel" use:focusTrap>
      <p class="dialog-title">{title ?? $t.common.areYouSure}</p>
      {#if message}<p class="dialog-message">{message}</p>{/if}
      <div class="dialog-actions">
        <button class="btn-cancel" on:click={cancel}>{$t.common.cancel}</button>
        <button class="btn-confirm" class:danger on:click={confirm}>{confirmLabel ?? $t.common.delete}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .dialog {
    border-radius: 18px;
    padding: 24px;
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dialog-title { font-size: 16px; font-weight: 700; color: var(--text); margin: 0; }
  .dialog-message { font-size: 14px; color: var(--muted); margin: 0; line-height: 1.5; }
  .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  .btn-cancel {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-confirm {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background: var(--primary);
    color: var(--bg);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-confirm.danger { background: var(--danger); }
  .btn-cancel:hover { background: var(--bg); }
  .btn-confirm:hover { opacity: 0.88; }
</style>
