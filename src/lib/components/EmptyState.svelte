<script lang="ts">
  // A warmer shared empty state: a tinted icon badge + title + sub, with an
  // optional action slot. Replaces the bare text cards so blank screens read
  // as intentional rather than unfinished.
  export let icon: 'cards' | 'chart' | 'book' | 'doc' | 'sparkle' = 'doc';
  export let title: string;
  export let sub = '';

  const ICONS: Record<typeof icon, string> = {
    cards: 'M3 7a2 2 0 012-2h11a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM7 3h10a2 2 0 012 2v9',
    chart: 'M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3',
    book: 'M4 5a2 2 0 012-2h12v16H6a2 2 0 01-2-2V5zm2 12h12M9 7h6M9 10h4',
    doc: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5',
    sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z',
  };
</script>

<div class="empty">
  <div class="empty-badge" aria-hidden="true">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d={ICONS[icon]} />
    </svg>
  </div>
  <p class="empty-title">{title}</p>
  {#if sub}<p class="empty-sub">{sub}</p>{/if}
  <slot />
</div>

<style>
  .empty {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 36px 20px;
  }
  .empty-badge {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    margin-bottom: 14px;
  }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); margin: 0; max-width: 32ch; line-height: 1.5; }
  .empty :global(.empty-action) {
    display: inline-flex; align-items: center; margin-top: 14px;
    font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none;
    padding: 8px 14px; border-radius: 999px; border: 1.5px solid var(--border);
  }
  .empty :global(.empty-action:hover) { background: var(--bg3); }
</style>
