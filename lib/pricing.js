import { normalizeName, nameTokens } from './normalize.js'
import { unitInfo, formatQty, formatBaseQty } from './units.js'

// Poids moyen d'une pièce (en g) pour convertir "2 oignons" vers un prix au kg.
const AVG_PIECE_WEIGHT = {
  oignon: 120, 'oignon rouge': 120, echalote: 40, carotte: 125,
  'pomme de terre': 180, tomate: 120, courgette: 250, aubergine: 300,
  poireau: 200, citron: 100, 'citron vert': 80, pomme: 150, poire: 170,
  banane: 120, 'patate douce': 250, betterave: 150, navet: 150,
}
const DEFAULT_PIECE_WEIGHT = 150

export function buildPriceIndex(prices) {
  return prices.map(p => ({
    ...p,
    nName: normalizeName(p.name),
    tokens: nameTokens(p.name),
    info: unitInfo(p.unit),
  }))
}

// Retrouve l'entrée de prix la plus proche d'un nom d'ingrédient :
// correspondance exacte, puis par mots contenus, puis par recouvrement partiel.
export function matchPrice(index, name) {
  const n = normalizeName(name)
  const tokens = nameTokens(name)
  if (!tokens.length) return null

  let best = null
  let bestScore = 0
  for (const p of index) {
    let score = 0
    if (p.nName === n) {
      score = 1000
    } else if (p.tokens.length && p.tokens.every(t => tokens.includes(t))) {
      // Tous les mots du prix sont dans l'ingrédient : "crème fraîche" pour
      // "crème fraîche épaisse". Le libellé le plus précis gagne.
      score = 500 + p.tokens.length * 10 - Math.abs(tokens.length - p.tokens.length)
    } else if (tokens.every(t => p.tokens.includes(t))) {
      // L'ingrédient est plus vague que le prix : "cabillaud" → "dos de cabillaud".
      score = 200 - (p.tokens.length - tokens.length)
    } else {
      // Recouvrement partiel : "vin blanc sec" → "vin blanc de cuisine".
      const shared = tokens.filter(t => p.tokens.includes(t)).length
      if (shared >= Math.ceil(tokens.length / 2) && shared >= p.tokens.length / 2 && shared >= 1 && tokens.length > 1) {
        score = 50 + shared * 10 - Math.abs(tokens.length - p.tokens.length)
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}

// Estime le coût et la quantité à acheter pour une ligne de courses agrégée.
// Renvoie null si aucun prix ne correspond, sinon :
// { cost, buyLabel, approx, entry }
export function estimateLine(line, priceEntry) {
  if (!priceEntry) return null
  const pInfo = priceEntry.info
  const packQty = priceEntry.unitQty || 1
  let approx = false
  let need // besoin exprimé dans l'unité de l'entrée de prix

  if (!(line.baseQty > 0)) {
    // "selon goût" : on compte un conditionnement.
    need = packQty
    approx = true
  } else if (pInfo.family === line.family && pInfo.family !== 'count') {
    need = line.baseQty / pInfo.base
  } else if (pInfo.family === 'count' && line.family === 'count') {
    if (pInfo.unit === line.countUnit) {
      need = line.baseQty
    } else if (line.countUnit === 'gousse' && pInfo.unit === 'pièce') {
      need = line.baseQty * 0.1 // une tête d'ail ≈ 10 gousses
    } else {
      need = packQty
      approx = true
    }
  } else if (line.family === 'count' && (pInfo.family === 'mass' || pInfo.family === 'vol')) {
    // "2 oignons" avec un prix au kg : poids moyen par pièce.
    const avg = AVG_PIECE_WEIGHT[normalizeName(line.name)] ?? DEFAULT_PIECE_WEIGHT
    if (pInfo.family === 'mass' && (line.countUnit === 'pièce' || line.countUnit === 'gousse')) {
      need = (line.baseQty * (line.countUnit === 'gousse' ? 7 : avg)) / pInfo.base
      approx = true
    } else {
      need = packQty
      approx = true
    }
  } else {
    // Familles incompatibles (ex : 2 c. à soupe de concentré, prix à la boîte).
    need = packQty
    approx = true
  }

  let cost
  let buyLabel
  if (priceEntry.loose) {
    // Vendu au poids / à la pièce : on achète la quantité nécessaire.
    if (pInfo.family === 'count') {
      const n = Math.max(1, Math.ceil(need - 1e-9))
      cost = n * (priceEntry.price / packQty)
      buyLabel = `${n} ${pInfo.unit}${n > 1 && pInfo.unit === 'pièce' ? 's' : ''}`
    } else {
      cost = need * (priceEntry.price / packQty)
      buyLabel = formatBaseQty(need * pInfo.base, pInfo.family)
    }
  } else {
    // Vendu par conditionnement : on achète des paquets entiers.
    const packs = Math.max(1, Math.ceil(need / packQty - 1e-6))
    cost = packs * priceEntry.price
    if (pInfo.family === 'count') {
      buyLabel = packQty > 1
        ? `${packs} × ${formatQty(packQty)} ${pInfo.unit}${packQty > 1 ? 's' : ''}`
        : `${packs} ${pInfo.unit}${packs > 1 ? 's' : ''}`
    } else {
      buyLabel = `${packs} × ${formatBaseQty(packQty * pInfo.base, pInfo.family)}`
    }
  }

  return { cost: Math.round(cost * 100) / 100, buyLabel, approx, entry: priceEntry }
}

// Applique les prix à toutes les lignes et calcule le total.
export function priceLines(lines, prices) {
  const index = buildPriceIndex(prices)
  const priced = lines.map(line => ({ ...line, estimate: estimateLine(line, matchPrice(index, line.name)) }))
  let total = 0
  let unknown = 0
  let approx = 0
  for (const l of priced) {
    if (l.estimate) {
      total += l.estimate.cost
      if (l.estimate.approx) approx += 1
    } else {
      unknown += 1
    }
  }
  return { lines: priced, total: Math.round(total * 100) / 100, unknown, approx }
}

export function formatPrice(value) {
  if (value == null || !Number.isFinite(value)) return '?'
  return `${value.toFixed(2).replace('.', ',')} €`
}
