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
  import { maybeShowWhatsNew } from '$lib/whatsNew';

  let drawerOpen = false;

  onMount(maybeShowWhatsNew);
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
