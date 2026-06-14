<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, type Theme } from '$lib/stores/settings';
  import { auth } from '$lib/stores/auth';
  import { subjects, loadData } from '$lib/stores/data';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { LATEST_VERSION } from '$lib/changelog';
  import { canInstall, isInstalled, promptInstall, installPlatform } from '$lib/pwa';
  import {
    notificationsSupported, requestNotificationPermission, notificationPermission, sendTestNotification,
  } from '$lib/notifications';
  import { toast } from '$lib/stores/toast';
  import ProfileSheet from '$lib/components/ProfileSheet.svelte';
  import InstallSheet from '$lib/components/InstallSheet.svelte';

  let profileOpen = false;
  let installSheetOpen = false;

  $: instPlatform = installPlatform($canInstall, $isInstalled);
  // Show an install entry whenever the device can install and isn't already installed.
  $: showInstall = instPlatform !== 'none';

  function handleInstall() {
    if (instPlatform === 'prompt') void promptInstall();
    else installSheetOpen = true;
  }

  async function toggleNotifications(on: boolean) {
    if (!on) { $settings.notifyEnabled = false; return; }
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      $settings.notifyEnabled = true;
      sendTestNotification();
      toast.success($t.notifications.enabled);
    } else {
      $settings.notifyEnabled = false;
      toast.error($t.notifications.blocked);
    }
  }

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  function setWeight(subjectId: string, w: number) {
    settings.update(s => ({ ...s, subjectWeights: { ...s.subjectWeights, [subjectId]: w } }));
  }

  const themeBase = [
    { value:'vercel-light' as Theme, label:'Vercel', lightDark: 'light', bg:'#fafafa', text:'#171717', card:'#ffffff', accent:'#0070f3', radius:'8px'  },
    { value:'vercel-dark'  as Theme, label:'Vercel', lightDark: 'dark',  bg:'#0a0a0a', text:'#ededed', card:'#1a1a1a', accent:'#3291ff', radius:'8px'  },
    { value:'apple-light'  as Theme, label:'Apple',  lightDark: 'light', bg:'#f5f5f7', text:'#1d1d1f', card:'#ffffff', accent:'#0066cc', radius:'18px' },
    { value:'apple-dark'   as Theme, label:'Apple',  lightDark: 'dark',  bg:'#000000', text:'#f2f2f7', card:'#1c1c1e', accent:'#2997ff', radius:'18px' },
    { value:'resend'       as Theme, label:'Resend', lightDark: 'dark',  bg:'#000000', text:'#fcfdff', card:'#0a0a0c', accent:'#3b9eff', radius:'12px' },
  ];
  $: themes = themeBase.map(tp => ({ ...tp, sub: tp.lightDark === 'light' ? $t.settings.light : $t.settings.dark }));

  async function signOut() {
    await supabase.auth.signOut();
    goto('/auth/login');
  }
</script>

<div class="page-enter">
  <h1 class="text-large-title" style="margin-bottom:24px">{$t.settings.title}</h1>

  <p class="section-label">{$t.settings.appearance}</p>
  <div class="card section-card">
    <p style="font-size:14px;font-weight:600;margin-bottom:12px">{$t.settings.theme}</p>
    <div class="theme-grid">
      {#each themes as tp}
        <button
          class="theme-card"
          class:selected={$settings.theme === tp.value}
          style="--t-bg:{tp.bg};--t-text:{tp.text};--t-card:{tp.card};--t-accent:{tp.accent};--t-radius:{tp.radius}"
          on:click={() => settings.update(s => ({ ...s, theme: tp.value }))}
        >
          <div class="tc-preview">
            <div class="tc-card">
              <div class="tc-line long"  style="background:{tp.text};opacity:.8"></div>
              <div class="tc-line short" style="background:{tp.text};opacity:.4"></div>
              <div class="tc-btn"        style="background:{tp.accent}"></div>
            </div>
          </div>
          <div class="tc-label">{tp.label}</div>
          <div class="tc-sub">{tp.sub}</div>
          {#if $settings.theme === tp.value}
            <span class="tc-check" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <div class="card section-card" style="margin-top:8px">
    <div class="setting-row">
      <span class="text-body">{$t.settings.language}</span>
      <div class="lang-pills">
        <button class="lang-pill" class:active={$settings.lang === 'en'}
          on:click={() => settings.update(s => ({ ...s, lang: 'en' }))}>English</button>
        <button class="lang-pill" class:active={$settings.lang === 'th'}
          on:click={() => settings.update(s => ({ ...s, lang: 'th' }))}>ไทย</button>
      </div>
    </div>
  </div>

  <p class="section-label" style="margin-top:20px">{$t.settings.study}</p>
  <div class="card section-card">
    <div class="setting-row">
      <span class="text-body">{$t.settings.dailyGoal}</span>
      <div class="row-right">
        <input type="number" min="1" max="12" step="0.5" value={$settings.dailyGoalHours}
          on:change={e => settings.update(s => ({ ...s, dailyGoalHours: +e.currentTarget.value }))}
          class="num-input" aria-label={$t.settings.dailyGoal} />
        <span class="text-muted text-body">{$t.settings.hPerDay}</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.readinessTarget}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.readinessTargetHelper}</span>
      </div>
      <input type="number" min="1" max="200" value={$settings.readinessHoursTarget}
        on:change={e => settings.update(s => ({ ...s, readinessHoursTarget: Math.max(1, +e.currentTarget.value || 20) }))}
        class="num-input" aria-label={$t.settings.readinessTarget} />
    </div>
    <div class="divider"></div>
    <div class="setting-row">
      <span class="text-body">{$t.settings.pomodoroWork}</span>
      <div class="row-right">
        <input type="number" min="5" max="60" step="5" value={$settings.pomodoroWork}
          on:change={e => settings.update(s => ({ ...s, pomodoroWork: +e.currentTarget.value }))}
          class="num-input" aria-label={$t.settings.pomodoroWork} />
        <span class="text-muted text-body">{$t.common.minutes}</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="setting-row">
      <span class="text-body">{$t.settings.pomodoroBreak}</span>
      <div class="row-right">
        <input type="number" min="1" max="30" value={$settings.pomodoroBreak}
          on:change={e => settings.update(s => ({ ...s, pomodoroBreak: +e.currentTarget.value }))}
          class="num-input" aria-label={$t.settings.pomodoroBreak} />
        <span class="text-muted text-body">{$t.common.minutes}</span>
      </div>
    </div>
  </div>

  <p class="section-label" style="margin-top:20px">{$t.settings.calendarScheduling}</p>
  <div class="card section-card">
    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.schoolHours}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.schoolHoursHelper}</span>
      </div>
      <label class="toggle">
        <input type="checkbox" bind:checked={$settings.schoolHoursEnabled} />
        <span class="toggle-track"></span>
      </label>
    </div>

    {#if $settings.schoolHoursEnabled}
      <div class="school-hours-config">
        <div class="day-picker">
          {#each $t.settings.weekdays as dayLabel, i}
            <button
              class="day-chip"
              class:active={$settings.schoolDays.includes(i + 1)}
              on:click={() => {
                const v = i + 1;
                const days = $settings.schoolDays.includes(v)
                  ? $settings.schoolDays.filter(d => d !== v)
                  : [...$settings.schoolDays, v];
                settings.update(s => ({ ...s, schoolDays: days }));
              }}
            >{dayLabel}</button>
          {/each}
        </div>
        <div class="time-row">
          <label class="time-field">
            <span>{$t.settings.from}</span>
            <input type="time" bind:value={$settings.schoolStart} />
          </label>
          <label class="time-field">
            <span>{$t.settings.to}</span>
            <input type="time" bind:value={$settings.schoolEnd} />
          </label>
        </div>
      </div>
    {/if}

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.energyProfile}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.energyProfileHelper}</span>
      </div>
    </div>
    <div class="energy-options">
      {#each [['morning', $t.settings.energyMorningLabel, $t.settings.energyMorningDesc], ['neutral', $t.settings.energyNeutralLabel, $t.settings.energyNeutralDesc], ['evening', $t.settings.energyEveningLabel, $t.settings.energyEveningDesc]] as [val, label, desc] (val)}
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
        <span class="text-body">{$t.settings.buffer}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.bufferHelper($settings.bufferMinutes)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="30"
        step="5"
        bind:value={$settings.bufferMinutes}
        style="width:100px"
        aria-label={$t.settings.buffer}
      />
    </div>

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.studyWindow}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.studyWindowHelper}</span>
      </div>
      <div class="time-row">
        <input type="time" class="time-input" bind:value={$settings.studyStart} aria-label={$t.settings.from} />
        <span class="text-muted">–</span>
        <input type="time" class="time-input" bind:value={$settings.studyEnd} aria-label={$t.settings.to} />
      </div>
    </div>

    <div class="divider"></div>

    <div class="setting-row">
      <span class="text-body">{$t.settings.blockLength}</span>
      <div class="lang-pills">
        {#each [45, 60, 90] as len (len)}
          <button class="lang-pill" class:active={$settings.blockMinutes === len}
            on:click={() => settings.update(s => ({ ...s, blockMinutes: len }))}>{len}{$t.common.minutes}</button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.maxPerDay}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.maxPerDayHelper}</span>
      </div>
      <input type="number" min="0" max="8" value={$settings.maxBlocksPerDay}
        on:change={e => settings.update(s => ({ ...s, maxBlocksPerDay: Math.max(0, +e.currentTarget.value) }))}
        class="num-input" aria-label={$t.settings.maxPerDay} />
    </div>

    <div class="divider"></div>

    <div class="setting-row">
      <div class="setting-info">
        <span class="text-body">{$t.settings.restDays}</span>
        <span class="text-muted" style="font-size:13px">{$t.settings.restDaysHelper}</span>
      </div>
    </div>
    <div class="day-picker" style="padding-bottom:12px">
      {#each $t.settings.weekdays as dayLabel, i (i)}
        <button
          class="day-chip"
          class:active={$settings.restDays.includes(i + 1)}
          on:click={() => {
            const v = i + 1;
            const days = $settings.restDays.includes(v)
              ? $settings.restDays.filter(d => d !== v)
              : [...$settings.restDays, v];
            settings.update(s => ({ ...s, restDays: days }));
          }}
        >{dayLabel}</button>
      {/each}
    </div>

    {#if $subjects.length > 0}
      <div class="divider"></div>
      <div class="setting-row">
        <div class="setting-info">
          <span class="text-body">{$t.settings.subjectPriority}</span>
          <span class="text-muted" style="font-size:13px">{$t.settings.subjectPriorityHelper}</span>
        </div>
      </div>
      <div class="prio-list">
        {#each $subjects as subj (subj.id)}
          {@const w = $settings.subjectWeights[subj.id] ?? 1}
          <div class="prio-row">
            <span class="prio-dot" style="background:{subj.color}"></span>
            <span class="prio-name">{subj.name}</span>
            <div class="lang-pills">
              <button class="lang-pill sm" class:active={w === 0.5} on:click={() => setWeight(subj.id, 0.5)}>{$t.settings.prioLow}</button>
              <button class="lang-pill sm" class:active={w === 1} on:click={() => setWeight(subj.id, 1)}>{$t.settings.prioNormal}</button>
              <button class="lang-pill sm" class:active={w === 2} on:click={() => setWeight(subj.id, 2)}>{$t.settings.prioHigh}</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if $auth.mode === 'authenticated'}
    <p class="section-label" style="margin-top:20px">{$t.settings.account}</p>
    <div class="card section-card">
      <button class="setting-row" on:click={() => (profileOpen = true)}>
        <span class="text-body">{$t.settings.profile}</span>
        <span class="row-right text-muted">{$auth.name} ›</span>
      </button>
      <div class="divider"></div>
      <div class="setting-row">
        <span class="text-body text-muted">{$t.settings.signedInAs}</span>
        <span class="text-body">{$auth.user?.email}</span>
      </div>
      <div class="divider"></div>
      <button class="setting-row sign-out" on:click={signOut}>
        <span style="color:var(--danger);font-size:15px">{$t.settings.signOut}</span>
      </button>
    </div>
  {:else}
    <p class="section-label" style="margin-top:20px">{$t.settings.account}</p>
    <div class="card section-card">
      <button class="setting-row" on:click={() => (profileOpen = true)}>
        <span class="text-body">{$t.settings.displayName}</span>
        <span class="row-right text-muted">{$auth.name} ›</span>
      </button>
      <div class="divider"></div>
      <div class="setting-row">
        <span class="text-body text-muted">{$t.settings.mode}</span>
        <span class="text-body">{$t.settings.guest}</span>
      </div>
      <div class="divider"></div>
      <a href="/auth/signup" class="setting-row" style="text-decoration:none">
        <span style="color:var(--primary);font-size:15px;font-weight:600">{$t.settings.createAccount}</span>
      </a>
    </div>
  {/if}

  {#if notificationsSupported()}
    <p class="section-label" style="margin-top:20px">{$t.notifications.title}</p>
    <div class="card section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="text-body">{$t.notifications.enable}</span>
          <span class="text-muted" style="font-size:13px">{$t.notifications.enableDesc}</span>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            checked={$settings.notifyEnabled}
            on:change={(e) => toggleNotifications(e.currentTarget.checked)}
          />
          <span class="toggle-track"></span>
        </label>
      </div>

      {#if $notificationPermission === 'denied'}
        <div class="divider"></div>
        <p class="text-muted" style="font-size:13px;padding:10px 0">{$t.notifications.blocked}</p>
      {:else if $settings.notifyEnabled}
        <div class="divider"></div>
        <div class="setting-row">
          <span class="text-body">{$t.notifications.blockStart}</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={$settings.notifyBlockStart} />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="divider"></div>
        <div class="setting-row">
          <span class="text-body">{$t.notifications.daily}</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={$settings.notifyDaily} />
            <span class="toggle-track"></span>
          </label>
        </div>
        {#if $settings.notifyDaily}
          <div class="setting-row" style="padding-top:0">
            <span class="text-muted" style="font-size:13px">{$t.notifications.dailyTime}</span>
            <input type="time" class="time-input" bind:value={$settings.notifyDailyTime} aria-label={$t.notifications.dailyTime} />
          </div>
        {/if}
        <div class="divider"></div>
        <div class="setting-row">
          <span class="text-body">{$t.notifications.tasksDue}</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={$settings.notifyTasksDue} />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="divider"></div>
        <div class="setting-row">
          <span class="text-body">{$t.notifications.streak}</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={$settings.notifyStreak} />
            <span class="toggle-track"></span>
          </label>
        </div>
      {/if}
    </div>
  {/if}

  <p class="section-label" style="margin-top:20px">{$t.settings.about}</p>
  <div class="card section-card">
    {#if showInstall}
      <button class="setting-row" on:click={handleInstall}>
        <span class="text-body">{$t.pwa.installTitle}</span>
        <span class="row-right text-primary">{instPlatform === 'prompt' ? $t.pwa.install : $t.pwa.howTo} ›</span>
      </button>
      <div class="divider"></div>
    {/if}
    <a href="/guide" class="setting-row" style="text-decoration:none">
      <span class="text-body">{$t.settings.userGuide}</span>
      <span class="row-right text-muted">›</span>
    </a>
    <div class="divider"></div>
    <a href="/changelog" class="setting-row" style="text-decoration:none">
      <span class="text-body">{$t.pwa.whatsNew}</span>
      <span class="row-right text-muted">v{LATEST_VERSION} ›</span>
    </a>
  </div>
</div>

<InstallSheet bind:open={installSheetOpen} platform={instPlatform} />

<ProfileSheet bind:open={profileOpen} />

<style>
  .section-card { padding:6px 16px; }
  /* Button rows inherit the UA `buttontext` colour, which ignores the theme —
     pin it to --text so "Display name"/"What's new" labels match every theme. */
  .setting-row { display:flex; align-items:center; justify-content:space-between; padding:13px 0; gap:12px; background:none; border:none; width:100%; font-family:inherit; color:var(--text); text-align:left; }
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
  .lang-pill:hover:not(.active) { border-color:var(--muted); color:var(--text); }
  .lang-pill.active { border-color:var(--primary); background:var(--primary-l); color:var(--primary); }
  @media (max-width: 768px) { .lang-pill { min-height: 44px; } }

  .theme-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  @media (max-width:360px) { .theme-grid { grid-template-columns:repeat(2,1fr); } }

  .theme-card {
    position:relative;
    border:2px solid var(--border); border-radius:var(--radius-md);
    background:var(--t-bg); cursor:pointer; padding:10px 8px 8px;
    transition:border-color 120ms ease, transform var(--dur-base) var(--ease-spring), box-shadow 160ms ease;
    text-align:center;
  }
  .theme-card:hover { transform:translateY(-2px) scale(1.03); }
  .theme-card:active { transform:scale(0.97); transition-duration:var(--dur-fast); }
  .theme-card.selected {
    border-color:var(--t-accent);
    box-shadow:0 0 0 3px color-mix(in srgb, var(--t-accent) 22%, transparent);
  }
  .tc-check {
    position:absolute; top:6px; right:6px;
    width:18px; height:18px; border-radius:50%;
    background:var(--t-accent); color:var(--t-bg);
    display:flex; align-items:center; justify-content:center;
  }

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
    width:44px; height:26px; border-radius:999px; background:var(--border);
    position:relative; transition:background 200ms ease;
  }
  .toggle-track::after {
    content:''; position:absolute; top:2px; left:2px;
    width:22px; height:22px; border-radius:50%; background:white; /* stylelint-disable-line color-named */
    box-shadow:0 1px 3px rgba(0,0,0,0.25);
    transition:transform 320ms var(--ease-spring);
  }
  .toggle input:checked + .toggle-track { background:var(--primary); }
  .toggle input:checked + .toggle-track::after { transform:translateX(18px); }

  /* iOS-style range slider — accent thumb on a hairline track. */
  input[type='range'] {
    appearance:none; -webkit-appearance:none;
    height:4px; border-radius:2px; background:var(--border); outline:none;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance:none; -webkit-appearance:none;
    width:18px; height:18px; border-radius:50%; background:var(--primary);
    box-shadow:0 1px 4px rgba(0,0,0,0.25); cursor:pointer;
    transition:transform var(--dur-base) var(--ease-spring);
  }
  input[type='range']::-webkit-slider-thumb:hover { transform:scale(1.15); }
  input[type='range']::-moz-range-thumb {
    width:18px; height:18px; border:none; border-radius:50%; background:var(--primary);
    box-shadow:0 1px 4px rgba(0,0,0,0.25); cursor:pointer;
  }

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
  .day-chip:hover:not(.active) { border-color:var(--muted); }
  .day-chip.active { background:var(--primary); border-color:var(--primary); color:var(--bg); }
  .time-row { display:flex; gap:8px; align-items:center; }
  .time-input {
    border:1px solid var(--border); border-radius:6px; padding:4px 8px;
    background:var(--bg); color:var(--text); font-size:13px; font-family:inherit;
  }
  .lang-pill.sm { padding:5px 10px; font-size:12px; min-height:32px; }
  .prio-list { display:flex; flex-direction:column; gap:8px; padding:2px 0 12px; }
  .prio-row { display:flex; align-items:center; gap:8px; }
  .prio-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .prio-name { flex:1; min-width:0; font-size:14px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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
  .energy-chip:hover:not(.active) { border-color:var(--muted); }
  .energy-chip.active {
    border-color:var(--primary);
    background:color-mix(in srgb, var(--primary) 8%, var(--bg));
  }
  .sign-out:hover span { filter:brightness(1.1); }
  .energy-label { font-size:13px; font-weight:600; }
  .energy-desc { font-size:11px; color:var(--muted); margin-top:1px; }

  @media (max-width: 768px) {
    .num-input { min-height: 44px; }
    input[type='range'] { min-height: 44px; }
  }
</style>
