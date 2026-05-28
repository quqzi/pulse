<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  let errorMsg = '';

  onMount(async () => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        errorMsg = error.message;
        setTimeout(() => goto('/auth/login'), 3000);
        return;
      }
    }
    goto('/dashboard');
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
    min-height: 100dvh;
    color: var(--muted);
    font-size: 14px;
  }
  .error { color: var(--danger); }
</style>
