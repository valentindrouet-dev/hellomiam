import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveIngredients, effectiveRecipe, adjustmentCount, setSwap, clearSwap, pruneSwaps } from './adjust.js'
import { aggregateIngredients } from './aggregate.js'

const recipe = () => ({
  title: 'Test',
  servings: 2,
  ingredients: [
    { name: 'Coriandre', qty: 0.5, unit: 'botte', dept: 'fruits-legumes' },
    { name: 'Crème fraîche', qty: 10, unit: 'cl', dept: 'cremerie' },
    { name: 'Riz', qty: 150, unit: 'g', dept: 'epicerie' },
  ],
})

test('retirer un ingrédient le fait disparaître', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'Coriandre', null)
  const list = effectiveIngredients(r)
  assert.equal(list.length, 2)
  assert.ok(!list.some(i => i.name === 'Coriandre'))
})

test('remplacer conserve la trace de l’ingrédient d’origine', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'Crème fraîche', { name: 'Crème de soja', qty: 10, unit: 'cl', dept: 'cremerie' })
  const remplace = effectiveIngredients(r).find(i => i.name === 'Crème de soja')
  assert.equal(remplace.replacedFrom, 'Crème fraîche')
  assert.equal(remplace.qty, 10)
})

test('la clé résiste à la casse et au pluriel', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'coriandres', null) // saisi autrement
  assert.equal(effectiveIngredients(r).length, 2)
})

test('annuler un ajustement rétablit l’ingrédient', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'Coriandre', null)
  assert.equal(effectiveIngredients(r).length, 2)
  r.swaps = clearSwap(r, 'Coriandre')
  assert.equal(effectiveIngredients(r).length, 3)
})

test('comptage des ajustements', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'Coriandre', null)
  r.swaps = { ...r.swaps, ...setSwap(r, 'Riz', { name: 'Quinoa', qty: 150, unit: 'g', dept: 'epicerie' }) }
  assert.deepEqual(adjustmentCount(r), { removed: 1, replaced: 1, total: 2 })
})

test('les ajustements se répercutent sur la liste de courses', () => {
  const r = recipe()
  r.swaps = setSwap(r, 'Riz', { name: 'Quinoa', qty: 150, unit: 'g', dept: 'epicerie' })
  const lines = aggregateIngredients([{ recipe: effectiveRecipe(r), adults: 2, children: 0 }])
  assert.ok(lines.some(l => l.name === 'Quinoa'))
  assert.ok(!lines.some(l => l.name === 'Riz'))
})

test('les ajustements orphelins sont nettoyés', () => {
  const r = recipe()
  r.swaps = { ...setSwap(r, 'Coriandre', null), 'ingredient disparu': null }
  const pruned = pruneSwaps(r)
  assert.ok('coriandre' in pruned)
  assert.ok(!('ingredient disparu' in pruned))
})
