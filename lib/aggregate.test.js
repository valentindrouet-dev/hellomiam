import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateIngredients, extraToLine } from './aggregate.js'

const recette = (title, servings, ingredients) => ({ title, servings, ingredients })

test('fusionne le même ingrédient entre deux recettes', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: 'Oignon', qty: 1, unit: 'pièce', dept: 'fruits-legumes' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: 'Oignons', qty: 2, unit: 'pièce', dept: 'fruits-legumes' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines.length, 1)
  assert.equal(lines[0].qty, 3)
  assert.deepEqual(lines[0].sources, ['A', 'B'])
})

test('convertit g et kg vers une même ligne', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: 'Farine', qty: 300, unit: 'g', dept: 'epicerie' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: 'Farine', qty: 0.5, unit: 'kg', dept: 'epicerie' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines.length, 1)
  assert.equal(lines[0].baseQty, 800)
  assert.equal(lines[0].text, '800 g')
})

test('applique le facteur adultes + enfants de chaque recette', () => {
  const lines = aggregateIngredients([
    // 2 adultes + 3 enfants = 4 parts pour une recette prévue pour 2 → ×2
    { recipe: recette('A', 2, [{ name: 'Riz', qty: 150, unit: 'g', dept: 'epicerie' }]), adults: 2, children: 3 },
  ])
  assert.equal(lines[0].baseQty, 300)
  assert.equal(lines[0].text, '300 g')
})

test('les cuillères fusionnent avec les volumes', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: "Huile d'olive", qty: 2, unit: 'c. à soupe', dept: 'epicerie' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: "Huile d'olive", qty: 5, unit: 'cl', dept: 'epicerie' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines.length, 1)
  assert.equal(lines[0].baseQty, 80) // 30 ml + 50 ml
  assert.equal(lines[0].text, '80 ml')
})

test('une seule unité rencontrée : elle est conservée', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: 'Crème fraîche', qty: 10, unit: 'cl', dept: 'cremerie' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: 'Crème fraîche', qty: 10, unit: 'cl', dept: 'cremerie' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines[0].text, '20 cl')
})

test('sel "selon goût" ne casse pas l’agrégation', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: 'Sel', qty: null, unit: null, dept: 'epicerie' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: 'Sel', qty: null, unit: null, dept: 'epicerie' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines.length, 1)
  assert.equal(lines[0].qty, null)
  assert.equal(lines[0].text, 'selon goût')
})

test('des unités comptables différentes restent séparées', () => {
  const lines = aggregateIngredients([
    { recipe: recette('A', 2, [{ name: 'Ail', qty: 2, unit: 'gousse', dept: 'fruits-legumes' }]), adults: 2, children: 0 },
    { recipe: recette('B', 2, [{ name: 'Ail', qty: 1, unit: 'pièce', dept: 'fruits-legumes' }]), adults: 2, children: 0 },
  ])
  assert.equal(lines.length, 2)
})

test('extraToLine : article libre avec et sans quantité', () => {
  const lait = extraToLine({ id: 'x', name: 'Lait', qty: 2, unit: 'l', dept: 'cremerie', checked: false })
  assert.equal(lait.family, 'vol')
  assert.equal(lait.baseQty, 2000)
  const eponge = extraToLine({ id: 'y', name: 'Éponges', qty: null, unit: null, dept: 'autres', checked: true })
  assert.equal(eponge.hasNull, true)
  assert.equal(eponge.checked, true)
})
