import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Base jetable pour ne pas toucher aux vraies données.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hellomiam-test-'))

const db = await import('../src/db.js')

test('les recettes et prix d’exemple sont installés au premier démarrage', () => {
  const recipes = db.listRecipes()
  assert.ok(recipes.length >= 4)
  const categories = new Set(recipes.map(r => r.category))
  for (const c of ['hellofresh', 'perso', 'resto', 'claude']) assert.ok(categories.has(c), c)
  assert.ok(db.listPrices().length >= 100)
})

test('cycle de vie d’une recette', () => {
  const created = db.insertRecipe({
    title: 'Test', category: 'perso', servings: 2,
    prepMin: 5, cookMin: 10, notes: null, photo: null,
    ingredients: [{ name: 'Eau', qty: 1, unit: 'l', dept: 'boissons' }],
    steps: ['Faire bouillir.'],
  })
  assert.ok(created.id)
  assert.equal(created.ingredients[0].name, 'Eau')

  const updated = db.updateRecipe(created.id, { ...created, title: 'Test 2' })
  assert.equal(updated.title, 'Test 2')

  assert.equal(db.deleteRecipe(created.id), true)
  assert.equal(db.getRecipe(created.id), null)
})

test('panier partagé : recettes, extras, cases cochées', () => {
  const recipe = db.listRecipes()[0]
  assert.equal(db.setCartRecipe(recipe.id, 2, 3), true)
  assert.equal(db.setCartRecipe('inexistant', 2, 0), false)

  db.setCartRecipe(recipe.id, 4, 1) // mise à jour, pas de doublon
  let cart = db.getCart()
  assert.equal(cart.recipes.length, 1)
  assert.equal(cart.recipes[0].adults, 4)

  const extra = db.addExtra({ name: 'Éponges', dept: 'autres' })
  db.updateExtra(extra.id, { checked: true })
  db.setChecked('farine|mass', true)
  cart = db.getCart()
  assert.equal(cart.extras[0].checked, true)
  assert.equal(cart.checked['farine|mass'], true)

  db.setChecked('farine|mass', false)
  db.clearCart()
  cart = db.getCart()
  assert.equal(cart.recipes.length, 0)
  assert.equal(cart.extras.length, 0)
})

test('prix : upsert par nom (insensible à la casse)', () => {
  const p1 = db.upsertPrice({ name: 'Yuzu', unit: 'pièce', unitQty: 1, price: 3.0, dept: 'fruits-legumes', loose: false })
  const p2 = db.upsertPrice({ name: 'yuzu', unit: 'pièce', unitQty: 1, price: 2.5, dept: 'fruits-legumes', loose: false })
  assert.equal(p1.id, p2.id)
  assert.equal(p2.price, 2.5)
  assert.equal(db.deletePrice(p2.id), true)
})
