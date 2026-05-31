/** Bulk localStorage helpers for the guest path. Mirrors the localAdapter's JSON guard. */
export function lsRead<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export function lsWrite<T>(key: string, items: T[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
}
