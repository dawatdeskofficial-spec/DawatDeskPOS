const CACHE_NAME = 'dawatdesk-pos-v2'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dawatdesk_logo.png',
  '/favicon.svg',
  '/favicon.ico',
]

// Install: Pre-cache core app shell and immediately take control
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS)
      } catch (err) {
        console.warn('[ServiceWorker] Some pre-cache assets failed to load:', err)
      }
    })
  )
})

// Activate: Claim clients immediately and purge older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          })
        )
      }),
    ])
  )
})

// Fetch: App shell navigation fallback and dynamic asset caching
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // 1. Never intercept API and health calls (handled by Dexie IndexedDB)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    return
  }

  // 2. Only handle GET requests
  if (req.method !== 'GET') {
    return
  }

  // 3. Navigation requests (SPA routes like /waiter, /chef, /cashier, /restaurant/orders):
  // Return cached index.html so the Vue router can render the offline page
  if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone)
              cache.put('/', networkResponse.clone())
            })
          }
          return networkResponse
        })
        .catch(async () => {
          // Fallback to cached index.html
          const cache = await caches.open(CACHE_NAME)
          const cached =
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            (await cache.match(req))
          if (cached) return cached

          return new Response(
            '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please connect to the internet once to cache the application.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        })
    )
    return
  }

  // 4. Static assets (JS chunks, CSS, fonts, images)
  // Stale-While-Revalidate: return cache first if available, while fetching update in background
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => {
          // If network failed and no cached version exists, return undefined
          return cachedResponse
        })

      return cachedResponse || fetchPromise
    })
  )
})
