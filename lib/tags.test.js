import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoTags, effectiveTags, allTags, cleanTag, tagEmoji } from './tags.js'

const base = { title: '', prepMin: null, cookMin: null, steps: [], ingredients: [] }
const ing = (name, dept) => ({ name, qty: 1, unit: 'g', dept })

test('végétarien seulement sans viande ni poisson', () => {
  assert.ok(autoTags({ ...base, ingredients: [ing('Carotte', 'fruits-legumes')] }).includes('végétarien'))
  assert.ok(!autoTags({ ...base, ingredients: [ing('Filet de poulet', 'boucherie')] }).includes('végétarien'))
  assert.ok(!autoTags({ ...base, ingredients: [ing('Pavé de saumon', 'poissonnerie')] }).includes('végétarien'))
  // Le rayon suffit même si le nom n'est pas dans les listes.
  assert.ok(!autoTags({ ...base, ingredients: [ing('Paleron', 'boucherie')] }).includes('végétarien'))
})

test('volaille ne double pas viande', () => {
  const tags = autoTags({ ...base, ingredients: [ing('Filet de poulet', 'boucherie')] })
  assert.ok(tags.includes('volaille'))
  assert.ok(!tags.includes('viande'))
})

test('« riz » ne se déclenche pas sur des vermicelles de riz', () => {
  assert.ok(!autoTags({ ...base, ingredients: [ing('Vermicelles de riz', 'epicerie')] }).includes('riz'))
  assert.ok(autoTags({ ...base, ingredients: [ing('Riz basmati', 'epicerie')] }).includes('riz'))
})

test('« c. à soupe » ne rend pas la recette « soupe »', () => {
  const tags = autoTags({ ...base, title: 'Bo bun', steps: ['Ajoute 6 c. à soupe d’eau.'] })
  assert.ok(!tags.includes('soupe'))
  assert.ok(autoTags({ ...base, title: 'Soupe de courge' }).includes('soupe'))
})

test('« salade » vient du titre, pas d’une garniture', () => {
  assert.ok(!autoTags({ ...base, steps: ['Cisèle la salade.'] }).includes('salade'))
  assert.ok(autoTags({ ...base, title: 'Salade César' }).includes('salade'))
})

test('cuisson et rapidité déduites des étapes et du temps', () => {
  assert.ok(autoTags({ ...base, steps: ['Enfourne 20 min à 180 °C.'] }).includes('four'))
  assert.ok(autoTags({ ...base, steps: ['Cuire à la plancha.'] }).includes('plancha'))
  assert.ok(autoTags({ ...base, steps: ['Laisse mijoter 1 h.'] }).includes('mijoté'))
  assert.ok(autoTags({ ...base, prepMin: 10, cookMin: 15 }).includes('rapide'))
  assert.ok(!autoTags({ ...base, prepMin: 30, cookMin: 40 }).includes('rapide'))
})

test('tags effectifs = automatiques + manuels − masqués', () => {
  const recipe = {
    ...base,
    ingredients: [ing('Carotte', 'fruits-legumes')],
    tags: ['été', 'plancha'],
    tagsOff: ['végétarien'],
  }
  const tags = effectiveTags(recipe)
  assert.ok(tags.includes('été'))
  assert.ok(tags.includes('plancha'))
  assert.ok(!tags.includes('végétarien'), 'tag masqué')
  assert.equal(new Set(tags).size, tags.length, 'pas de doublon')
})

test('allTags compte les occurrences, du plus fréquent au moins', () => {
  const veg = { ...base, ingredients: [ing('Carotte', 'fruits-legumes')] }
  const list = allTags([veg, veg, { ...base, ingredients: [ing('Poulet', 'boucherie')] }])
  assert.equal(list[0].tag, 'végétarien')
  assert.equal(list[0].count, 2)
})

test('nettoyage des tags saisis à la main', () => {
  assert.equal(cleanTag('  Végé  TARIEN '), 'végé tarien')
  assert.equal(cleanTag(''), '')
  assert.equal(tagEmoji('poisson'), '🐟')
  assert.equal(tagEmoji('inconnu'), '🏷️')
})
