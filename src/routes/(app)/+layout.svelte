<script lang="ts">
  import TabBar from '$lib/components/TabBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MoreDrawer from '$lib/components/MoreDrawer.svelte';

  let drawerOpen = false;
</script>

<div class="app-shell">
  <div class="sidebar-slot"><Sidebar /></div>
  <main class="main-content page-enter"><slot /></main>
  <div class="tabbar-slot">
    <TabBar onMore={() => (drawerOpen = true)} />
    <MoreDrawer open={drawerOpen} onClose={() => (drawerOpen = false)} />
  </div>
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
  @media (min-width: 768px) {
    .sidebar-slot { display: block; width: var(--sidebar-width); flex-shrink: 0; }
    .tabbar-slot  { display: none; }
    .main-content { padding: 28px; }
  }
</style>
