const CACHE_NAME = 'octave-v2';
const APP_ASSETS = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/js/player.js',
    '/js/algorithm.js',
    '/logo.png'
];

// Install the service worker and cache the app files
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Forces the new service worker to activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Soft caching so one missing file doesn't crash the whole PWA install
            return Promise.allSettled(APP_ASSETS.map(url => cache.add(url)));
        })
    );
});

// Network First, Fallback to Cache strategy
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// Clean up old caches if we update the app
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
});
