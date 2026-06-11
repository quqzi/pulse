/** Frame values from 0 → target with cubic ease-out spacing. Pure — testable. */
export function countupFrames(target: number, steps: number, decimals = 0): number[] {
  const f = Math.pow(10, decimals);
  const frames: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    frames.push(Math.round(target * eased * f) / f);
  }
  return frames;
}

interface CountupOpts { value: number; decimals?: number; durationMs?: number }

/** Svelte action: animate the element's text from 0 to `value` on mount/update. */
export function countup(node: HTMLElement, opts: CountupOpts) {
  let raf = 0;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function run({ value, decimals = 0, durationMs = 600 }: CountupOpts) {
    cancelAnimationFrame(raf);
    if (reduced || value === 0) { node.textContent = value.toFixed(decimals); return; }
    const frames = countupFrames(value, Math.max(1, Math.round(durationMs / 16)), decimals);
    let i = 0;
    const tick = () => {
      node.textContent = frames[i].toFixed(decimals);
      if (++i < frames.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  run(opts);
  return {
    update(next: CountupOpts) { run(next); },
    destroy() { cancelAnimationFrame(raf); },
  };
}
