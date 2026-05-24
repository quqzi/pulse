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
  .app-shell { display: flex; min-height: 100dvh; }
  .sidebar-slot { display: none; }
  .main-content {
    flex: 1;
    padding: 20px 16px calc(var(--tab-bar-height) + 20px + env(safe-area-inset-bottom)) 16px;
  }
  @media (min-width: 768px) {
    .sidebar-slot { display: block; width: var(--sidebar-width); flex-shrink: 0; }
    .tabbar-slot  { display: none; }
    .main-content { padding: 28px 28px 28px calc(var(--sidebar-width) + 28px); }
  }
</style>
