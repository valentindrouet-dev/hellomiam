import { stripAccents } from './normalize.js'

// Trois familles d'unités :
//  - mass  : base = gramme
//  - vol   : base = millilitre (les cuillères sont des volumes : 1 cs = 15 ml)
//  - count : unités dénombrables (pièce, gousse, botte...), pas de conversion
export const UNIT_DEFS = {
  g: { family: 'mass', base: 1 },
  kg: { family: 'mass', base: 1000 },
  mg: { family: 'mass', base: 0.001 },
  ml: { family: 'vol', base: 1 },
  cl: { family: 'vol', base: 10 },
  dl: { family: 'vol', base: 100 },
  l: { family: 'vol', base: 1000 },
  'c. à soupe': { family: 'vol', base: 15, spoon: true },
  'c. à café': { family: 'vol', base: 5, spoon: true },
}

const UNIT_ALIASES = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  mg: 'mg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl',
  dl: 'dl', decilitre: 'dl', decilitres: 'dl',
  l: 'l', litre: 'l', litres: 'l',
  'cas': 'c. à soupe', 'cs': 'c. à soupe', 'c a soupe': 'c. à soupe',
  'cuillere a soupe': 'c. à soupe', 'cuilleres a soupe': 'c. à soupe',
  'cuillere soupe': 'c. à soupe', 'c soupe': 'c. à soupe',
  'cac': 'c. à café', 'cc': 'c. à café', 'c a cafe': 'c. à café',
  'cuillere a cafe': 'c. à café', 'cuilleres a cafe': 'c. à café',
  'cuillere cafe': 'c. à café', 'c cafe': 'c. à café',
  piece: 'pièce', pieces: 'pièce', pc: 'pièce', unite: 'pièce', unites: 'pièce',
  gousse: 'gousse', gousses: 'gousse',
  pincee: 'pincée', pincees: 'pincée',
  botte: 'botte', bottes: 'botte', bouquet: 'botte', bouquets: 'botte',
  sachet: 'sachet', sachets: 'sachet',
  tranche: 'tranche', tranches: 'tranche',
  boite: 'boîte', boites: 'boîte', conserve: 'boîte',
  pot: 'pot', pots: 'pot',
  cube: 'cube', cubes: 'cube',
  branche: 'branche', branches: 'branche',
  feuille: 'feuille', feuilles: 'feuille',
  brin: 'brin', brins: 'brin',
}

export function normalizeUnit(unit) {
  if (unit == null || unit === '') return null
  const cleaned = stripAccents(String(unit).toLowerCase())
    .replace(/[.']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return UNIT_ALIASES[cleaned] || cleaned
}

export function unitInfo(unit) {
  const u = normalizeUnit(unit)
  if (u == null) return { unit: null, family: 'none', base: 1 }
  const def = UNIT_DEFS[u]
  return def ? { unit: u, ...def } : { unit: u, family: 'count', base: 1 }
}

// Arrondi "cuisine" : on ne demande pas 187,33 g de riz mais 190 g.
export function smartRound(q, unit) {
  if (q == null || !Number.isFinite(q)) return q
  const info = unitInfo(unit)
  if (info.family === 'count' || info.spoon) {
    return Math.max(0.25, Math.round(q * 4) / 4)
  }
  const abs = Math.abs(q)
  if (abs >= 1000) return Math.round(q / 50) * 50
  if (abs >= 100) return Math.round(q / 10) * 10
  if (abs >= 20) return Math.round(q / 5) * 5
  if (abs >= 3) return Math.round(q)
  return Math.round(q * 10) / 10
}

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' }

// 0.5 → "½", 1.5 → "1 ½", 1.8 → "1,8"
export function formatQty(q) {
  if (q == null || !Number.isFinite(q)) return ''
  const int = Math.floor(q)
  const frac = Math.round((q - int) * 100) / 100
  if (FRACTIONS[frac]) return int === 0 ? FRACTIONS[frac] : `${int} ${FRACTIONS[frac]}`
  const rounded = Math.round(q * 100) / 100
  return String(rounded).replace('.', ',')
}

// Choisit une écriture lisible pour une quantité en unité de base de famille :
// 1500 g → "1,5 kg", 250 ml → "25 cl", 40 ml → "40 ml".
export function formatBaseQty(baseQty, family) {
  if (family === 'mass') {
    if (baseQty >= 1000) return `${formatQty(Math.round(baseQty / 10) / 100)} kg`
    return `${formatQty(Math.round(baseQty))} g`
  }
  if (family === 'vol') {
    if (baseQty >= 1000) return `${formatQty(Math.round(baseQty / 10) / 100)} l`
    if (baseQty >= 100) return `${formatQty(Math.round(baseQty / 10))} cl`
    return `${formatQty(Math.round(baseQty))} ml`
  }
  return formatQty(baseQty)
}

// Libellé complet "250 g", "2 pièces", "1 ½ c. à soupe", "selon goût".
export function formatQtyUnit(qty, unit) {
  if (qty == null) return 'selon goût'
  const u = normalizeUnit(unit)
  if (u == null) return formatQty(qty)
  const info = unitInfo(u)
  const plural = info.family === 'count' && qty >= 2 && !u.endsWith('s') && !UNIT_DEFS[u]
  return `${formatQty(qty)} ${u}${plural ? 's' : ''}`
}
