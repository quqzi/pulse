<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  let errorMsg = '';

  onMount(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      errorMsg = error.message;
      setTimeout(() => goto('/auth/login'), 3000);
      return;
    }
    if (session) {
      goto('/dashboard');
    } else {
      // Wait for onAuthStateChange to fire with the token from the hash
      supabase.auth.onAuthStateChange((event, s) => {
        if (s) goto('/dashboard');
      });
    }
  });
</script>

<div class="callback-wrap">
  {#if errorMsg}
    <p class="error">OAuth error: {errorMsg}</p>
  {:else}
    <p>Signing in…</p>
  {/if}
</div>

<style>
  .callback-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--muted);
    font-size: 14px;
  }
  .error { color: var(--danger); }
</style>
