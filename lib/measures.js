// Rendre les mesures utilisables en cuisine.
//
// Deux problèmes traités ici :
//
//  • les sachets. « 1 sachet de levure » ne dit rien quand on a un pot de
//    levure dans le placard, ou quand la recette est mise à l'échelle. On les
//    convertit en cuillères, la mesure qu'on a vraiment sous la main.
//  • les fractions absurdes. Un quart de poivron ne se mesure pas ; on arrondit
//    les objets dénombrables au demi le plus proche, et on réserve les quarts
//    aux cuillères doseuses, où ils existent pour de bon.

import { normalizeName } from './normalize.js'

// Contenu d'un sachet du commerce, exprimé en cuillères.
// (levure chimique ≈ 11 g, sucre vanillé ≈ 7,5 g, levure sèche ≈ 5 g)
// L'ordre compte : du plus précis au plus général, sinon « levure
// boulangère » serait attrapé par l'entrée « levure ».
const SACHETS = [
  { match: ['levure boulangere', 'levure de boulanger', 'levure seche', 'levure de biere'], qty: 2, unit: 'c. à café' },
  { match: ['levure chimique'], qty: 1, unit: 'c. à soupe' },
  { match: ['sucre vanille'], qty: 2, unit: 'c. à café' },
  { match: ['sucre glace'], qty: 2, unit: 'c. à soupe' },
  { match: ['gelatine'], qty: 2, unit: 'c. à café' },
  { match: ['bicarbonate'], qty: 2, unit: 'c. à café' },
  // Repli : en pâtisserie française, un sachet de « levure » sans plus de
  // précision est de la levure chimique.
  { match: ['levure'], qty: 1, unit: 'c. à soupe' },
]

// Un sachet dont on ne connaît pas le contenu reste un sachet : inventer une
// conversion ferait plus de dégâts que de laisser l'unité d'origine.
export function sachetToSpoons(name) {
  const n = normalizeName(name)
  for (const s of SACHETS) {
    if (s.match.some(m => n.includes(m))) return { qty: s.qty, unit: s.unit }
  }
  return null
}

// Ingrédient prêt à afficher : les sachets connus deviennent des cuillères.
// Appelé AVANT la mise à l'échelle, pour que le calcul porte sur les cuillères.
export function usableIngredient(ing) {
  if (!ing || normalizeName(ing.unit ?? '') !== 'sachet') return ing
  const conv = sachetToSpoons(ing.name)
  if (!conv) return ing
  const parts = ing.qty == null ? 1 : ing.qty
  return { ...ing, qty: conv.qty * parts, unit: conv.unit, fromSachet: true }
}

export function usableIngredients(list) {
  return (list || []).map(usableIngredient)
}

// Un demi-oignon se coupe, un demi-œuf non. Ces ingrédients-là s'arrondissent
// à l'entier même quand leur unité admet les demis.
const ENTIERS = ['oeuf', 'feuille de laurier', 'etoile de badiane', 'clou de girofle']

export function mustBeWhole(name) {
  const n = normalizeName(name)
  return ENTIERS.some(e => n === e || n.startsWith(`${e} `))
}
