const CACHE_NAME = 'dawatdesk-pos-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dawatdesk_logo.png',
  '/favicon.ico',
]

// Install Event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-caching warning:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch Event: Network-first with Cache Fallback for static assets & App shell navigation
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept API calls in the service worker; Dexie IndexedDB handles API offline caching
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    return
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Navigation requests (HTML pages): Try network first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match('/index.html') || await cache.match('/')
        return cached || new Response('Offline - App Shell not cached yet', { status: 503 })
      })
    )
    return
  }

  // Static assets (JS, CSS, Images, Fonts): Stale-while-revalidate or Network-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})
