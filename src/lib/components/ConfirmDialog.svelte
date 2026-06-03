<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = 'Are you sure?';
  export let message = '';
  export let confirmLabel = 'Delete';
  export let danger = true;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  // Render at <body> so the dialog escapes `.main-content`'s trapped stacking
  // context and layers above the fixed tab-bar and any (also body-portaled) sheet.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
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
  <div use:portal class="backdrop" on:click={handleBackdrop} role="dialog" aria-modal="true">
    <div class="dialog">
      <p class="dialog-title">{title}</p>
      {#if message}<p class="dialog-message">{message}</p>{/if}
      <div class="dialog-actions">
        <button class="btn-cancel" on:click={cancel}>Cancel</button>
        <button class="btn-confirm" class:danger on:click={confirm}>{confirmLabel}</button>
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
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
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
