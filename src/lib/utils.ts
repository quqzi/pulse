export function formatDuration(sec: number, units: { h: string; m: string } = { h: 'h', m: 'm' }): string {
  if (sec <= 0) return `0${units.m}`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m}${units.m}`;
  if (m === 0) return `${h}${units.h}`;
  return `${h}${units.h} ${m}${units.m}`;
}

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
