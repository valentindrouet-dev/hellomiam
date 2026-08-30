import { CHILD_RATIO } from './constants.js'
import { smartRound, formatQtyUnit } from './units.js'

// Nombre de portions "équivalent adulte" : un enfant compte pour 2/3.
export function equivalentServings(adults, children) {
  return adults + children * CHILD_RATIO
}

// Facteur multiplicateur des quantités d'une recette prévue pour
// `baseServings` adultes, cuisinée pour `adults` adultes + `children` enfants.
export function portionsFactor(adults, children, baseServings) {
  return equivalentServings(adults, children) / Math.max(1, baseServings || 1)
}

// Ingrédient mis à l'échelle, prêt à afficher : { name, qty, unit, text }
export function scaleIngredient(ing, factor) {
  const qty = ing.qty == null ? null : smartRound(ing.qty * factor, ing.unit)
  return { ...ing, qty, text: formatQtyUnit(qty, ing.unit) }
}
