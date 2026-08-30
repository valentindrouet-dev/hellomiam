// Service worker HelloMiam : l'appli s'ouvre et se consulte même sans réseau
// (dernières recettes et prix connus) ; les écritures nécessitent le réseau.
const CACHE = 'hellomiam-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/'])))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Navigation : réseau d'abord, sinon la coquille en cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          caches.open(CACHE).then(c => c.put('/', res.clone())).catch(() => {})
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Données : réseau d'abord, cache en secours (consultation hors-ligne).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone())).catch(() => {})
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Assets (fichiers hachés, photos) : cache d'abord.
  event.respondWith(
    caches.match(request).then(cached =>
      cached ||
      fetch(request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone())).catch(() => {})
        return res
      })
    )
  )
})
