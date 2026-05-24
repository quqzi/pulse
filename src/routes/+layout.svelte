<script lang="ts">
  import '../app.css';
  import { settings, resolvedTheme } from '$lib/stores/settings';
  import { auth } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        auth.set({ mode: 'authenticated', user: session.user, name: session.user.user_metadata?.name ?? 'Student' });
      } else {
        auth.set({ mode: 'guest', user: null, name: localStorage.getItem('pulse_guest_name') ?? 'Student' });
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        auth.set({ mode: 'authenticated', user: session.user, name: session.user.user_metadata?.name ?? 'Student' });
      } else {
        auth.set({ mode: 'guest', user: null, name: localStorage.getItem('pulse_guest_name') ?? 'Student' });
      }
    });

    // Re-derive when system dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      settings.update(s => ({ ...s }));
    });
  });

  $: if (browser) {
    document.body.className = `palette-${$settings.palette}${$resolvedTheme === 'dark' ? ' theme-dark' : ''}`;
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#f43f5e');
  }
</script>

<slot />
