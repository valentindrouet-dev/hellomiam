import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sachetToSpoons, usableIngredient, usableIngredients, mustBeWhole } from './measures.js'
import { smartRound, formatQtyUnit } from './units.js'
import { scaleIngredient } from './portions.js'

test('les sachets connus deviennent des cuillères', () => {
  assert.deepEqual(sachetToSpoons('Levure chimique'), { qty: 1, unit: 'c. à soupe' })
  assert.deepEqual(sachetToSpoons('Sucre vanillé'), { qty: 2, unit: 'c. à café' })
  assert.deepEqual(sachetToSpoons('Levure boulangère'), { qty: 2, unit: 'c. à café' })
})

test('un sachet inconnu reste un sachet plutôt qu’une conversion inventée', () => {
  assert.equal(sachetToSpoons('Épices à couscous'), null)
  const ing = { name: 'Épices à couscous', qty: 1, unit: 'sachet', dept: 'epicerie' }
  assert.deepEqual(usableIngredient(ing), ing)
})

test('la conversion suit le nombre de sachets', () => {
  const deux = usableIngredient({ name: 'Levure chimique', qty: 2, unit: 'sachet', dept: 'epicerie' })
  assert.equal(deux.qty, 2)
  assert.equal(deux.unit, 'c. à soupe')
  assert.equal(deux.fromSachet, true)
})

test('les autres unités ne sont pas touchées', () => {
  const riz = { name: 'Riz', qty: 150, unit: 'g', dept: 'epicerie' }
  assert.deepEqual(usableIngredient(riz), riz)
  assert.equal(usableIngredients([riz]).length, 1)
})

test('une conversion se met à l’échelle comme le reste', () => {
  const ing = usableIngredient({ name: 'Levure chimique', qty: 1, unit: 'sachet', dept: 'epicerie' })
  const pour4 = scaleIngredient(ing, 2)
  assert.equal(pour4.text, '2 c. à soupe')
})

test('pas de quart de légume : les objets comptables vont au demi', () => {
  assert.equal(smartRound(1.75, 'pièce'), 2)
  assert.equal(smartRound(1.3, 'pièce'), 1.5)
  assert.equal(smartRound(3.25, 'gousse'), 3.5)
  assert.equal(smartRound(0.1, 'pièce'), 0.5, 'jamais moins d’un demi')
  // Une demi-pièce écrite dans la recette reste une demi-pièce à l'échelle 1.
  assert.equal(smartRound(0.5, 'pièce'), 0.5)
})

test('les cuillères doseuses gardent leurs quarts, qui existent vraiment', () => {
  assert.equal(smartRound(1.75, 'c. à café'), 1.75)
  assert.equal(smartRound(0.3, 'c. à soupe'), 0.25)
  assert.equal(formatQtyUnit(smartRound(1.75, 'c. à café'), 'c. à café'), '1 ¾ c. à café')
})

test('ce qui ne se coupe pas reste entier', () => {
  assert.equal(smartRound(1.4, 'pincée'), 1)
  assert.equal(smartRound(1.6, 'boîte'), 2)
  assert.equal(smartRound(0.2, 'cube'), 1)
})

test('les poids et volumes gardent leurs arrondis lisibles', () => {
  assert.equal(smartRound(187.33, 'g'), 190)
  assert.equal(smartRound(1234, 'g'), 1250)
  assert.equal(smartRound(23, 'cl'), 25)
})

test('le plus précis l’emporte sur le générique', () => {
  // « Levure boulangère » contient le mot « levure » : l'ordre de la table ne
  // doit pas la faire passer pour de la levure chimique.
  assert.deepEqual(sachetToSpoons('Levure boulangère'), { qty: 2, unit: 'c. à café' })
  assert.deepEqual(sachetToSpoons('Levure chimique'), { qty: 1, unit: 'c. à soupe' })
  assert.deepEqual(sachetToSpoons('Levure'), { qty: 1, unit: 'c. à soupe' }, 'repli pâtisserie')
})

test('un demi-œuf n’existe pas', () => {
  assert.ok(mustBeWhole('Œuf'))
  assert.ok(mustBeWhole('Œufs'))
  assert.ok(!mustBeWhole('Oignon'), 'un demi-oignon, si')
  // 3 œufs ramenés à la moitié des portions : 2, pas 1 ½.
  assert.equal(scaleIngredient({ name: 'Œuf', qty: 3, unit: 'pièce' }, 0.5).text, '2 pièces')
  assert.equal(scaleIngredient({ name: 'Oignon', qty: 3, unit: 'pièce' }, 0.5).text, '1 ½ pièce')
})
