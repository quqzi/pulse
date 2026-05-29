<script lang="ts">
  import { toasts, dismissToast } from '$lib/stores/toast';
</script>

<div class="toaster" aria-live="polite">
  {#each $toasts as t (t.id)}
    <button
      class="toast"
      class:error={t.kind === 'error'}
      class:success={t.kind === 'success'}
      type="button"
      on:click={() => dismissToast(t.id)}
    >
      {t.message}
    </button>
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
    text-align: left;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    animation: toast-in 200ms ease-out;
  }
  .toast.error { border-color: var(--danger); }
  .toast.success { border-color: var(--success); }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
</style>
