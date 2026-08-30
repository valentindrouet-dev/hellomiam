// Service worker HelloMiam : l'appli s'ouvre et fonctionne hors-ligne.
// Tous les chemins sont relatifs pour marcher sous GitHub Pages, où le site
// est servi depuis un sous-dossier (/hellomiam/).

// Le nom du cache suit la version passée à l'enregistrement (sw.js?v=0.04) :
// publier une nouvelle version suffit à renouveler le cache des téléphones.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `hellomiam-${VERSION}`
const IMG_CACHE = `hellomiam-img-${VERSION}`
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
  './lib/tags.js',
  './lib/adjust.js',
  './lib/timers.js',
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
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Photos de recettes hébergées ailleurs : gardées après le premier
  // affichage, pour que la bible reste illustrée hors-ligne. Le reste du
  // trafic externe (Supabase) n'est jamais mis en cache : c'est de la
  // donnée vive.
  if (url.origin !== location.origin) {
    if (request.destination !== 'image') return
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(request).then(hit => {
          if (hit) return hit
          return fetch(request).then(res => {
            // Une réponse opaque (site sans CORS) s'affiche quand même dans
            // une balise <img> : on la garde telle quelle.
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => {})
            return res
          }).catch(() =>
            // Hors-ligne et jamais vue : on répond une erreur propre, l'appli
            // remplace l'image par la pastille de sa catégorie.
            Response.error()
          )
        })
      )
    )
    return
  }

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
