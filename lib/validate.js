import { CATEGORY_IDS, DEPT_IDS } from './constants.js'
import { cleanTag } from './tags.js'
import { swapKey } from './adjust.js'

// Valide et nettoie une recette venant d'un formulaire, d'un import JSON ou
// d'un texte généré par Claude. Tolérant sur la forme, strict sur l'essentiel.
// Renvoie { recipe, errors } — recipe est null si errors n'est pas vide.
export function validateRecipe(input) {
  const errors = []
  const src = typeof input === 'object' && input !== null ? input : {}

  const title = String(src.title ?? '').trim().slice(0, 200)
  if (!title) errors.push('titre manquant')

  const category = CATEGORY_IDS.includes(src.category) ? src.category : 'perso'

  let servings = Number(src.servings)
  if (!Number.isFinite(servings) || servings <= 0) servings = 2
  servings = Math.min(20, Math.max(1, Math.round(servings)))

  const prepMin = toMinutes(src.prepMin ?? src.prep_min)
  const cookMin = toMinutes(src.cookMin ?? src.cook_min)
  const notes = src.notes == null ? null : String(src.notes).trim().slice(0, 2000) || null

  const photo = cleanPhoto(src.photo)

  const rawIngredients = Array.isArray(src.ingredients) ? src.ingredients : []
  const ingredients = []
  for (const raw of rawIngredients) {
    if (typeof raw === 'string') {
      // Tolérance : "200 g de farine" en texte brut.
      if (raw.trim()) ingredients.push({ name: raw.trim().slice(0, 120), qty: null, unit: null, dept: 'autres' })
      continue
    }
    if (typeof raw !== 'object' || raw === null) continue
    const name = String(raw.name ?? '').trim().slice(0, 120)
    if (!name) continue
    let qty = raw.qty == null || raw.qty === '' ? null : Number(String(raw.qty).replace(',', '.'))
    if (qty != null && (!Number.isFinite(qty) || qty <= 0)) qty = null
    const unit = raw.unit == null || String(raw.unit).trim() === '' ? null : String(raw.unit).trim().slice(0, 30)
    const dept = DEPT_IDS.includes(raw.dept) ? raw.dept : 'autres'
    ingredients.push({ name, qty, unit, dept })
  }
  if (!ingredients.length) errors.push('au moins un ingrédient requis')

  const steps = (Array.isArray(src.steps) ? src.steps : [])
    .map(s => String(s ?? '').trim().slice(0, 2000))
    .filter(Boolean)
  if (!steps.length) errors.push('au moins une étape requise')

  // Sous-catégorie libre (« Chez Marcel » dans Restaurants), texte court.
  const sub = src.sub == null ? null : String(src.sub).trim().replace(/\s+/g, ' ').slice(0, 60) || null

  // Tags ajoutés à la main, et tags automatiques que l'on a masqués.
  const tags = uniqueTags(src.tags)
  const tagsOff = uniqueTags(src.tagsOff)

  // Ajustements : clé = nom d'origine normalisé, valeur = null (retiré) ou
  // un ingrédient de remplacement.
  const swaps = {}
  if (src.swaps && typeof src.swaps === 'object' && !Array.isArray(src.swaps)) {
    const names = new Map((ingredients).map(i => [swapKey(i.name), true]))
    for (const [rawKey, rawValue] of Object.entries(src.swaps)) {
      const key = swapKey(rawKey)
      if (!names.has(key)) continue // ingrédient disparu de la recette
      if (rawValue == null) {
        swaps[key] = null
        continue
      }
      if (typeof rawValue !== 'object') continue
      const name = String(rawValue.name ?? '').trim().slice(0, 120)
      if (!name) continue
      let qty = rawValue.qty == null || rawValue.qty === '' ? null : Number(String(rawValue.qty).replace(',', '.'))
      if (qty != null && (!Number.isFinite(qty) || qty <= 0)) qty = null
      const unit = rawValue.unit == null || String(rawValue.unit).trim() === ''
        ? null
        : String(rawValue.unit).trim().slice(0, 30)
      swaps[key] = {
        name,
        qty,
        unit,
        dept: DEPT_IDS.includes(rawValue.dept) ? rawValue.dept : 'autres',
      }
    }
  }

  if (errors.length) return { recipe: null, errors }
  return {
    recipe: { title, category, sub, servings, prepMin, cookMin, notes, photo, ingredients, steps, tags, tagsOff, swaps },
    errors,
  }
}

// Deux sources d'illustration acceptées :
//  • un lien https vers une image (quelques octets en base, mais dépend du
//    site distant et du réseau) ;
//  • une photo prise sur le téléphone, intégrée en data-URL (lourde, mais
//    disponible hors-ligne et à l'abri d'un lien mort).
// Tout le reste est refusé : http en clair (bloqué en page https), et les
// schémas javascript:/blob: qui n'ont rien à faire dans un src d'image.
export function cleanPhoto(raw) {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (/^data:image\/(jpeg|png|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/.test(value)) return value
  if (/^https:\/\/[^\s<>"']+$/i.test(value)) return value.slice(0, 2000)
  return null
}

function uniqueTags(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const t of raw) {
    const tag = cleanTag(t)
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out.slice(0, 20)
}

function toMinutes(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(24 * 60, Math.round(n))
}

// Extrait une liste de recettes d'un texte collé : JSON pur, JSON entouré de
// texte, bloc ```json, objet unique, tableau, ou {recipes:[...]}.
export function parseImportText(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { recipes: [], error: 'Rien à importer' }

  const candidats = []

  const direct = tryParse(raw)
  if (direct !== undefined) candidats.push(direct)

  // Blocs de code : Claude encadre souvent sa réponse.
  for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    const parsed = tryParse(m[1].trim())
    if (parsed !== undefined) candidats.push(parsed)
  }

  // Enfin, tout bloc { } ou [ ] équilibré trouvé dans le texte. On repère les
  // accolades correspondantes plutôt que d'aller du premier { au dernier ] :
  // une phrase finale comme « importe-le [dans l'appli] » ferait dérailler.
  for (const span of balancedSpans(raw)) {
    const parsed = tryParse(span)
    if (parsed !== undefined) candidats.push(parsed)
  }

  for (const parsed of candidats) {
    const list = asRecipeList(parsed)
    if (list) return { recipes: list, error: null }
  }

  return {
    recipes: [],
    error: 'JSON illisible — vérifie que tu as bien collé la réponse complète de Claude',
  }
}

// Reconnaît les formes acceptées, et écarte un JSON quelconque qui traînerait
// dans le texte (un exemple de configuration, par exemple).
function asRecipeList(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.some(looksLikeRecipe) ? parsed : null
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.recipes)) return parsed.recipes
    if (looksLikeRecipe(parsed)) return [parsed]
  }
  return null
}

function looksLikeRecipe(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (typeof value.title === 'string' || Array.isArray(value.ingredients) || Array.isArray(value.steps))
}

// Tous les blocs { } ou [ ] complets du texte, du plus extérieur au suivant.
function balancedSpans(text) {
  const spans = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' && text[i] !== '[') continue
    const end = matchingEnd(text, i)
    if (end < 0) continue
    spans.push(text.slice(i, end + 1))
    i = end
  }
  return spans
}

// Fin du bloc ouvert en `start`, en ignorant ce qui est entre guillemets
// (une accolade dans une chaîne ne compte pas).
function matchingEnd(text, start) {
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function tryParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}
