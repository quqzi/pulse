<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { t } from '$lib/i18n';
  import AuroraBackground from '$lib/components/AuroraBackground.svelte';

  let name = '', email = '', password = '', error = '', loading = false;
  let confirmSent = false;

  async function signInWithGoogle() {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) error = err.message;
  }

  async function signup() {
    loading = true; error = '';
    const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    loading = false;
    if (err) { error = err.message; return; }
    if (!data.session) { confirmSent = true; return; }
    goto('/onboarding');
  }
</script>

<AuroraBackground />

<div class="auth-page">
  <div class="auth-card glass-panel" in:fly={{ y: 24, duration: 480, easing: backOut }}>
    <div class="logo-row">
      <div class="logo-mark">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          <polyline points="0,6 3,6 5.5,1 8,11 10.5,3.5 13,7.5 15,6 18,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-word">pulse</span>
    </div>

    <h1 class="text-heading" style="margin-bottom:20px">{$t.auth.createAccount}</h1>
    {#if error}<p class="error-msg">{error}</p>{/if}

    {#if !confirmSent}
    <button class="google-btn" on:click={signInWithGoogle} type="button">
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      {$t.auth.continueWithGoogle}
    </button>

    <div class="auth-divider"><span>{$t.auth.or}</span></div>
    {/if}

    {#if confirmSent}
      <div class="confirm-msg">
        <p style="font-weight:600; margin-bottom:4px">{$t.auth.checkEmail}</p>
        <p style="color:var(--muted); font-size:14px">{$t.auth.confirmSentTo(email)} <a href="/auth/login">{$t.auth.signIn}</a></p>
      </div>
    {:else}
    <form on:submit|preventDefault={signup} class="auth-form">
      <label><span class="field-label">{$t.auth.name}</span><input type="text" bind:value={name} placeholder={$t.auth.namePlaceholder} required /></label>
      <label><span class="field-label">{$t.auth.email}</span><input type="email" bind:value={email} placeholder="student@example.com" required /></label>
      <label><span class="field-label">{$t.auth.password}</span><input type="password" bind:value={password} placeholder={$t.auth.passwordMin} minlength="8" required /></label>
      <button type="submit" class="btn btn-primary" disabled={loading} style="width:100%">{loading ? $t.auth.creatingAccount : $t.auth.createAccount}</button>
    </form>

    <p class="auth-footer">{$t.auth.haveAccount} <a href="/auth/login">{$t.auth.signIn}</a></p>
    {/if}
  </div>
</div>

<style>
  .auth-page { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .auth-card { width:100%; max-width:380px; padding:32px 28px; border-radius:22px; }
  .logo-row { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
  .logo-mark {
    width:36px; height:36px; background:var(--primary); color:var(--bg); border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    box-shadow:
      0 4px 14px rgba(var(--primary-rgb), 0.35),
      inset 0 1px 0 color-mix(in srgb, var(--bg) 25%, transparent);
  }
  .logo-mark polyline {
    stroke-dasharray: 40;
    animation: pulse-draw 3.6s ease-in-out infinite;
  }
  @keyframes pulse-draw {
    0%   { stroke-dashoffset: 40; opacity: 0.3; }
    40%  { stroke-dashoffset: 0; opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }
  .logo-word { font-size:22px; font-weight:800; letter-spacing:-0.03em; }
  .auth-form { display:flex; flex-direction:column; gap:14px; margin-bottom:16px; }
  .auth-form label { display:flex; flex-direction:column; gap:5px; }
  .field-label { font-size:13px; font-weight:600; color:var(--muted); }
  .auth-form input {
    padding:12px 14px; border-radius:12px; border:1.5px solid var(--border);
    background:color-mix(in srgb, var(--bg) 70%, transparent); color:var(--text);
    font-family:inherit; font-size:15px; outline:none;
    transition:border-color 140ms ease, box-shadow 140ms ease;
  }
  .auth-form input:focus {
    border-color:var(--primary);
    box-shadow:0 0 0 3px rgba(var(--primary-rgb), 0.15);
  }
  .error-msg { background:var(--danger-soft); color:var(--danger); border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
  .auth-footer { text-align:center; font-size:13px; color:var(--muted); margin-top:16px; }
  .auth-footer a { color:var(--primary); text-decoration:none; font-weight:600; }
  .confirm-msg { background:var(--bg3); border:1.5px solid var(--border); border-radius:var(--radius-md); padding:16px; margin-bottom:16px; }
  .confirm-msg a { color:var(--primary); text-decoration:none; font-weight:600; }
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
</style>
