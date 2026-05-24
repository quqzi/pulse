<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let name = '', email = '', password = '', error = '', loading = false;

  async function signup() {
    loading = true; error = '';
    const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    loading = false;
    if (err) { error = err.message; return; }
    goto('/onboarding');
  }
</script>

<div class="auth-page">
  <div class="auth-card card">
    <div class="logo-row">
      <div class="logo-mark">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          <polyline points="0,6 3,6 5.5,1 8,11 10.5,3.5 13,7.5 15,6 18,6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-word">pulse</span>
    </div>

    <h1 class="text-heading" style="margin-bottom:20px">Create account</h1>
    {#if error}<p class="error-msg">{error}</p>{/if}

    <form on:submit|preventDefault={signup} class="auth-form">
      <label><span class="field-label">Name</span><input type="text" bind:value={name} placeholder="Your name" required /></label>
      <label><span class="field-label">Email</span><input type="email" bind:value={email} placeholder="student@example.com" required /></label>
      <label><span class="field-label">Password</span><input type="password" bind:value={password} placeholder="Min. 8 characters" minlength="8" required /></label>
      <button type="submit" class="btn btn-primary" disabled={loading} style="width:100%">{loading ? 'Creating account…' : 'Create account'}</button>
    </form>

    <p class="auth-footer">Already have an account? <a href="/auth/login">Sign in</a></p>
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
  .error-msg { background:#fef2f2; color:#dc2626; border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
  .auth-footer { text-align:center; font-size:13px; color:var(--muted); margin-top:16px; }
  .auth-footer a { color:var(--primary); text-decoration:none; font-weight:600; }
</style>
