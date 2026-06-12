<script lang="ts">
  import { toasts, dismissToast, runToastAction } from '$lib/stores/toast';
</script>

<div class="toaster" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div
      class="toast"
      class:error={t.kind === 'error'}
      class:success={t.kind === 'success'}
    >
      <button class="toast-msg" type="button" on:click={() => dismissToast(t.id)}>
        {t.message}
      </button>
      {#if t.action}
        <button class="toast-action" type="button" on:click={() => runToastAction(t.id)}>{t.action.label}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    left: 50%;
    bottom: calc(var(--tab-bar-height, 56px) + 12px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 300;
    width: max-content;
    max-width: min(92vw, 420px);
    pointer-events: none;
  }
  @media (min-width: 768px) {
    .toaster { bottom: 24px; }
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px 4px 0;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    background: color-mix(in srgb, var(--bg2) 72%, transparent);
    backdrop-filter: blur(28px) saturate(1.7);
    -webkit-backdrop-filter: blur(28px) saturate(1.7);
    color: var(--text);
    box-shadow:
      var(--shadow-lg),
      inset 0 1px 0 color-mix(in srgb, var(--text) 10%, transparent);
    animation: toast-in 200ms ease-out;
  }
  .toast-msg {
    flex: 1;
    text-align: left;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    padding: 8px 10px 8px 16px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  }
  .toast-action {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    padding: 8px 12px;
    border-radius: 8px;
    flex-shrink: 0;
    min-height: 36px;
  }
  .toast-action:hover { background: var(--bg3); }
  .toast.error { border-color: var(--danger); }
  .toast.success { border-color: var(--success); }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
</style>
