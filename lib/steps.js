// Rattacher les ingrédients aux étapes qui les utilisent.
//
// « Verse le riz » ne dit pas combien : en cuisine on veut la quantité sous
// les yeux au moment de s'en servir, pas seulement en haut de la recette.

import { normalizeName, nameTokens } from './normalize.js'

// Mots trop courts ou trop communs pour identifier un ingrédient à eux seuls.
const TROP_COMMUN = new Set(['eau', 'jus', 'gros', 'petit', 'fin', 'frais', 'sec', 'vert', 'rouge', 'blanc', 'noir', 'doux'])

function motsUtiles(name) {
  return nameTokens(name).filter(t => t.length >= 3 && !TROP_COMMUN.has(t))
}

// Un ingrédient est cité dans l'étape si l'un de ses mots significatifs y
// apparaît comme mot entier (« poulet » pour « Filet de poulet »).
export function isIngredientInStep(name, stepText) {
  const mots = motsUtiles(name)
  if (!mots.length) return false
  const texte = ` ${normalizeName(stepText)} `
  return mots.some(m => texte.includes(` ${m} `))
}

// Les ingrédients cités dans une étape, dans l'ordre de la recette.
export function ingredientsForStep(ingredients, stepText) {
  return (ingredients || []).filter(ing => isIngredientInStep(ing.name, stepText))
}
