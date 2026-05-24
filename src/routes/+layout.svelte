<script lang="ts">
  import '../app.css';
  import { settings } from '$lib/stores/settings';
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
  });

  $: if (browser) {
    const t = $settings.theme;
    const design = t === 'resend' ? 'resend' : t.split('-')[0];
    const isDark = t === 'resend' || t.endsWith('-dark');
    document.body.className = [
      `design-${design}`,
      isDark ? 'theme-dark' : '',
    ].filter(Boolean).join(' ');
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#171717');
  }
</script>

<slot />
