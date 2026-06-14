// Shared PWA install state. `beforeinstallprompt` fires once and can only be
// replayed once, so we capture it centrally and let both the install banner and
// the Settings button drive it.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** True once the browser has offered an install prompt we can replay. */
export const canInstall = writable(false);
/** True when already running as an installed / standalone app. */
export const isInstalled = writable(false);

let inited = false;

/** Wire the install listeners once, client-side, from the root layout. */
export function initPwaInstall(): void {
  if (!browser || inited) return;
  inited = true;

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) isInstalled.set(true);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we offer our own UI
    deferredPrompt = e as BeforeInstallPromptEvent;
    canInstall.set(true);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    canInstall.set(false);
    isInstalled.set(true);
  });
}

/** Replay the saved install prompt. Returns the user's choice (or 'unavailable'). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  canInstall.set(false);
  return outcome;
}

export type InstallPlatform = 'prompt' | 'ios' | 'manual' | 'none';

/**
 * How this device installs the PWA:
 * - 'prompt' — a native install prompt is ready (Android/desktop Chromium)
 * - 'ios'    — iOS Safari: manual "Share → Add to Home Screen"
 * - 'manual' — other mobile browser: install from the browser menu
 * - 'none'   — already installed, or a desktop browser with no prompt
 */
export function installPlatform(canPrompt: boolean, installed: boolean): InstallPlatform {
  if (installed) return 'none';
  if (canPrompt) return 'prompt';
  if (!browser) return 'none';
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as Mac; detect via touch.
    (/Macintosh/.test(ua) && 'ontouchend' in window);
  if (iOS) return 'ios';
  if (/android|mobile/i.test(ua)) return 'manual';
  return 'none';
}
