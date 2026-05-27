<script lang="ts">
  import { page } from '$app/stores';

  const groups = [
    { label: 'Main', colorVar: 'var(--nav-main)', items: [
      { label: 'Dashboard', href: '/dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
      { label: 'Timer',     href: '/timer',     d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2' },
      { label: 'Subjects',  href: '/subjects',  d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    ]},
    { label: 'Track', colorVar: 'var(--nav-track)', items: [
      { label: 'Analytics', href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
      { label: 'Insights',  href: '/insights',  d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 8v4M12 16h.01' },
      { label: 'Journey',   href: '/journey',   d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
      { label: 'Tasks',     href: '/tasks',     d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { label: 'Schedule',  href: '/schedule',  d: 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
      { label: 'Scores',    href: '/scores',    d: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6' },
    ]},
    { label: 'Settings', colorVar: 'var(--muted)', items: [
      { label: 'Settings',  href: '/settings',  d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ]},
  ];

  $: path = $page.url.pathname;
</script>

<aside class="sidebar">
  <div class="logo">
    <div class="logo-mark">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
        <polyline points="0,6 3,6 5.5,1 8,11 10.5,3.5 13,7.5 15,6 18,6"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </div>
    <span class="logo-word">pulse</span>
  </div>

  {#each groups as group}
    <div class="nav-group">
      <span class="nav-group-label" style="color:{group.colorVar}">{group.label}</span>
      {#each group.items as item}
        <a href={item.href} class="nav-item" class:active={path.startsWith(item.href)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="{item.d}" />
          </svg>
          <span>{item.label}</span>
        </a>
      {/each}
    </div>
  {/each}
</aside>

<style>
  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: var(--sidebar-width);
    background: var(--bg2); border-right: 1px solid var(--border);
    padding: 20px 12px; overflow-y: auto; z-index: 100;
    display: flex; flex-direction: column; gap: 24px;
  }
  .logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 12px; }
  .logo-mark { width: 32px; height: 32px; background: var(--primary); color: var(--bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .logo-word { font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
  .nav-group { display: flex; flex-direction: column; gap: 2px; }
  .nav-group-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 0 8px 4px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; text-decoration: none; color: var(--muted); font-size: 14px; font-weight: 500; transition: background 140ms ease, color 140ms ease; }
  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item.active { background: var(--primary-l); color: var(--primary); font-weight: 600; }
</style>
