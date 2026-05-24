<script lang="ts">
  export let todayHours: number = 0;
  export let goalHours: number = 4;
  export let streak: number = 0;

  $: pct = Math.min(1, todayHours / goalHours);
  $: hoursDisplay = todayHours.toFixed(1);
</script>

<div class="hero-card">
  <div class="hero-top">
    <div>
      <div class="hero-label">Today's study</div>
      <div class="hero-stat">
        <span class="hero-num">{hoursDisplay}</span>
        <span class="hero-denom">/{goalHours}h</span>
      </div>
    </div>
    <div class="hero-streak">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <span class="streak-num">{streak}</span>
      <span class="streak-label">day streak</span>
    </div>
  </div>
  <div class="progress-track">
    <div class="progress-fill" style="transform: scaleX({pct}); transform-origin: left;"></div>
  </div>
  <div class="hero-footer">
    <span>{Math.round(pct * 100)}% of daily goal</span>
  </div>
</div>

<style>
  .hero-card {
    background: linear-gradient(140deg, var(--primary) 0%, var(--primary-dark) 100%);
    border-radius: 18px;
    padding: 20px 20px 16px;
    color: #fff;
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
    background: rgba(255,255,255,.25);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .progress-fill {
    height: 100%;
    background: rgba(255,255,255,.9);
    border-radius: 3px;
    transition: transform 500ms cubic-bezier(.4,0,.2,1);
  }
  .hero-footer { font-size: 12px; opacity: 0.7; }
</style>
