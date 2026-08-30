// Normalisation des noms d'ingrédients pour pouvoir les regrouper entre
// recettes ("Oignons rouges" ≈ "oignon rouge") et les retrouver dans la base
// de prix, malgré les accents, majuscules et pluriels.

export function stripAccents(s) {
  return s
    .replace(/œ/g, 'oe').replace(/Œ/g, 'oe')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function singular(word) {
  // Singulier naïf : on retire un "s" final sauf pour les mots qui le gardent
  // (pois, radis, os, bus, ananas...).
  if (word.length > 3 && word.endsWith('s') && !/(ss|is|os|us|as)$/.test(word)) {
    return word.slice(0, -1)
  }
  if (word.length > 4 && word.endsWith('x')) return word.slice(0, -1)
  return word
}

const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'a', 'au', 'aux', 'et'])

export function normalizeName(name) {
  const cleaned = stripAccents(String(name ?? '').toLowerCase().trim())
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim()
  return cleaned.split(' ').map(singular).join(' ')
}

// Découpe en mots significatifs (sans articles) pour la correspondance
// avec la base de prix.
export function nameTokens(name) {
  return normalizeName(name).split(' ').filter(w => w && !STOP_WORDS.has(w))
}
