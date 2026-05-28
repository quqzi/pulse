<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';

  onMount(async () => {
    const code = $page.url.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        goto('/auth/login?error=oauth');
        return;
      }
    }
    goto('/dashboard');
  });
</script>

<div class="callback-wrap">
  <p>Signing in…</p>
</div>

<style>
  .callback-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    color: var(--muted);
    font-size: 14px;
  }
</style>
