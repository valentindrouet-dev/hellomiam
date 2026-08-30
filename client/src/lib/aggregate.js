import { normalizeName } from './normalize.js'
import { unitInfo, formatBaseQty, formatQtyUnit, smartRound } from './units.js'
import { portionsFactor } from './portions.js'

// Fusionne les ingrédients de plusieurs recettes (chacune avec son nombre
// d'adultes/enfants) en une liste de courses unique.
//
// Entrée : [{ recipe, adults, children }]
// Sortie : lignes { key, name, dept, family, baseQty, unit, qty, text, hasNull, sources }
//  - key     : identifiant stable (nom normalisé + famille d'unité) pour cocher
//  - baseQty : total en unité de base de la famille (g, ml, ou l'unité comptable)
//  - qty/unit/text : quantité d'affichage déjà arrondie
export function aggregateIngredients(cartRecipes) {
  const map = new Map()

  for (const { recipe, adults, children } of cartRecipes) {
    const factor = portionsFactor(adults, children, recipe.servings)
    for (const ing of recipe.ingredients || []) {
      if (!ing?.name) continue
      const info = unitInfo(ing.unit)
      const famKey = info.family === 'count' ? `count:${info.unit}` : info.family
      const key = `${normalizeName(ing.name)}|${famKey}`

      let line = map.get(key)
      if (!line) {
        line = {
          key,
          name: ing.name,
          dept: ing.dept || 'autres',
          family: info.family,
          countUnit: info.family === 'count' ? info.unit : null,
          baseQty: 0,
          units: new Set(),
          hasNull: false,
          sources: [],
        }
        map.set(key, line)
      }
      if (ing.qty == null) {
        line.hasNull = true
      } else {
        line.baseQty += ing.qty * factor * info.base
        if (info.unit) line.units.add(info.unit)
      }
      if (!line.sources.includes(recipe.title)) line.sources.push(recipe.title)
    }
  }

  return [...map.values()].map(finishLine)
}

function finishLine(line) {
  const units = [...line.units]
  let qty = null
  let unit = null
  let text = 'selon goût'

  if (line.baseQty > 0) {
    if (units.length === 1) {
      // Une seule unité rencontrée : on la garde ("2 boîtes", "3 c. à soupe").
      const info = unitInfo(units[0])
      qty = smartRound(line.baseQty / info.base, units[0])
      unit = units[0]
      text = formatQtyUnit(qty, unit)
    } else {
      // Mélange (150 g + 0,2 kg, ou 2 cs + 5 cl) : bascule en unité de base.
      qty = line.baseQty
      unit = line.family === 'mass' ? 'g' : line.family === 'vol' ? 'ml' : null
      text = formatBaseQty(line.baseQty, line.family)
    }
  }

  const { units: _drop, ...rest } = line
  return { ...rest, qty, unit, text }
}

// Transforme un article libre ("2 l de lait" ajouté à la main) en ligne
// compatible avec l'agrégation et l'estimation de prix.
export function extraToLine(extra) {
  const info = unitInfo(extra.unit)
  return {
    key: `extra:${extra.id}`,
    id: extra.id,
    name: extra.name,
    dept: extra.dept || 'autres',
    family: extra.qty == null ? 'none' : info.family,
    countUnit: info.family === 'count' ? info.unit : null,
    baseQty: extra.qty == null ? 0 : extra.qty * info.base,
    qty: extra.qty ?? null,
    unit: info.unit,
    hasNull: extra.qty == null,
    text: extra.qty == null ? '' : formatQtyUnit(extra.qty, extra.unit),
    sources: [],
    extra: true,
    checked: !!extra.checked,
  }
}
