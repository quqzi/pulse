<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let email = '', password = '', error = '', loading = false;

  async function signInWithGoogle() {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) error = err.message;
  }

  async function login() {
    loading = true; error = '';
    const { data: authData, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { error = err.message; loading = false; return; }
    if (!authData.session) { goto('/onboarding'); loading = false; return; }

    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', authData.session.user.id)
      .limit(1);

    loading = false;
    goto(existing && existing.length > 0 ? '/dashboard' : '/onboarding');
  }

  function continueAsGuest() {
    localStorage.setItem('pulse_guest_name', 'Student');
    goto('/dashboard');
  }
</script>

<div class="auth-page">
  <div class="auth-card card">
    <div class="logo-row">
      <div class="logo-mark">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          <polyline points="0,6 3,6 5.5,1 8,11 10.5,3.5 13,7.5 15,6 18,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-word">pulse</span>
    </div>

    <h1 class="text-heading" style="margin-bottom:20px">Sign in</h1>

    {#if error}<p class="error-msg">{error}</p>{/if}

    <button class="google-btn" on:click={signInWithGoogle} type="button">
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <div class="auth-divider"><span>or</span></div>

    <form on:submit|preventDefault={login} class="auth-form">
      <label><span class="field-label">Email</span><input type="email" bind:value={email} placeholder="student@example.com" required /></label>
      <label><span class="field-label">Password</span><input type="password" bind:value={password} placeholder="••••••••" required /></label>
      <button type="submit" class="btn btn-primary" disabled={loading} style="width:100%">{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>

    <div class="divider"><span>or</span></div>
    <button class="btn btn-secondary" style="width:100%" on:click={continueAsGuest}>Continue as Guest</button>
    <p class="auth-footer">No account? <a href="/auth/signup">Sign up</a></p>
  </div>
</div>

<style>
  .auth-page { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); }
  .auth-card { width:100%; max-width:380px; padding:32px 28px; }
  .logo-row { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
  .logo-mark { width:36px; height:36px; background:var(--primary); border-radius:9px; display:flex; align-items:center; justify-content:center; }
  .logo-word { font-size:22px; font-weight:800; letter-spacing:-0.03em; }
  .auth-form { display:flex; flex-direction:column; gap:14px; margin-bottom:16px; }
  .auth-form label { display:flex; flex-direction:column; gap:5px; }
  .field-label { font-size:13px; font-weight:600; color:var(--muted); }
  .auth-form input { padding:11px 14px; border-radius:var(--radius-sm); border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; outline:none; transition:border-color 140ms ease; }
  .auth-form input:focus { border-color:var(--primary); }
  .error-msg { background:var(--danger-soft); color:var(--danger); border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
  .google-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 10px 16px; border-radius: var(--radius-md); border: 1px solid var(--border);
    background: var(--bg2); color: var(--text); font-family: inherit;
    font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 4px;
  }
  .google-btn:hover { background: var(--bg3); }
  .auth-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 12px 0; color: var(--muted); font-size: 12px;
  }
  .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .divider { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; margin:12px 0; }
  .divider::before,.divider::after { content:''; flex:1; height:1px; background:var(--border); }
  .auth-footer { text-align:center; font-size:13px; color:var(--muted); margin-top:16px; }
  .auth-footer a { color:var(--primary); text-decoration:none; font-weight:600; }
</style>
