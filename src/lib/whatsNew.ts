import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { LATEST_VERSION } from './changelog';

const KEY = 'pulse.lastSeenChangelog';

export const whatsNewOpen = writable(false);

/** Auto-open the popup once per release (when the latest version hasn't been seen). */
export function maybeShowWhatsNew() {
  if (!browser) return;
  if (localStorage.getItem(KEY) !== LATEST_VERSION) {
    localStorage.setItem(KEY, LATEST_VERSION); // mark seen now → only auto-shows once
    whatsNewOpen.set(true);
  }
}

export function openWhatsNew() {
  whatsNewOpen.set(true);
}

export function closeWhatsNew() {
  whatsNewOpen.set(false);
}
