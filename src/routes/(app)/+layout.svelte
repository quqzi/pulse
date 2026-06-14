<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import TabBar from '$lib/components/TabBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MoreDrawer from '$lib/components/MoreDrawer.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import AuroraBackground from '$lib/components/AuroraBackground.svelte';
  import WhatsNew from '$lib/components/WhatsNew.svelte';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  import TimerPill from '$lib/components/TimerPill.svelte';
  import { maybeShowWhatsNew } from '$lib/whatsNew';
  import { initPwaInstall } from '$lib/pwa';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import { loadData, loadScheduleSlots } from '$lib/stores/data';
  import { initNotifications } from '$lib/notifications';
  import { resumeTimer } from '$lib/stores/timer';
  import { logCurrentTimerSession } from '$lib/timerSession';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import { ensurePushSubscribed } from '$lib/push';

  let drawerOpen = false;
  let timerResumed = false;
  let pushSynced = false;

  // A pomodoro that finished while the app was closed/backgrounded — log it from
  // wherever the app reopens, so the session is never lost (the summary modal is
  // the timer page's job for live completions).
  async function onAwayComplete() {
    const dur = await logCurrentTimerSession();
    if (dur !== null) toast.success($t.timer.sessionSaved);
  }

  // Keep this device's push subscription fresh once per app open — only when the
  // user already opted in and granted permission (so it never prompts on load).
  function syncPush(): void {
    if (pushSynced) return;
    if ($auth.mode !== 'authenticated' || !$settings.notifyEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    pushSynced = true;
    void ensurePushSubscribed();
  }

  // Current Mon–Sun week, so block reminders have this week's slots loaded
  // app-wide (pages only load slots on /schedule).
  function currentWeek(): { start: Date; end: Date } {
    const d = new Date();
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setDate(end.getDate() + 7);
    return { start: d, end };
  }

  onMount(() => {
    maybeShowWhatsNew();
    initPwaInstall();
    initNotifications();
  });

  // Keep data + this week's slots warm for reminders. Slots must load after
  // loadData (it sets the repo's userId).
  $: if ($auth.mode !== 'loading') {
    loadData($auth);
    const { start, end } = currentWeek();
    loadScheduleSlots(start, end);
    syncPush();
  }

  // Resume a running/paused timer app-wide once (after auth resolves, so an
  // away-completed session logs under the right user). On mobile the PWA gets
  // killed in the background; this — plus the TimerPill — is what makes a timer
  // survive being reopened on any page, not just /timer.
  $: if ($auth.mode !== 'loading' && !timerResumed) {
    timerResumed = true;
    resumeTimer(onAwayComplete);
  }
</script>

<AuroraBackground />

<div class="app-shell">
  <div class="sidebar-slot"><Sidebar /></div>
  <main class="main-content page-enter" class:full-bleed={$page.url.pathname === '/schedule'}><slot /></main>
  <div class="tabbar-slot">
    <TabBar onMore={() => (drawerOpen = true)} />
    <MoreDrawer open={drawerOpen} onClose={() => (drawerOpen = false)} />
  </div>
  <Toaster />
  <InstallPrompt />
  <WhatsNew />
  <TimerPill />
</div>

<style>
  .app-shell { display: flex; height: 100dvh; overflow: hidden; }
  .sidebar-slot { display: none; }
  .main-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 20px 16px calc(var(--tab-bar-height) + 20px + env(safe-area-inset-bottom)) 16px;
  }
  @media (max-width: 768px) {
    .main-content.full-bleed {
      padding: 0 0 calc(var(--tab-bar-height) + env(safe-area-inset-bottom)) 0;
      overflow: hidden;
    }
  }
  @media (min-width: 768px) {
    .sidebar-slot { display: block; width: var(--sidebar-width); flex-shrink: 0; }
    .tabbar-slot  { display: none; }
    .main-content { padding: 28px; }
  }
</style>
