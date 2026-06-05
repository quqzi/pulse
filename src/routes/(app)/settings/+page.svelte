<script lang="ts">
  import { settings, type Theme } from '$lib/stores/settings';
  import { auth } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const themes: { value: Theme; label: string; sub: string; bg: string; text: string; card: string; accent: string; radius: string }[] = [
    { value:'vercel-light', label:'Vercel', sub:'Light', bg:'#fafafa', text:'#171717', card:'#ffffff', accent:'#0070f3', radius:'8px'  },
    { value:'vercel-dark',  label:'Vercel', sub:'Dark',  bg:'#0a0a0a', text:'#ededed', card:'#1a1a1a', accent:'#3291ff', radius:'8px'  },
    { value:'apple-light',  label:'Apple',  sub:'Light', bg:'#f5f5f7', text:'#1d1d1f', card:'#ffffff', accent:'#0066cc', radius:'18px' },
    { value:'apple-dark',   label:'Apple',  sub:'Dark',  bg:'#000000', text:'#f2f2f7', card:'#1c1c1e', accent:'#2997ff', radius:'18px' },
    { value:'resend',       label:'Resend', sub:'Dark',  bg:'#000000', text:'#fcfdff', card:'#0a0a0c', accent:'#3b9eff', radius:'12px' },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    goto('/auth/login');
  }
</script>

<div class="page-enter">
  <h1 class="text-large-title" style="margin-bottom:24px">Settings</h1>

  <p class="section-label">Appearance</p>
  <div class="card section-card">
    <p style="font-size:14px;font-weight:600;margin-bottom:12px">Theme</p>
    <div class="theme-grid">
      {#each themes as t}
        <button
          class="theme-card"
          class:selected={$settings.theme === t.value}
          style="--t-bg:{t.bg};--t-text:{t.text};--t-card:{t.card};--t-accent:{t.accent};--t-radius:{t.radius}"
          on:click={() => settings.update(s => ({ ...s, theme: t.value }))}
        >
          <div class="tc-preview">
            <div class="tc-card">
              <div class="tc-line long"  style="background:{t.text};opacity:.8"></div>
              <div class="tc-line short" style="background:{t.text};opacity:.4"></div>
              <div class="tc-btn"        style="background:{t.accent}"></div>
            </div>
          </div>
          <div class="tc-label">{t.label}</div>
          <div class="tc-sub">{t.sub}</div>
        </button>
      {/each}
    </div>
  </div>

  <div class="card section-card" style="margin-top:8px">
    <div class="setting-row">
      <span class="text-body">Language</span>
      <div class="lang-pills">
        <button class="lang-pill" class:active={$settings.lang === 'en'}
          on:click={() => settings.update(s => ({ ...s, lang: 'en' }))}>English</button>
        <button class="lang-pill" class:active={$settings.lang === 'th'}
          on:click={() => settings.update(s => ({ ...s, lang: 'th' }))}>ไทย</button>
      </div>
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

  <p class="section-label" style="margin-top:20px">Calendar & Scheduling</p>
  <div class="card section-card">
    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">School hours</span>
        <span class="text-muted" style="font-size:13px">Block these times from auto-scheduling</span>
      </div>
      <label class="toggle">
        <input type="checkbox" bind:checked={$settings.schoolHoursEnabled} />
        <span class="toggle-track"></span>
      </label>
    </div>

    {#if $settings.schoolHoursEnabled}
      <div class="school-hours-config">
        <div class="day-picker">
          {#each [['M',1],['T',2],['W',3],['T',4],['F',5],['S',6],['S',7]] as [label, val] (val)}
            <button
              class="day-chip"
              class:active={$settings.schoolDays.includes(val as number)}
              on:click={() => {
                const v = val as number;
                const days = $settings.schoolDays.includes(v)
                  ? $settings.schoolDays.filter(d => d !== v)
                  : [...$settings.schoolDays, v];
                settings.update(s => ({ ...s, schoolDays: days }));
              }}
            >{label}</button>
          {/each}
        </div>
        <div class="time-row">
          <label class="time-field">
            <span>From</span>
            <input type="time" bind:value={$settings.schoolStart} />
          </label>
          <label class="time-field">
            <span>To</span>
            <input type="time" bind:value={$settings.schoolEnd} />
          </label>
        </div>
      </div>
    {/if}

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">Energy profile</span>
        <span class="text-muted" style="font-size:13px">Auto-schedule matches hard subjects to your peak hours</span>
      </div>
    </div>
    <div class="energy-options">
      {#each [['morning','🌅 Morning person','Peak 6am–12pm'],['neutral','☀️ No preference','Equal weighting'],['evening','🌙 Evening person','Peak 6pm–10pm']] as [val, label, desc] ([val, label, desc])}
        <button
          class="energy-chip"
          class:active={$settings.energyProfile === val}
          on:click={() => settings.update(s => ({ ...s, energyProfile: val as 'morning' | 'evening' | 'neutral' }))}
        >
          <span class="energy-label">{label}</span>
          <span class="energy-desc">{desc}</span>
        </button>
      {/each}
    </div>

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">Buffer between sessions</span>
        <span class="text-muted" style="font-size:13px">{$settings.bufferMinutes} min gap after each auto-scheduled block</span>
      </div>
      <input
        type="range"
        min="0"
        max="30"
        step="5"
        bind:value={$settings.bufferMinutes}
        style="width:100px"
      />
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
        <span style="color:var(--danger);font-size:15px">Sign out</span>
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
  .setting-row { display:flex; align-items:center; justify-content:space-between; padding:13px 0; gap:12px; background:none; border:none; width:100%; font-family:inherit; }
  .row-right { display:flex; align-items:center; gap:8px; }
  .sign-out { cursor:pointer; }
  .divider { height:1px; background:var(--border); }
  .num-input { width:58px; padding:6px 10px; border-radius:8px; border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; text-align:center; outline:none; }
  .num-input:focus { border-color:var(--primary); }

  .lang-pills { display:flex; gap:6px; }
  .lang-pill {
    padding:7px 14px; border-radius:999px; border:1.5px solid var(--border);
    background:var(--bg); color:var(--muted); font-family:inherit; font-size:14px;
    font-weight:600; cursor:pointer; min-height:36px;
  }
  .lang-pill.active { border-color:var(--primary); background:var(--primary-l); color:var(--primary); }
  @media (max-width: 768px) { .lang-pill { min-height: 44px; } }

  .theme-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  @media (max-width:360px) { .theme-grid { grid-template-columns:repeat(2,1fr); } }

  .theme-card {
    border:2px solid var(--border); border-radius:var(--radius-md);
    background:var(--t-bg); cursor:pointer; padding:10px 8px 8px;
    transition:border-color 120ms ease, transform 120ms ease;
    text-align:center;
  }
  .theme-card:hover { transform:translateY(-1px); }
  .theme-card.selected { border-color:var(--t-accent); }

  .tc-preview {
    background:var(--t-bg); border-radius:var(--t-radius);
    padding:8px; margin-bottom:6px;
  }
  .tc-card {
    background:var(--t-card); border-radius:calc(var(--t-radius) * 0.6);
    padding:7px 8px; display:flex; flex-direction:column; gap:4px;
  }
  .tc-line { height:3px; border-radius:2px; }
  .tc-line.long  { width:70%; }
  .tc-line.short { width:45%; }
  .tc-btn { height:6px; width:36%; border-radius:999px; margin-top:2px; }
  .tc-label { font-size:12px; font-weight:700; color:var(--t-text); margin-bottom:1px; }
  .tc-sub   { font-size:10px; color:var(--t-text); opacity:.55; line-height:1.3; }

  .setting-info { display:flex; flex-direction:column; gap:2px; }

  .toggle { display:flex; align-items:center; cursor:pointer; flex-shrink:0; }
  .toggle input { display:none; }
  .toggle-track {
    width:44px; height:24px; border-radius:999px; background:var(--border);
    position:relative; transition:background 150ms ease;
  }
  .toggle-track::after {
    content:''; position:absolute; top:2px; left:2px;
    width:20px; height:20px; border-radius:50%; background:white; /* stylelint-disable-line color-named */
    transition:transform 150ms ease;
  }
  .toggle input:checked + .toggle-track { background:var(--primary); }
  .toggle input:checked + .toggle-track::after { transform:translateX(20px); }

  .school-hours-config {
    padding: 10px 0 6px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .day-picker { display:flex; gap:4px; }
  .day-chip {
    width:28px; height:28px; border-radius:50%;
    border:1.5px solid var(--border); background:var(--bg);
    color:var(--text); font-size:11px; font-weight:600;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
  }
  .day-chip.active { background:var(--primary); border-color:var(--primary); color:var(--bg); }
  .time-row { display:flex; gap:12px; }
  .time-field { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text); }
  .time-field input {
    border:1px solid var(--border); border-radius:6px; padding:4px 8px;
    background:var(--bg); color:var(--text); font-size:13px;
  }

  .energy-options {
    display:flex; flex-direction:column; gap:6px; padding:6px 0 10px 0;
  }
  .energy-chip {
    display:flex; flex-direction:column; align-items:flex-start;
    padding:8px 12px; border-radius:8px; border:1.5px solid var(--border);
    background:var(--bg); color:var(--text); cursor:pointer; text-align:left;
  }
  .energy-chip.active {
    border-color:var(--primary);
    background:color-mix(in srgb, var(--primary) 8%, var(--bg));
  }
  .energy-label { font-size:13px; font-weight:600; }
  .energy-desc { font-size:11px; color:var(--muted); margin-top:1px; }

  @media (max-width: 768px) {
    .num-input { min-height: 44px; }
    input[type='range'] { min-height: 44px; }
  }
</style>
