<!--
  Ambient animated background for the app shell: a few soft, slowly-drifting
  colour blobs from the subject palette + a fine grain overlay ("grainy gradient").
  Pure CSS — no JS loop, GPU-composited transforms only. Sits behind all content
  (cards stay opaque, so text contrast is unaffected). Honors prefers-reduced-motion
  via the global guard in app.css; with motion off the blobs simply hold still.
-->
<div class="aurora" aria-hidden="true">
  <span class="blob b1"></span>
  <span class="blob b2"></span>
  <span class="blob b3"></span>
  <span class="grain"></span>
</div>

<style>
  .aurora {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }

  .blob {
    position: absolute;
    width: 46vmax;
    height: 46vmax;
    border-radius: 50%;
    filter: blur(56px);
    will-change: transform;
  }

  /* Colours come from the per-theme aurora palette → cohesive with each accent. */
  .b1 {
    top: -12vmax;
    left: -8vmax;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--aurora-1) 62%, transparent), transparent 70%);
    animation: drift1 26s ease-in-out infinite;
  }
  .b2 {
    bottom: -14vmax;
    right: -10vmax;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--aurora-2) 58%, transparent), transparent 70%);
    animation: drift2 32s ease-in-out infinite;
  }
  .b3 {
    bottom: -6vmax;
    left: 18vmax;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--aurora-3) 55%, transparent), transparent 70%);
    animation: drift3 38s ease-in-out infinite;
  }

  /* Fine static noise so the gradient reads as a grainy wash, not a flat blur. */
  .grain {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.10;
    mix-blend-mode: overlay;
  }

  /* Overall intensity — "not too much", tuned per theme. */
  .aurora { opacity: 0.55; }
  :global(body:not(.theme-dark)) .aurora { opacity: 0.42; }
  :global(body.design-resend) .aurora { opacity: 0.34; }

  @keyframes drift1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(8vmax, 6vmax) scale(1.15); }
  }
  @keyframes drift2 {
    0%, 100% { transform: translate(0, 0) scale(1.1); }
    50%      { transform: translate(-7vmax, -5vmax) scale(1); }
  }
  @keyframes drift3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(5vmax, -8vmax) scale(1.2); }
  }
</style>
