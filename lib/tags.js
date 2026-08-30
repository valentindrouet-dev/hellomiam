// Étiquettes des recettes.
//
// Deux sources : des tags déduits automatiquement du contenu de la recette
// (végétarien, poisson, plancha…) et des tags ajoutés à la main. L'utilisateur
// peut masquer un tag automatique qu'il juge faux : il est mémorisé dans
// `tagsOff`, et le tag disparaît sans qu'on touche à la recette.

import { normalizeName } from './normalize.js'

export const TAG_EMOJI = {
  'végétarien': '🌱',
  'poisson': '🐟',
  'fruits de mer': '🦐',
  'viande': '🥩',
  'volaille': '🍗',
  'pâtes': '🍝',
  'riz': '🍚',
  'dessert': '🍰',
  'plancha': '🔥',
  'four': '♨️',
  'mijoté': '🥘',
  'rapide': '⚡',
  'épicé': '🌶️',
  'salade': '🥗',
  'soupe': '🍜',
}

export function tagEmoji(tag) {
  return TAG_EMOJI[tag] ?? '🏷️'
}

// Mots-clés cherchés dans les noms d'ingrédients (déjà normalisés).
const VIANDE = ['boeuf', 'porc', 'agneau', 'veau', 'lardon', 'jambon', 'chorizo', 'saucisse', 'merguez', 'steak', 'rumsteck', 'bacon', 'viande', 'cote de porc', 'filet mignon']
const VOLAILLE = ['poulet', 'dinde', 'canard', 'pintade', 'magret', 'volaille']
const POISSON = ['saumon', 'cabillaud', 'thon', 'colin', 'merlu', 'truite', 'sardine', 'maquereau', 'poisson', 'anchois', 'dorade', 'bar']
const MER = ['crevette', 'moule', 'gambas', 'calamar', 'saint jacques', 'st jacques', 'noix de saint jacques', 'huitre', 'crabe', 'homard', 'poulpe']
const PATES = ['pate', 'spaghetti', 'tagliatelle', 'penne', 'macaroni', 'lasagne', 'nouille', 'vermicelle', 'coquillette', 'linguine', 'raviole']
const RIZ = ['riz', 'risotto']
const EPICE = ['piment', 'harissa', 'sriracha', 'tabasco', 'piment d espelette', 'curry', 'pate de curry']

const hasWord = (haystackList, needles) =>
  haystackList.some(n => needles.some(k => n === k || n.includes(k)))

// Un ingrédient de charcuterie/boucherie compte comme viande même si son nom
// n'est pas dans la liste (rayon renseigné à la saisie).
function ingredientNames(recipe) {
  return (recipe.ingredients || []).map(i => normalizeName(i.name))
}

function depts(recipe) {
  return new Set((recipe.ingredients || []).map(i => i.dept))
}

function stepsText(recipe) {
  // Les unités de mesure sont retirées : sans ça « 6 c. à soupe d'eau »
  // ferait passer la recette pour une soupe.
  return normalizeName([...(recipe.steps || []), recipe.title || ''].join(' '))
    .replace(/\b(c|cuillere) a (soupe|cafe)\b/g, ' ')
}

// « Riz » ne doit pas se déclencher sur « vermicelles de riz » : on exige que
// le riz soit l'ingrédient lui-même, éventuellement qualifié (riz basmati).
function isRiceName(name) {
  return /^(riz|risotto)(\s|$)/.test(name)
}

export function autoTags(recipe) {
  const names = ingredientNames(recipe)
  const dep = depts(recipe)
  const text = stepsText(recipe)
  const tags = []

  const viande = dep.has('boucherie') || hasWord(names, VIANDE) || hasWord(names, VOLAILLE)
  const volaille = hasWord(names, VOLAILLE)
  const poisson = dep.has('poissonnerie') || hasWord(names, POISSON)
  const mer = hasWord(names, MER)

  if (volaille) tags.push('volaille')
  // « viande » ne double pas « volaille » : on ne garde que si autre chose.
  if (viande && !volaille) tags.push('viande')
  if (poisson) tags.push('poisson')
  if (mer) tags.push('fruits de mer')
  if (!viande && !poisson && !mer) tags.push('végétarien')

  if (hasWord(names, PATES)) tags.push('pâtes')
  if (names.some(isRiceName)) tags.push('riz')
  if (hasWord(names, EPICE)) tags.push('épicé')

  if (/plancha|barbecue|grillade|au grill/.test(text)) tags.push('plancha')
  if (/\bfour\b|enfourne|enfourner/.test(text)) tags.push('four')
  if (/mijote|mijoter|laisse cuire a feu doux/.test(text)) tags.push('mijoté')
  const titre = normalizeName(recipe.title || '')
  if (/\bsalade\b/.test(titre)) tags.push('salade')
  if (/\bsoupe\b|veloute|potage/.test(`${titre} ${text}`)) tags.push('soupe')
  if (/dessert|gateau|tarte sucree|mousse au chocolat|cookie|creme dessert|tiramisu/.test(text)) tags.push('dessert')

  const total = (recipe.prepMin || 0) + (recipe.cookMin || 0)
  if (total > 0 && total <= 30) tags.push('rapide')

  return [...new Set(tags)]
}

// Tags réellement affichés : automatiques + manuels − masqués.
export function effectiveTags(recipe) {
  const off = new Set(recipe.tagsOff || [])
  const manual = (recipe.tags || []).filter(t => !off.has(t))
  const auto = autoTags(recipe).filter(t => !off.has(t))
  return [...new Set([...auto, ...manual])]
}

export function isAutoTag(recipe, tag) {
  return autoTags(recipe).includes(tag)
}

// Tous les tags utilisés dans la bible, avec leur nombre d'occurrences.
export function allTags(recipes) {
  const counts = new Map()
  for (const r of recipes) {
    for (const t of effectiveTags(r)) counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .map(([tag, count]) => ({ tag, count }))
}

export function cleanTag(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30)
}
