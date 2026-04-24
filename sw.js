const CACHE_NAME = 'hypecal-cache-v2'; // Naikkan versi untuk memicu update cache

// Daftar lengkap aset lokal dan CDN eksternal yang diwajibkan untuk Offline Mode
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    
    // --- CDN Framework & Library Javascript ---
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/lucide@latest',
    
    // --- CDN Google Fonts ---
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap'
];

// Instalasi Service Worker & Caching Awal (Pre-caching)
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Memaksa SW baru untuk segera aktif
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell & Seluruh CDN Library');
                // Menggunakan Promise.allSettled atau menangkap error per item 
                // agar jika 1 CDN gagal (misal koneksi lambat), cache aset lain tetap berjalan
                return Promise.all(
                    ASSETS_TO_CACHE.map(url => {
                        return cache.add(url).catch(err => console.warn('[Service Worker] Gagal cache:', url, err));
                    })
                );
            })
    );
});

// Aktivasi & Pembersihan Cache Lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Menghapus cache versi lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Strategi Fetch: Cache First untuk CDN, Network First untuk file lokal
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Jika request ada di cache (terutama CDN yang berat), langsung gunakan cache! (Sangat cepat & Offline mantap)
            if (cachedResponse) {
                // Background update (Stale-While-Revalidate) untuk memastikan data tetap segar jika ada internet
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    }
                }).catch(() => {/* Abaikan jika offline */});
                
                return cachedResponse;
            }

            // Jika tidak ada di cache, paksa ambil dari jaringan, lalu simpan ke cache dinamis
            return fetch(event.request)
                .then((networkResponse) => {
                    // Pastikan respons valid sebelum masuk cache
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback jika benar-benar offline dan belum ada cache
                    // Khusus untuk navigasi halaman, kembalikan index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});