import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { APP_VERSION } from './version.js'

// Ce test existe à cause d'un bug réel : la version vivait uniquement dans le
// paramètre d'URL du service worker, donc sw.js ne changeait jamais d'un
// octet. Le navigateur ne voyait aucune mise à jour à installer, et les
// téléphones restaient bloqués sur l'ancienne version pour toujours.
test('sw.js porte exactement la même version que lib/version.js', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
  const m = /^const VERSION = '([^']+)'$/m.exec(sw)
  assert.ok(m, 'sw.js doit déclarer sa version en dur (const VERSION = \'…\')')
  assert.equal(
    m[1],
    APP_VERSION,
    'sw.js et lib/version.js ont divergé : les téléphones ne recevraient pas la mise à jour'
  )
})

test('la version a une forme exploitable comme nom de cache', () => {
  assert.match(APP_VERSION, /^\d+\.\d+$/)
})

// Autre bug réel : lib/version.js n'était pas dans la liste de précache du
// service worker. Résultat, il était récupéré au vol — donc potentiellement
// depuis le cache HTTP du navigateur, c'est-à-dire l'ANCIENNE version, alors
// que tout le reste de l'appli avait été mis à jour. L'appli affichait un
// numéro de version périmé et pouvait mélanger deux générations de code.
test('tous les modules de lib/ sont précachés par le service worker', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
  const modules = fs.readdirSync(new URL('.', import.meta.url))
    .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))

  const manquants = modules.filter(f => !sw.includes(`'./lib/${f}'`))
  assert.deepEqual(
    manquants, [],
    `modules absents de la liste ASSETS de sw.js : ${manquants.join(', ')} — ils seraient servis depuis le cache HTTP et pourraient rester périmés`
  )
})

test('les fichiers de la coquille sont précachés eux aussi', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
  for (const f of ['./index.html', './app.js', './styles.css', './manifest.webmanifest', './']) {
    assert.ok(sw.includes(`'${f}'`), `${f} absent du précache`)
  }
})
