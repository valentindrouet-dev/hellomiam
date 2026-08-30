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

  // Les photos vivent en data-URL depuis que l'appli est 100 % statique.
  // Toute autre source (URL distante) est écartée : elle casserait hors-ligne.
  const photo = typeof src.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(src.photo)
    ? src.photo
    : null

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

// Extrait une liste de recettes d'un texte collé (JSON pur, JSON dans des
// balises ```...```, objet unique, {recipes:[...]} ou tableau).
export function parseImportText(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { recipes: [], error: 'Rien à importer' }

  let parsed = tryParse(raw)
  if (parsed === undefined) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)
    if (fenced) parsed = tryParse(fenced[1].trim())
  }
  if (parsed === undefined) {
    // Dernier recours : du premier { ou [ au dernier } ou ].
    const start = Math.min(...['{', '['].map(c => raw.indexOf(c)).filter(i => i >= 0))
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
    if (Number.isFinite(start) && end > start) parsed = tryParse(raw.slice(start, end + 1))
  }
  if (parsed === undefined) return { recipes: [], error: 'JSON illisible — vérifie que tu as bien collé la réponse complète de Claude' }

  const list = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed?.recipes) ? parsed.recipes
    : [parsed]
  return { recipes: list, error: null }
}

function tryParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}
