import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: k => memory.delete(k),
}

const { parseDurations, formatDuration, formatRemaining, Timers } = await import('./timers.js')

beforeEach(() => memory.clear())

test('durées détectées dans le texte des étapes', () => {
  assert.deepEqual(parseDurations('Fais-le cuire 12 min, puis égoutte.'), [{ seconds: 720, label: '12 min' }])
  assert.deepEqual(parseDurations('Enfourne 1 h 15.'), [{ seconds: 4500, label: '1 h 15' }])
  assert.deepEqual(parseDurations('Cuire 2 heures.'), [{ seconds: 7200, label: '2 h' }])
  assert.deepEqual(parseDurations('Remue 30 secondes.'), [{ seconds: 30, label: '30 s' }])
})

test('plusieurs durées dans une même étape, dans l’ordre', () => {
  assert.deepEqual(
    parseDurations('Remue 1 min. Laisse mijoter 5 min à feu doux.'),
    [{ seconds: 60, label: '1 min' }, { seconds: 300, label: '5 min' }]
  )
})

test('une fourchette retient la borne basse (on peut toujours rallonger)', () => {
  assert.deepEqual(parseDurations('Fais dorer 4 à 5 min.'), [{ seconds: 240, label: '4 min' }])
})

test('les températures ne sont pas prises pour des durées', () => {
  assert.deepEqual(parseDurations('Préchauffe le four à 160 °C.'), [])
  assert.deepEqual(parseDurations('Enfourne à 180 °C pendant 25 min.'), [{ seconds: 1500, label: '25 min' }])
})

test('ni les quantités ni les mots commençant par s', () => {
  assert.deepEqual(parseDurations('Ajoute 1 sachet de levure et 200 g de farine.'), [])
  assert.deepEqual(parseDurations('Verse 20 cl de crème.'), [])
})

test('mise en forme des durées et du décompte', () => {
  assert.equal(formatDuration(45), '45 s')
  assert.equal(formatDuration(90), '1 min 30')
  assert.equal(formatDuration(3600), '1 h')
  assert.equal(formatDuration(5400), '1 h 30')
  assert.equal(formatRemaining(65000), '01:05')
  assert.equal(formatRemaining(3661000), '1:01:01')
  assert.equal(formatRemaining(-500), '00:00')
})

test('plusieurs minuteurs tournent en parallèle', () => {
  const t = new Timers()
  t.add('Riz', 600, 'Curry')
  t.add('Sauce', 300, 'Curry')
  assert.equal(t.running.length, 2)
  assert.equal(t.finished.length, 0)
})

test('un minuteur échu passe en terminé et ne sonne qu’une fois', () => {
  const t = new Timers()
  const timer = t.add('Riz', 60)
  timer.endsAt = Date.now() - 1000
  assert.equal(t.finished.length, 1)
  assert.equal(t.takeNewlyFinished().length, 1)
  assert.equal(t.takeNewlyFinished().length, 0, 'ne sonne pas deux fois')
})

test('rallonger un minuteur le remet en marche', () => {
  const t = new Timers()
  const timer = t.add('Gratin', 60)
  timer.endsAt = Date.now() - 1000
  t.takeNewlyFinished()
  t.addTime(timer.id, 120)
  assert.equal(t.running.length, 1)
  assert.ok(t.remaining(timer) > 100000)
})

test('les minuteurs survivent à un rechargement', () => {
  const t = new Timers()
  t.add('Riz', 600)
  const rechargé = new Timers()
  assert.equal(rechargé.running.length, 1)
  assert.equal(rechargé.list[0].label, 'Riz')
})

test('suppression ciblée et nettoyage des terminés', () => {
  const t = new Timers()
  const a = t.add('A', 600)
  const b = t.add('B', 60)
  b.endsAt = Date.now() - 1000
  t.clearFinished()
  assert.equal(t.list.length, 1)
  t.remove(a.id)
  assert.equal(t.list.length, 0)
})
