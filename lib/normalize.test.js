import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeName, nameTokens } from './normalize.js'
import { normalizeUnit } from './units.js'

test('normalizeName : accents, majuscules, pluriels', () => {
  assert.equal(normalizeName('Oignons rouges'), 'oignon rouge')
  assert.equal(normalizeName('Pommes de terre'), 'pomme de terre')
  assert.equal(normalizeName('Œufs'), 'oeuf')
  assert.equal(normalizeName('œuf'), 'oeuf')
  assert.equal(normalizeName('Crème fraîche'), 'creme fraiche')
  assert.equal(normalizeName('Tomates concassées'), 'tomate concassee')
  assert.equal(normalizeName("Huile d'olive"), 'huile d olive')
})

test('normalizeName : mots qui gardent leur s final', () => {
  assert.equal(normalizeName('Petits pois'), 'petit pois')
  assert.equal(normalizeName('Radis'), 'radis')
  assert.equal(normalizeName('Ananas'), 'ananas')
  assert.equal(normalizeName('Frais'), 'frais')
})

test('nameTokens : retire les articles', () => {
  assert.deepEqual(nameTokens('Filet de poulet'), ['filet', 'poulet'])
  assert.deepEqual(nameTokens("Huile d'olive vierge"), ['huile', 'olive', 'vierge'])
  assert.deepEqual(nameTokens('Dos de cabillaud'), ['dos', 'cabillaud'])
})

test('normalizeUnit : alias courants', () => {
  assert.equal(normalizeUnit('G'), 'g')
  assert.equal(normalizeUnit('grammes'), 'g')
  assert.equal(normalizeUnit('c. à soupe'), 'c. à soupe')
  assert.equal(normalizeUnit('cs'), 'c. à soupe')
  assert.equal(normalizeUnit('càc'), 'c. à café')
  assert.equal(normalizeUnit('cc'), 'c. à café')
  assert.equal(normalizeUnit('cuillère à soupe'), 'c. à soupe')
  assert.equal(normalizeUnit('pièces'), 'pièce')
  assert.equal(normalizeUnit('piece'), 'pièce')
  assert.equal(normalizeUnit('Litre'), 'l')
  assert.equal(normalizeUnit('boite'), 'boîte')
  assert.equal(normalizeUnit(null), null)
  assert.equal(normalizeUnit(''), null)
})
