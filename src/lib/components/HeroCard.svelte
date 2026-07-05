<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  export let todayHours: number = 0;
  export let goalHours: number = 4;
  export let streak: number = 0;
  export let editable: boolean = false;

  const dispatch = createEventDispatcher<{ goalChange: number }>();

  let editing = false;
  let draft = goalHours;

  $: pct = goalHours > 0 ? Math.min(1, todayHours / goalHours) : 0;
  $: hoursDisplay = todayHours.toFixed(1);

  function startEdit() {
    draft = goalHours;
    editing = true;
  }

  function commit() {
    if (!editing) return;
    editing = false;
    if (draft > 0 && draft !== goalHours) dispatch('goalChange', draft);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') editing = false;
  }

  function autofocus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

<div class="hero-card">
  <div class="hero-top">
    <div>
      <div class="hero-label">{$t.dashboard.todaysStudy}</div>
      <div class="hero-stat">
        <span class="hero-num">{hoursDisplay}</span>
        {#if editing}
          <input
            class="goal-input"
            type="number" min="0.5" max="24" step="0.5"
            bind:value={draft}
            use:autofocus
            on:blur={commit}
            on:keydown={onKeydown}
            aria-label={$t.dashboard.editGoal}
          />
        {:else if editable}
          <button class="hero-denom denom-btn" on:click={startEdit} aria-label={$t.dashboard.editGoal}>/{goalHours}h ✎</button>
        {:else}
          <span class="hero-denom">/{goalHours}h</span>
        {/if}
      </div>
    </div>
    <div class="hero-streak">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <span class="streak-num">{streak}</span>
      <span class="streak-label">{$t.dashboard.streak}</span>
    </div>
  </div>
  <div class="progress-track">
    <div class="progress-fill" style="transform: scaleX({pct}); transform-origin: left;"></div>
  </div>
  <div class="hero-footer">
    <span>{$t.dashboard.ofDailyGoal(Math.round(pct * 100))}</span>
  </div>
</div>

<style>
  .hero-card {
    background: linear-gradient(140deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 18px;
    padding: 20px 20px 16px;
    color: var(--bg);
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(var(--primary-rgb, 244,63,94), .35);
  }
  .hero-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%);
    animation: shimmer 4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes shimmer {
    0%   { transform: translateX(-100%); }
    40%  { transform: translateX(100%); }
    100% { transform: translateX(100%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-card::after { animation: none; }
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .hero-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    margin-bottom: 4px;
  }
  .hero-stat { display: flex; align-items: baseline; gap: 2px; }
  .hero-num { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .hero-denom { font-size: 16px; font-weight: 500; opacity: 0.75; }
  .denom-btn {
    background: none; border: none; padding: 2px 4px; margin: 0; cursor: pointer;
    color: inherit; font-family: inherit; border-radius: 6px;
    position: relative; z-index: 1;
  }
  .denom-btn:hover { opacity: 1; background: rgba(255,255,255,.15); }
  .goal-input {
    width: 64px; padding: 2px 6px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,.5);
    background: rgba(255,255,255,.15); color: inherit; font-family: inherit;
    font-size: 15px; font-weight: 600; outline: none;
    position: relative; z-index: 1;
  }
  .hero-streak {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .streak-num { font-size: 22px; font-weight: 700; line-height: 1; }
  .streak-label { font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.75; }
  .progress-track {
    height: 6px;
    background: var(--hero-track, rgba(255,255,255,.25));
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .progress-fill {
    height: 100%;
    background: var(--hero-fill, rgba(255,255,255,.9));
    border-radius: 3px;
    transition: transform var(--dur-slow) var(--ease-out);
  }
  .hero-footer { font-size: 12px; opacity: 0.7; }
</style>
