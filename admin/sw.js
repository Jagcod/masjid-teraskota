// Service Worker for Admin Masjid Teraskota PWA (WebAPK)
const CACHE_NAME = 'admin-teraskota-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Network-first fetch strategy with safe bypass for real-time Firebase services
self.addEventListener('fetch', (event) => {
    // Only handle HTTP/HTTPS GET requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    // Always bypass Firebase API, Firestore, and Auth calls so sync is never disrupted
    const url = new URL(event.request.url);
    if (
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('firestore')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

