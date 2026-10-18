// voiceai:mobile-pwa-001 — Service Worker for offline shell and push notifications

const CACHE_NAME = 'voiceai-v1'
const SHELL_URLS = [
  '/dashboard',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Network-first for API routes; cache-first for shell
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) {
    // Always network for API
    return
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})

// Push notification handler — fires when a new inbound call starts
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Incoming Call'
  const body = data.body || 'A new inbound call has started.'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url || '/dashboard/calls',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) return client.focus()
      }
      return clients.openWindow(event.notification.data || '/dashboard/calls')
    })
  )
})
