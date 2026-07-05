<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import { auth } from '$lib/stores/auth';
  import LangToggle from '$lib/components/LangToggle.svelte';
  import type { I18n } from '$lib/i18n/en';

  type NavKey = keyof I18n['nav'];

  const groups: { labelKey: NavKey; colorVar: string; items: { key: NavKey; href: string; d: string }[] }[] = [
    { labelKey: 'groupMain', colorVar: 'var(--nav-main)', items: [
      { key: 'dashboard', href: '/dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
      { key: 'timer',     href: '/timer',     d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2' },
      { key: 'subjects',  href: '/subjects',  d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
      { key: 'notes',     href: '/notes',     d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h6' },
    ]},
    { labelKey: 'groupTrack', colorVar: 'var(--nav-track)', items: [
      { key: 'analytics', href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
      { key: 'insights',  href: '/insights',  d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 8v4M12 16h.01' },
      { key: 'journey',   href: '/journey',   d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
      { key: 'tasks',     href: '/tasks',     d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { key: 'schedule',  href: '/schedule',  d: 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
      { key: 'scores',    href: '/scores',    d: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6' },
      { key: 'exam',      href: '/exam',      d: 'M9 11l3 3 5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
      { key: 'flashcards', href: '/flashcards', d: 'M3 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 9h6M7 13h4' },
      { key: 'groups',    href: '/groups',    d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    ]},
    { labelKey: 'groupSettings', colorVar: 'var(--muted)', items: [
      { key: 'settings',  href: '/settings',  d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
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
      <span class="nav-group-label" style="color:{group.colorVar}">{$t.nav[group.labelKey]}</span>
      {#each group.items as item}
        <a href={item.href} class="nav-item" class:active={path.startsWith(item.href)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="{item.d}" />
          </svg>
          <span>{$t.nav[item.key]}</span>
        </a>
      {/each}
    </div>
  {/each}

  <div class="side-footer">
    {#if $auth.mode === 'guest'}
      <a class="signin-btn pressable" href="/auth/signup">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
        </svg>
        <span>{$t.common.signInSync}</span>
      </a>
    {/if}
    <LangToggle />
  </div>
</aside>

<style>
  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: var(--sidebar-width);
    /* Glass over the aurora — mostly opaque so nav links stay readable even
       where the backdrop blur doesn't render; a hint of the wash still shows. */
    background: color-mix(in srgb, var(--bg2) 90%, transparent);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
    border-right: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
    padding: 20px 12px; overflow-y: auto; z-index: 100;
    display: flex; flex-direction: column; gap: 24px;
  }
  .logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 12px; }
  .logo-mark {
    width: 34px; height: 34px; background: var(--primary); color: var(--bg);
    border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow:
      0 4px 14px rgba(var(--primary-rgb), 0.35),
      inset 0 1px 0 color-mix(in srgb, var(--bg) 25%, transparent);
    transition: transform var(--dur-base) var(--ease-spring), box-shadow 240ms ease;
  }
  .logo:hover .logo-mark {
    transform: scale(1.1) rotate(-4deg);
    box-shadow:
      0 6px 20px rgba(var(--primary-rgb), 0.45),
      inset 0 1px 0 color-mix(in srgb, var(--bg) 25%, transparent);
  }
  /* The waveform redraws itself every few seconds — a literal pulse. */
  .logo-mark polyline {
    stroke-dasharray: 40;
    stroke-dashoffset: 0;
    animation: pulse-draw 3.6s ease-in-out infinite;
  }
  @keyframes pulse-draw {
    0%   { stroke-dashoffset: 40; opacity: 0.3; }
    40%  { stroke-dashoffset: 0; opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }
  .logo-word { font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
  .nav-group { display: flex; flex-direction: column; gap: 2px; }
  .nav-group-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 0 8px 4px; }
  .nav-item {
    position: relative;
    display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px;
    text-decoration: none; color: var(--muted); font-size: 14px; font-weight: 500;
    transition: background 140ms ease, color 140ms ease, transform var(--dur-base) var(--ease-spring);
  }
  /* Accent bar springs open on the active item. */
  .nav-item::before {
    content: ''; position: absolute; left: 2px; top: 50%; translate: 0 -50%;
    width: 3px; height: 16px; border-radius: 2px; background: var(--primary);
    transform: scaleY(0);
    transition: transform 280ms var(--ease-spring);
  }
  .nav-item.active::before { transform: scaleY(1); }
  .nav-item:active { transform: scale(0.96); transition-duration: var(--dur-fast); }
  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item:hover svg { transform: scale(1.12); }
  .nav-item svg { transition: transform var(--dur-base) var(--ease-spring); flex-shrink: 0; }
  .nav-item.active { background: var(--primary-l); color: var(--primary); font-weight: 600; }
  .side-footer {
    margin-top: auto; display: flex; flex-direction: column; gap: 10px;
    align-items: flex-start; padding: 8px 4px 0;
    border-top: 1px solid var(--border);
  }
  .signin-btn {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 9px 10px; border-radius: 10px; text-decoration: none;
    background: var(--primary-l); color: var(--primary);
    font-size: 13px; font-weight: 600;
    transition: background 140ms ease;
  }
  .signin-btn:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
  .signin-btn svg { flex-shrink: 0; }
</style>
