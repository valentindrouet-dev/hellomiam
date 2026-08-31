import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portionsFactor, equivalentServings, scaleIngredient } from './portions.js'

test('un enfant compte pour 2/3 d’un adulte', () => {
  assert.equal(equivalentServings(2, 0), 2)
  assert.ok(Math.abs(equivalentServings(2, 3) - 4) < 1e-9)
  assert.ok(Math.abs(equivalentServings(0, 3) - 2) < 1e-9)
})

test('facteur de portions par rapport à la base de la recette', () => {
  assert.equal(portionsFactor(2, 0, 2), 1)
  assert.equal(portionsFactor(4, 0, 2), 2)
  assert.ok(Math.abs(portionsFactor(2, 3, 2) - 2) < 1e-9)
  assert.ok(Math.abs(portionsFactor(2, 1, 4) - 2 / 3) < 1e-9)
})

test('mise à l’échelle avec arrondi cuisine', () => {
  const riz = scaleIngredient({ name: 'Riz', qty: 150, unit: 'g' }, 4 / 3)
  assert.equal(riz.qty, 200)
  assert.equal(riz.text, '200 g')

  // Les objets qui se comptent s'arrondissent au demi, jamais au quart : un
  // quart de poivron ne se mesure pas. Et les œufs vont à l'entier.
  const poivron = scaleIngredient({ name: 'Poivron rouge', qty: 2, unit: 'pièce' }, 4 / 3)
  assert.equal(poivron.qty, 2.5)
  const oeuf = scaleIngredient({ name: 'Œuf', qty: 2, unit: 'pièce' }, 4 / 3)
  assert.equal(oeuf.qty, 3, 'pas de demi-œuf')

  const sel = scaleIngredient({ name: 'Sel', qty: null, unit: null }, 2)
  assert.equal(sel.qty, null)
  assert.equal(sel.text, 'selon goût')

  const patates = scaleIngredient({ name: 'Pomme de terre', qty: 1.2, unit: 'kg' }, 1.5)
  assert.equal(patates.qty, 1.8)
  assert.equal(patates.text, '1,8 kg')
})
