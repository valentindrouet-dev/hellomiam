// Ajustements d'une recette : retirer un ingrédient qu'on n'aime pas, ou le
// remplacer par un autre. Les ajustements sont mémorisés à part
// (`recipe.swaps`), jamais fondus dans la recette : on peut toujours revenir
// à l'originale, et l'import/export reste fidèle à la source.
//
//   swaps = {
//     "coriandre":     null,                                   // retiré
//     "creme fraiche": { name: "Crème de soja", qty: 10, ... }  // remplacé
//   }
//
// La clé est le nom d'origine normalisé, ce qui survit à une correction de
// casse ou de pluriel dans la recette.

import { normalizeName } from './normalize.js'

export function swapKey(name) {
  return normalizeName(name)
}

// Liste des ingrédients réellement utilisés, ajustements appliqués.
// Chaque ingrédient remplacé porte `replacedFrom` pour l'afficher à l'écran.
export function effectiveIngredients(recipe) {
  const swaps = recipe.swaps || {}
  const out = []
  for (const ing of recipe.ingredients || []) {
    const key = swapKey(ing.name)
    if (!Object.prototype.hasOwnProperty.call(swaps, key)) {
      out.push(ing)
      continue
    }
    const swap = swaps[key]
    if (swap == null) continue // retiré
    out.push({
      name: swap.name,
      qty: swap.qty ?? null,
      unit: swap.unit ?? null,
      dept: swap.dept ?? ing.dept,
      replacedFrom: ing.name,
    })
  }
  return out
}

// Une recette dont on a modifié les ingrédients, pour les écrans qui ne
// veulent pas se soucier des ajustements (agrégation des courses, cuisine).
export function effectiveRecipe(recipe) {
  return { ...recipe, ingredients: effectiveIngredients(recipe) }
}

export function adjustmentCount(recipe) {
  const swaps = recipe.swaps || {}
  let removed = 0
  let replaced = 0
  for (const ing of recipe.ingredients || []) {
    const key = swapKey(ing.name)
    if (!Object.prototype.hasOwnProperty.call(swaps, key)) continue
    if (swaps[key] == null) removed += 1
    else replaced += 1
  }
  return { removed, replaced, total: removed + replaced }
}

// Ajustements nettoyés d'éventuelles clés orphelines (ingrédient supprimé de
// la recette depuis) — évite d'accumuler des réglages invisibles.
export function pruneSwaps(recipe) {
  const swaps = recipe.swaps || {}
  const keys = new Set((recipe.ingredients || []).map(i => swapKey(i.name)))
  const out = {}
  for (const [k, v] of Object.entries(swaps)) {
    if (keys.has(k)) out[k] = v
  }
  return out
}

export function setSwap(recipe, originalName, value) {
  const swaps = { ...(recipe.swaps || {}) }
  swaps[swapKey(originalName)] = value
  return swaps
}

export function clearSwap(recipe, originalName) {
  const swaps = { ...(recipe.swaps || {}) }
  delete swaps[swapKey(originalName)]
  return swaps
}
