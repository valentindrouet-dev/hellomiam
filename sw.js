// Service worker HelloMiam : l'appli s'ouvre et fonctionne hors-ligne.
// Tous les chemins sont relatifs pour marcher sous GitHub Pages, où le site
// est servi depuis un sous-dossier (/hellomiam/).

const CACHE = 'hellomiam-v1'
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './lib/constants.js',
  './lib/normalize.js',
  './lib/units.js',
  './lib/portions.js',
  './lib/aggregate.js',
  './lib/pricing.js',
  './lib/validate.js',
  './lib/claudePrompts.js',
  './lib/store.js',
  './lib/seed.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Supabase et tout autre domaine : jamais de cache, c'est de la donnée vive.
  if (url.origin !== location.origin) return

  // Navigation : réseau d'abord (pour récupérer les mises à jour), sinon cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put('./', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    )
    return
  }

  // Fichiers de l'appli : cache d'abord, réseau en secours.
  event.respondWith(
    caches.match(request).then(cached =>
      cached ||
      fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})
        }
        return res
      })
    )
  )
})
