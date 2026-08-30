import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPriceIndex, matchPrice, estimateLine, priceLines, formatPrice } from './pricing.js'
import { aggregateIngredients } from './aggregate.js'

const PRICES = [
  { name: 'Farine', unit: 'g', unitQty: 1000, price: 0.95, dept: 'epicerie', loose: false },
  { name: 'Œuf', unit: 'pièce', unitQty: 6, price: 1.9, dept: 'cremerie', loose: false },
  { name: 'Filet de poulet', unit: 'kg', unitQty: 1, price: 11.5, dept: 'boucherie', loose: true },
  { name: 'Oignon', unit: 'kg', unitQty: 1, price: 1.8, dept: 'fruits-legumes', loose: true },
  { name: 'Poivron rouge', unit: 'pièce', unitQty: 1, price: 1.1, dept: 'fruits-legumes', loose: true },
  { name: 'Ail', unit: 'pièce', unitQty: 1, price: 0.8, dept: 'fruits-legumes', loose: true },
  { name: 'Crème fraîche', unit: 'cl', unitQty: 20, price: 1.2, dept: 'cremerie', loose: false },
  { name: 'Lardons', unit: 'g', unitQty: 200, price: 2.1, dept: 'boucherie', loose: false },
  { name: 'Vin blanc de cuisine', unit: 'cl', unitQty: 75, price: 3.5, dept: 'boissons', loose: false },
  { name: 'Sucre', unit: 'g', unitQty: 1000, price: 1.2, dept: 'epicerie-sucree', loose: false },
  { name: 'Sucre glace', unit: 'g', unitQty: 500, price: 1.5, dept: 'epicerie-sucree', loose: false },
  { name: 'Dos de cabillaud', unit: 'kg', unitQty: 1, price: 19.5, dept: 'poissonnerie', loose: true },
  { name: 'Sel', unit: 'g', unitQty: 500, price: 0.6, dept: 'epicerie', loose: false },
]

const index = buildPriceIndex(PRICES)

test('matchPrice : exact, précision, et repli', () => {
  assert.equal(matchPrice(index, 'Farine').name, 'Farine')
  assert.equal(matchPrice(index, 'Œufs').name, 'Œuf')
  assert.equal(matchPrice(index, 'Filet de poulet fermier').name, 'Filet de poulet')
  assert.equal(matchPrice(index, 'Oignon jaune').name, 'Oignon')
  assert.equal(matchPrice(index, 'Cabillaud').name, 'Dos de cabillaud')
  assert.equal(matchPrice(index, 'Sucre glace').name, 'Sucre glace')
  assert.equal(matchPrice(index, 'Sucre').name, 'Sucre')
  assert.equal(matchPrice(index, 'Vin blanc sec').name, 'Vin blanc de cuisine')
  assert.equal(matchPrice(index, 'Yuzu confit'), null)
})

function line(name, qty, unit) {
  const [l] = aggregateIngredients([
    { recipe: { title: 'T', servings: 2, ingredients: [{ name, qty, unit, dept: 'autres' }] }, adults: 2, children: 0 },
  ])
  return l
}

test('paquets entiers : 800 g de farine → 1 paquet de 1 kg', () => {
  const est = estimateLine(line('Farine', 800, 'g'), matchPrice(index, 'Farine'))
  assert.equal(est.cost, 0.95)
  assert.equal(est.buyLabel, '1 × 1 kg')
})

test('paquets entiers : 1,2 kg de farine → 2 paquets', () => {
  const est = estimateLine(line('Farine', 1.2, 'kg'), matchPrice(index, 'Farine'))
  assert.equal(est.cost, 1.9)
  assert.equal(est.buyLabel, '2 × 1 kg')
})

test('boîte d’œufs : 8 œufs → 2 boîtes de 6', () => {
  const est = estimateLine(line('Œufs', 8, 'pièce'), matchPrice(index, 'Œufs'))
  assert.equal(est.cost, 3.8)
  assert.equal(est.buyLabel, '2 × 6 pièces')
})

test('au poids : 450 g de poulet au prix du kg', () => {
  const est = estimateLine(line('Filet de poulet', 450, 'g'), matchPrice(index, 'Filet de poulet'))
  assert.ok(Math.abs(est.cost - 5.18) < 0.01)
  assert.equal(est.buyLabel, '450 g')
})

test('pièces vendues à l’unité : 2,5 poivrons → 3 pièces', () => {
  const est = estimateLine(line('Poivron rouge', 2.5, 'pièce'), matchPrice(index, 'Poivron rouge'))
  assert.equal(est.cost, 3.3)
  assert.equal(est.buyLabel, '3 pièces')
})

test('gousses d’ail converties en têtes', () => {
  const est = estimateLine(line('Ail', 4, 'gousse'), matchPrice(index, 'Ail'))
  assert.equal(est.cost, 0.8)
  assert.equal(est.buyLabel, '1 pièce')
})

test('oignons à la pièce avec prix au kg (poids moyen)', () => {
  const est = estimateLine(line('Oignon', 2, 'pièce'), matchPrice(index, 'Oignon'))
  assert.ok(est.approx)
  assert.ok(Math.abs(est.cost - 0.43) < 0.01) // 240 g × 1,80 €/kg
})

test('sel "selon goût" : un conditionnement, approximatif', () => {
  const est = estimateLine(line('Sel', null, null), matchPrice(index, 'Sel'))
  assert.equal(est.cost, 0.6)
  assert.ok(est.approx)
})

test('priceLines : total et inconnus', () => {
  const lines = [line('Farine', 500, 'g'), line('Yuzu confit', 1, 'pièce')]
  const res = priceLines(lines, PRICES)
  assert.equal(res.total, 0.95)
  assert.equal(res.unknown, 1)
  assert.equal(formatPrice(res.total), '0,95 €')
})

test('cuillères de vin face à un prix en bouteille : 1 bouteille approx', () => {
  const est = estimateLine(line('Vin blanc sec', 10, 'cl'), matchPrice(index, 'Vin blanc sec'))
  assert.equal(est.cost, 3.5)
  assert.equal(est.buyLabel, '1 × 75 cl')
})
