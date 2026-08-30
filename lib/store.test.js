import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Le magasin s'appuie sur localStorage : on en fournit un minimal pour Node.
const memory = new Map()
globalThis.localStorage = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: k => memory.delete(k),
  clear: () => memory.clear(),
}

const { Store, loadHousehold, saveHousehold, loadRemoteConfig, saveRemoteConfig, SUPABASE_SQL, TABLES } =
  await import('./store.js')

beforeEach(() => memory.clear())

test('première ouverture : recettes et prix d’exemple installés', async () => {
  const store = new Store()
  await store.load()
  assert.equal(store.state.recipes.length, 4)
  const categories = new Set(store.state.recipes.map(r => r.category))
  for (const c of ['hellofresh', 'perso', 'resto', 'claude']) assert.ok(categories.has(c), c)
  assert.ok(store.state.prices.length >= 100)
  assert.equal(store.mode, 'local')
  assert.equal(store.isRemote, false)
})

test('les recettes d’exemple passent la validation (id, ingrédients, étapes)', async () => {
  const store = new Store()
  await store.load()
  for (const r of store.state.recipes) {
    assert.ok(r.id, 'id manquant')
    assert.ok(r.title)
    assert.ok(r.ingredients.length > 0)
    assert.ok(r.steps.length > 0)
    assert.ok(Number.isInteger(r.servings) && r.servings > 0)
  }
})

test('cycle de vie d’une recette, persisté entre deux sessions', async () => {
  const store = new Store()
  await store.load()
  const created = await store.addRecipe({
    title: 'Test', category: 'perso', servings: 2, prepMin: 5, cookMin: 10,
    notes: null, photo: null,
    ingredients: [{ name: 'Eau', qty: 1, unit: 'l', dept: 'boissons' }],
    steps: ['Faire bouillir.'],
  })
  assert.ok(created.id)
  assert.equal(store.state.recipes[0].title, 'Test')

  await store.updateRecipe(created.id, { ...created, title: 'Test 2' })
  assert.equal(store.state.recipes.find(r => r.id === created.id).title, 'Test 2')

  // Une nouvelle instance relit le localStorage : rien n'est perdu.
  const reopened = new Store()
  await reopened.load()
  assert.equal(reopened.state.recipes.find(r => r.id === created.id).title, 'Test 2')

  await reopened.deleteRecipe(created.id)
  assert.equal(reopened.state.recipes.some(r => r.id === created.id), false)
})

test('supprimer une recette la retire aussi des courses', async () => {
  const store = new Store()
  await store.load()
  const recipe = store.state.recipes[0]
  await store.setCartRecipe(recipe.id, 2, 2)
  assert.equal(store.state.cart.recipes.length, 1)
  await store.deleteRecipe(recipe.id)
  assert.equal(store.state.cart.recipes.length, 0)
})

test('panier : mise à jour sans doublon, extras et cases cochées', async () => {
  const store = new Store()
  await store.load()
  const recipe = store.state.recipes[0]

  await store.setCartRecipe(recipe.id, 2, 3)
  await store.setCartRecipe(recipe.id, 4, 1)
  assert.equal(store.state.cart.recipes.length, 1)
  assert.deepEqual(
    { a: store.state.cart.recipes[0].adults, c: store.state.cart.recipes[0].children },
    { a: 4, c: 1 }
  )

  const extra = await store.addExtra({ name: 'Éponges', dept: 'autres' })
  await store.updateExtra(extra.id, { checked: true })
  assert.equal(store.state.cart.extras[0].checked, true)

  await store.setChecked('farine|mass', true)
  assert.equal(store.state.cart.checked['farine|mass'], true)
  await store.setChecked('farine|mass', false)
  assert.equal(store.state.cart.checked['farine|mass'], undefined)

  await store.deleteExtra(extra.id)
  await store.clearCart()
  assert.deepEqual(store.state.cart, { recipes: [], extras: [], checked: {} })
})

test('prix : mise à jour par nom, insensible à la casse', async () => {
  const store = new Store()
  await store.load()
  const before = store.state.prices.length

  await store.upsertPrice({ name: 'Yuzu', unit: 'pièce', unitQty: 1, price: 3, dept: 'fruits-legumes', loose: true })
  assert.equal(store.state.prices.length, before + 1)

  await store.upsertPrice({ name: 'yuzu', unit: 'pièce', unitQty: 1, price: 2.5, dept: 'fruits-legumes', loose: true })
  assert.equal(store.state.prices.length, before + 1, 'pas de doublon')
  assert.equal(store.state.prices.find(p => p.name.toLowerCase() === 'yuzu').price, 2.5)

  // Corriger un prix livré avec l'appli ne le duplique pas non plus.
  await store.upsertPrice({ name: 'Farine', unit: 'g', unitQty: 1000, price: 1.4, dept: 'epicerie', loose: false })
  assert.equal(store.state.prices.filter(p => p.name === 'Farine').length, 1)
  assert.equal(store.state.prices.find(p => p.name === 'Farine').price, 1.4)
})

test('foyer mémorisé entre deux sessions', () => {
  assert.deepEqual(loadHousehold(), { adults: 2, children: 0 })
  saveHousehold(3, 2)
  assert.deepEqual(loadHousehold(), { adults: 3, children: 2 })
})

test('configuration de la base commune : normalisation et effacement', () => {
  assert.equal(loadRemoteConfig(), null)
  saveRemoteConfig({ url: 'https://abc.supabase.co/', key: 'cle' })
  assert.deepEqual(loadRemoteConfig(), { url: 'https://abc.supabase.co', key: 'cle' })
  saveRemoteConfig(null)
  assert.equal(loadRemoteConfig(), null)
})

test('export puis réimport d’une sauvegarde', async () => {
  const store = new Store()
  await store.load()
  const dump = JSON.parse(store.exportJson())
  assert.equal(dump.app, 'hellomiam')
  assert.equal(dump.recipes.length, 4)

  memory.clear()
  const fresh = new Store()
  await fresh.load()
  const before = fresh.state.recipes.length
  const imported = await fresh.importBackup(dump)
  assert.equal(imported, 4)
  assert.equal(fresh.state.recipes.length, before + 4)
})

test('le script SQL couvre toutes les tables attendues', () => {
  for (const table of TABLES) {
    assert.ok(SUPABASE_SQL.includes(`create table if not exists ${table}`), `table ${table} absente du SQL`)
    assert.ok(SUPABASE_SQL.includes(`alter table ${table.padEnd(table.length)}`) || SUPABASE_SQL.includes(`alter table ${table}`),
      `RLS non activée pour ${table}`)
  }
})
