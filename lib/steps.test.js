import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientsForStep, isIngredientInStep } from './steps.js'
import { SEED_RECIPES } from './seed.js'

test('un ingrédient est reconnu par son mot marquant', () => {
  assert.ok(isIngredientInStep('Filet de poulet', 'Coupe le poulet en morceaux de 2 cm.'))
  assert.ok(isIngredientInStep('Riz', 'Verse le riz et fais-le cuire 12 min.'))
  assert.ok(isIngredientInStep('Pomme de terre', 'Épluche les pommes de terre.'), 'pluriel')
  assert.ok(isIngredientInStep('Crème fraîche', 'Ajoute la crème fraiche.'), 'sans accent')
})

test('pas de correspondance sur un fragment de mot', () => {
  assert.ok(!isIngredientInStep('Riz', 'Prépare la marinade.'), '« riz » dans « marinade »')
  assert.ok(!isIngredientInStep('Ail', 'Fais travailler la pâte.'), '« ail » dans « travailler »')
  assert.ok(!isIngredientInStep('Sel', 'Mélange la salade.'))
})

test('les mots trop communs ne suffisent pas', () => {
  assert.ok(!isIngredientInStep('Eau', 'Porte à ébullition une casserole d’eau.'),
    'l’eau est partout : elle n’identifie pas un ingrédient')
})

test('les ingrédients d’une étape sont rendus dans l’ordre de la recette', () => {
  const ingredients = [
    { name: 'Oignon' }, { name: 'Ail' }, { name: 'Riz' },
  ]
  const trouve = ingredientsForStep(ingredients, 'Émince l’oignon puis hache l’ail.')
  assert.deepEqual(trouve.map(i => i.name), ['Oignon', 'Ail'])
})

test('sur les recettes livrées, chaque étape de préparation trouve ses quantités', () => {
  const recette = SEED_RECIPES[0] // poulet crémeux
  const parEtape = recette.steps.map(s => ingredientsForStep(recette.ingredients, s).length)
  // Toutes les étapes sauf éventuellement les cuissons pures citent au moins
  // un ingrédient : c'est ce qui rend les quantités utiles en cuisinant.
  assert.ok(parEtape.filter(n => n > 0).length >= recette.steps.length - 1, `étapes couvertes : ${parEtape}`)
})
