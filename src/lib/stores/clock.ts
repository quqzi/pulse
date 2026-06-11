import { readable } from 'svelte/store';
import { browser } from '$app/environment';
import { localDateStr } from '$lib/utils';

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

/** Local date string (YYYY-MM-DD) that ticks over at midnight and on tab re-focus. */
export const todayDate = readable(localDateStr(new Date()), (set) => {
  let timer: ReturnType<typeof setTimeout>;
  const update = () => {
    set(localDateStr(new Date()));
    timer = setTimeout(update, msUntilNextMidnight(new Date()));
  };
  timer = setTimeout(update, msUntilNextMidnight(new Date()));

  const onVisible = () => { if (!document.hidden) set(localDateStr(new Date())); };
  if (browser) document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearTimeout(timer);
    if (browser) document.removeEventListener('visibilitychange', onVisible);
  };
});
