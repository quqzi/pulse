<script lang="ts">
  import { settings, type Theme, type DesignTheme } from '$lib/stores/settings';
  import { auth } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const themes: { value: Theme; label: string }[] = [
    { value:'light', label:'Light' },
    { value:'dark',  label:'Dark' },
    { value:'auto',  label:'System' },
  ];

  const designThemes: { value: DesignTheme; label: string; desc: string; bg: string; text: string; card: string; radius: string }[] = [
    { value:'vercel', label:'Vercel', desc:'Ink · 8px radius · stacked shadows',      bg:'#fafafa', text:'#171717', card:'#ffffff', radius:'8px' },
    { value:'apple',  label:'Apple',  desc:'Parchment · 18px radius · action blue',   bg:'#f5f5f7', text:'#1d1d1f', card:'#ffffff', radius:'18px' },
    { value:'resend', label:'Resend', desc:'Pitch black · 12px radius · always dark',  bg:'#000000', text:'#fcfdff', card:'#0a0a0c', radius:'12px' },
  ];

  $: isResend = $settings.designTheme === 'resend';

  async function signOut() {
    await supabase.auth.signOut();
    goto('/auth/login');
  }
</script>

<div class="page-enter">
  <h1 class="text-large-title" style="margin-bottom:24px">Settings</h1>

  <p class="section-label">Appearance</p>
  <div class="card section-card">
    {#if !isResend}
    <p style="font-size:14px;font-weight:600;margin-bottom:10px">Mode</p>
    <div class="theme-row">
      {#each themes as t}
        <button
          class="theme-btn"
          class:active={$settings.theme === t.value}
          on:click={() => settings.update(s => ({ ...s, theme: t.value }))}
        >{t.label}</button>
      {/each}
    </div>
    {/if}

    <p style="font-size:14px;font-weight:600;margin:18px 0 10px">Design</p>
    <div class="design-row">
      {#each designThemes as d}
        <button
          class="design-card"
          class:selected={$settings.designTheme === d.value}
          style="--d-bg:{d.bg};--d-text:{d.text};--d-card:{d.card};--d-radius:{d.radius};--d-accent:var(--primary)"
          on:click={() => settings.update(s => ({ ...s, designTheme: d.value }))}
        >
          <div class="design-preview">
            <div class="dp-card">
              <div class="dp-line long" style="background:{d.text};opacity:.8"></div>
              <div class="dp-line short" style="background:{d.text};opacity:.4"></div>
              <div class="dp-btn" style="background:var(--primary)"></div>
            </div>
          </div>
          <div class="design-label">{d.label}</div>
          <div class="design-desc">{d.desc}</div>
        </button>
      {/each}
    </div>
  </div>

  <p class="section-label" style="margin-top:20px">Study</p>
  <div class="card section-card">
    <div class="setting-row">
      <span class="text-body">Daily goal</span>
      <div class="row-right">
        <input type="number" min="1" max="12" step="0.5" value={$settings.dailyGoalHours}
          on:change={e => settings.update(s => ({ ...s, dailyGoalHours: +e.currentTarget.value }))}
          class="num-input" />
        <span class="text-muted text-body">h / day</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="setting-row">
      <span class="text-body">Pomodoro work</span>
      <div class="row-right">
        <input type="number" min="5" max="60" step="5" value={$settings.pomodoroWork}
          on:change={e => settings.update(s => ({ ...s, pomodoroWork: +e.currentTarget.value }))}
          class="num-input" />
        <span class="text-muted text-body">min</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="setting-row">
      <span class="text-body">Pomodoro break</span>
      <div class="row-right">
        <input type="number" min="1" max="30" value={$settings.pomodoroBreak}
          on:change={e => settings.update(s => ({ ...s, pomodoroBreak: +e.currentTarget.value }))}
          class="num-input" />
        <span class="text-muted text-body">min</span>
      </div>
    </div>
  </div>

  {#if $auth.mode === 'authenticated'}
    <p class="section-label" style="margin-top:20px">Account</p>
    <div class="card section-card">
      <div class="setting-row">
        <span class="text-body text-muted">Signed in as</span>
        <span class="text-body">{$auth.user?.email}</span>
      </div>
      <div class="divider"></div>
      <button class="setting-row sign-out" on:click={signOut}>
        <span style="color:#dc2626;font-size:15px">Sign out</span>
      </button>
    </div>
  {:else}
    <p class="section-label" style="margin-top:20px">Account</p>
    <div class="card section-card">
      <div class="setting-row">
        <span class="text-body text-muted">Mode</span>
        <span class="text-body">Guest</span>
      </div>
      <div class="divider"></div>
      <a href="/auth/signup" class="setting-row" style="text-decoration:none">
        <span style="color:var(--primary);font-size:15px;font-weight:600">Create account to sync data</span>
      </a>
    </div>
  {/if}
</div>

<style>
  .section-card { padding:6px 16px; }
  .theme-row { display:flex; border:1.5px solid var(--border); border-radius:var(--radius-sm); overflow:hidden; }
  .theme-btn { flex:1; padding:9px; border:none; background:transparent; color:var(--muted); font-family:inherit; font-size:14px; font-weight:500; cursor:pointer; transition:background 120ms ease, color 120ms ease; }
  .theme-btn.active { background:var(--primary); color:#fff; font-weight:600; }
  .setting-row { display:flex; align-items:center; justify-content:space-between; padding:13px 0; gap:12px; background:none; border:none; width:100%; font-family:inherit; }
  .row-right { display:flex; align-items:center; gap:8px; }
  .sign-out { cursor:pointer; }
  .divider { height:1px; background:var(--border); }
  .num-input { width:58px; padding:6px 10px; border-radius:8px; border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; text-align:center; outline:none; }
  .num-input:focus { border-color:var(--primary); }
  .design-row { display:flex; gap:8px; }
  .design-card {
    flex:1; border:2px solid var(--border); border-radius:var(--radius-md);
    background:var(--d-bg); cursor:pointer; padding:10px 8px 8px;
    transition:border-color 120ms ease, transform 120ms ease;
    text-align:center;
  }
  .design-card:hover { transform:translateY(-1px); }
  .design-card.selected { border-color:var(--primary); }
  .design-preview {
    background:var(--d-bg); border-radius:var(--d-radius);
    padding:8px; margin-bottom:6px;
  }
  .dp-card {
    background:var(--d-card); border-radius:calc(var(--d-radius) * 0.6);
    padding:7px 8px; display:flex; flex-direction:column; gap:4px;
  }
  .dp-line { height:3px; border-radius:2px; }
  .dp-line.long  { width:70%; }
  .dp-line.short { width:45%; }
  .dp-btn { height:6px; width:36%; border-radius:999px; margin-top:2px; }
  .design-label { font-size:12px; font-weight:700; color:var(--text); margin-bottom:2px; }
  .design-desc  { font-size:10px; color:var(--muted); line-height:1.3; }
</style>
