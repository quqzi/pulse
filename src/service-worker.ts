/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

// `self` is the service-worker global scope, not Window.
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `pulse-cache-${version}`;
// Built JS/CSS (hashed → safe to cache forever) + static files (icons, manifest).
const PRECACHE = [...build, ...files];
const PRECACHE_SET = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await sw.clients.claim();
    })(),
  );
});

// Tapping a study reminder focuses an open tab, or opens the dashboard.
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) return client.focus();
      }
      return sw.clients.openWindow('/dashboard');
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept cross-origin (Supabase, Google Fonts, …) — let the network handle auth/data.
  if (url.origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Hashed build assets + static files: cache-first (they never change under a version).
      if (PRECACHE_SET.has(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      // Pages / everything else: network-first, fall back to cache when offline.
      try {
        const response = await fetch(request);
        // Only cache successful, same-origin, non-opaque responses.
        if (response.status === 200 && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        // Offline and uncached → fall back to the app shell so the SPA can boot.
        const shell = await cache.match('/dashboard');
        if (shell) return shell;
        return Response.error();
      }
    })(),
  );
});
