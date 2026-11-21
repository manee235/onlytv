// Clean Service Worker that self-destructs and never returns undefined to respondWith
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.claim();
    })
  );
});

// Let all network requests pass through directly without interception
self.addEventListener('fetch', () => {
  // Explicitly do not call event.respondWith() to prevent undefined response errors
});
