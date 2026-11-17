// Service Worker for Admin Masjid Teraskota PWA (WebAPK)
const CACHE_NAME = 'admin-teraskota-v2';
const STATIC_ASSETS = [
    '/admin',
    '/admin/manifest.json',
    '/admin/icon-192.png',
    '/admin/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((e) => {
                console.warn('[SW] Pre-cache fallback:', e);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((k) => {
                    if (k !== CACHE_NAME) return caches.delete(k);
                })
            );
        }).then(() => self.clients.claim())
    );
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
        fetch(event.request).then((response) => {
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(() => {
            return caches.match(event.request).then((cached) => {
                return cached || caches.match('/admin');
            });
        })
    );
});
