// HelloMiam — application complète. Pas de framework, pas de build : des
// modules ES chargés directement par le navigateur, comme les autres apps
// du dépôt. Toute la logique de calcul vit dans lib/ et est testée avec
// `npm test`.

import { CATEGORIES, DEPTS, UNITS, categoryInfo, deptInfo } from './lib/constants.js'
import { normalizeName } from './lib/normalize.js'
import { formatQty } from './lib/units.js'
import { portionsFactor, scaleIngredient, equivalentServings } from './lib/portions.js'
import { aggregateIngredients, extraToLine } from './lib/aggregate.js'
import { priceLines, formatPrice } from './lib/pricing.js'
import { validateRecipe, parseImportText } from './lib/validate.js'
import { buildScanPrompt, buildCreatePrompt, copyText, sharePrompt, CLAUDE_URL } from './lib/claudePrompts.js'
import { Store, loadHousehold, saveHousehold, SUPABASE_SQL, loadRemoteConfig } from './lib/store.js'

const store = new Store()
let household = loadHousehold()
let booted = false

const screenEl = document.getElementById('screen')
const tabbarEl = document.getElementById('tabbar')
const sheetHost = document.getElementById('sheet-host')
const toastHost = document.getElementById('toast-host')

// ——— Petits outils ————————————————————————————————————————————————

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

const CAT_SOFT = {
  hellofresh: 'var(--sage-soft)',
  perso: 'var(--coral-soft)',
  resto: 'var(--lavande-soft)',
  claude: 'var(--gold-soft)',
}

let toastTimer = null
function toast(message, kind = 'ok') {
  clearTimeout(toastTimer)
  toastHost.innerHTML = `<div class="toast ${kind === 'error' ? 'error' : ''}">${esc(message)}</div>`
  toastTimer = setTimeout(() => (toastHost.innerHTML = ''), kind === 'error' ? 4200 : 2400)
}

// Enveloppe toute action asynchrone : les erreurs deviennent un message
// lisible au lieu d'une page figée.
async function run(fn, { rerender = true } = {}) {
  try {
    await fn()
    if (rerender) render()
    return true
  } catch (e) {
    toast(e.message || 'Oups, ça n’a pas marché', 'error')
    return false
  }
}

function totalTime(recipe) {
  const total = (recipe.prepMin || 0) + (recipe.cookMin || 0)
  if (!total) return null
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

function navigate(path) {
  location.hash = path ? `#/${path}` : '#/'
}

function route() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

// ——— Feuilles modales ————————————————————————————————————————————

function openSheet(title, bodyHtml) {
  sheetHost.innerHTML = `
    <div class="overlay" data-close-overlay>
      <div class="sheet" role="dialog" aria-label="${esc(title)}">
        <div class="grab"></div>
        <div class="sheet-head">
          ${title ? `<h2>${esc(title)}</h2>` : '<span></span>'}
          <button class="icon-btn plain" data-act="close-sheet" aria-label="Fermer">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>`
  const first = sheetHost.querySelector('input, textarea, select')
  if (first) setTimeout(() => first.focus(), 60)
}

function closeSheet() {
  sheetHost.innerHTML = ''
}

// ——— Composants réutilisés ————————————————————————————————————————

function stepperHtml(action, value, { min = 0, max = 20, small = false, label = '' } = {}) {
  return `
    <div class="stepper ${small ? 'small' : ''}">
      ${label ? `<span style="font-size:${small ? 15 : 16}px;font-weight:700">${label}</span>` : ''}
      <button type="button" class="step-btn" data-act="${action}" data-delta="-1" ${value <= min ? 'disabled' : ''} aria-label="moins">−</button>
      <span class="step-val">${value}</span>
      <button type="button" class="step-btn" data-act="${action}" data-delta="1" ${value >= max ? 'disabled' : ''} aria-label="plus">+</button>
    </div>`
}

function peopleHtml(action, adults, children, small = false) {
  return `
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
      ${stepperHtml(`${action}:adults`, adults, { small, label: '👤' })}
      ${stepperHtml(`${action}:children`, children, { small, label: '🧒' })}
    </div>`
}

function unitOptions(selected) {
  return ['', ...UNITS].map(u =>
    `<option value="${esc(u)}" ${u === (selected ?? '') ? 'selected' : ''}>${u === '' ? '—' : esc(u)}</option>`
  ).join('')
}

function deptOptions(selected) {
  return DEPTS.map(d =>
    `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.emoji} ${esc(d.label)}</option>`
  ).join('')
}

function categoryChips(selected, action) {
  return `<div class="chips" style="margin:0;padding:0">${CATEGORIES.map(c => `
    <button type="button" class="chip ${c.id} ${selected === c.id ? 'active' : ''}" data-act="${action}" data-cat="${c.id}">
      ${c.emoji} ${esc(c.label)}
    </button>`).join('')}</div>`
}

function backHeader(title, backPath) {
  return `
    <div class="back-header">
      <button class="icon-btn" data-act="go" data-path="${esc(backPath)}" aria-label="Retour">←</button>
      <h1>${esc(title)}</h1>
    </div>`
}

// ——— État transitoire des écrans ————————————————————————————————
// (recherche, filtres, brouillons de formulaire — jamais persisté)

const ui = {
  query: '',
  cat: 'toutes',
  cook: { step: 0, showIngredients: false },
  form: null,
  paste: { text: '', preview: null },
  scanCat: 'hellofresh',
}

// ——— Écran : liste des recettes ————————————————————————————————

function renderRecipes() {
  const q = normalizeName(ui.query)
  const list = store.state.recipes.filter(r => {
    if (ui.cat !== 'toutes' && r.category !== ui.cat) return false
    if (!q) return true
    const hay = normalizeName(`${r.title} ${r.ingredients.map(i => i.name).join(' ')}`)
    return q.split(' ').every(w => hay.includes(w))
  })

  const cards = list.map(r => {
    const info = categoryInfo(r.category)
    const time = totalTime(r)
    return `
      <button class="recipe-card" data-act="open-recipe" data-id="${esc(r.id)}">
        ${r.photo
          ? `<img class="recipe-thumb" src="${esc(r.photo)}" alt="" loading="lazy">`
          : `<span class="recipe-thumb" style="background:${CAT_SOFT[info.id]}">${info.emoji}</span>`}
        <span class="grow">
          <span class="title">${esc(r.title)}</span>
          <span class="meta">
            <span class="badge ${info.id}">${info.emoji} ${esc(info.label)}</span>
            ${time ? `<span class="meta-txt">⏱ ${time}</span>` : ''}
            <span class="meta-txt">👤 ${r.servings}</span>
          </span>
        </span>
      </button>`
  }).join('')

  screenEl.innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="logo">🍲</span>
        <h1>HelloMiam</h1>
        <span class="meta-txt">${store.state.recipes.length} recette${store.state.recipes.length > 1 ? 's' : ''}</span>
      </div>

      <div class="searchbar">
        <span aria-hidden>🔍</span>
        <input type="search" id="q" placeholder="Plat, ingrédient…" value="${esc(ui.query)}">
        ${ui.query ? '<button class="icon-btn plain" data-act="clear-q">✕</button>' : ''}
      </div>

      <div class="chips">
        <button class="chip ${ui.cat === 'toutes' ? 'active' : ''}" data-act="filter" data-cat="toutes">Toutes</button>
        ${CATEGORIES.map(c => `
          <button class="chip ${c.id} ${ui.cat === c.id ? 'active' : ''}" data-act="filter" data-cat="${c.id}">
            ${c.emoji} ${esc(c.label)}
          </button>`).join('')}
      </div>

      ${list.length
        ? `<div class="stack">${cards}</div>`
        : `<div class="empty">
             <div class="big">🥣</div>
             <p>${ui.query || ui.cat !== 'toutes' ? 'Aucune recette ne correspond.' : 'La bible est vide — ajoute ta première recette !'}</p>
             <button class="btn btn-primary" style="width:auto;margin:0 auto" data-act="go" data-path="ajouter">＋ Ajouter une recette</button>
           </div>`}
    </div>`

  const input = screenEl.querySelector('#q')
  input.addEventListener('input', e => {
    ui.query = e.target.value
    const pos = e.target.selectionStart
    renderRecipes()
    const again = screenEl.querySelector('#q')
    again.focus()
    again.setSelectionRange(pos, pos)
  })
}

// ——— Écran : détail d'une recette ————————————————————————————————

function renderDetail(recipe) {
  const info = categoryInfo(recipe.category)
  const inCart = store.state.cart.recipes.find(c => c.recipeId === recipe.id)
  const adults = ui.detailAdults ?? (inCart ? inCart.adults : household.adults)
  const children = ui.detailChildren ?? (inCart ? inCart.children : household.children)
  ui.detailAdults = adults
  ui.detailChildren = children

  const factor = portionsFactor(adults, children, recipe.servings)
  const scaled = recipe.ingredients.map(ing => scaleIngredient(ing, factor))
  const time = totalTime(recipe)

  screenEl.innerHTML = `
    <div class="screen" style="padding-top:0">
      <div class="detail-hero" style="background:${recipe.photo ? 'none' : CAT_SOFT[info.id]}">
        ${recipe.photo ? `<img src="${esc(recipe.photo)}" alt="">` : `<span>${info.emoji}</span>`}
        <div class="float-btns">
          <button class="icon-btn" data-act="go" data-path="" aria-label="Retour">←</button>
          <div class="grow"></div>
          <button class="icon-btn" data-act="edit-recipe" data-id="${esc(recipe.id)}" aria-label="Modifier">✏️</button>
          <button class="icon-btn" data-act="delete-recipe" data-id="${esc(recipe.id)}" aria-label="Supprimer">🗑️</button>
        </div>
      </div>

      <h1 style="font-size:24px;font-weight:800;margin:16px 0 8px">${esc(recipe.title)}</h1>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <span class="badge ${info.id}">${info.emoji} ${esc(info.label)}</span>
        ${recipe.prepMin != null ? `<span class="meta-txt">🔪 ${recipe.prepMin} min</span>` : ''}
        ${recipe.cookMin != null ? `<span class="meta-txt">🍳 ${recipe.cookMin} min</span>` : ''}
        ${time ? `<span class="meta-txt">⏱ ${time} en tout</span>` : ''}
      </div>

      <div class="card" style="margin-top:16px">
        ${peopleHtml('detail', adults, children)}
        <div class="hint" style="margin-top:10px">
          ${children > 0
            ? `≈ ${formatQty(Math.round(equivalentServings(adults, children) * 10) / 10)} portions adulte (un enfant = ⅔)`
            : `Recette prévue pour ${recipe.servings} — quantités ajustées automatiquement`}
        </div>
      </div>

      <div class="row" style="margin-top:12px;gap:10px">
        <button class="btn btn-coral" style="flex:1" data-act="cook" data-id="${esc(recipe.id)}">▶ Cuisiner</button>
        <button class="btn ${inCart ? 'btn-soft' : 'btn-primary'}" style="flex:1" data-act="add-cart" data-id="${esc(recipe.id)}">
          ${inCart ? '✓ Dans les courses' : '🛒 Aux courses'}
        </button>
      </div>
      ${inCart ? `<button class="btn btn-ghost btn-sm" style="margin:6px auto 0" data-act="remove-cart" data-id="${esc(recipe.id)}">Retirer des courses</button>` : ''}

      <div class="section-title">🧾 Ingrédients</div>
      <div class="card">
        ${scaled.map(ing => `
          <div class="ingredient-row">
            <span class="qty">${esc(ing.text)}</span>
            <span class="grow">${esc(ing.name)}</span>
          </div>`).join('')}
      </div>

      <div class="section-title">👩‍🍳 Étapes</div>
      <div class="card">
        ${recipe.steps.map((s, i) => `
          <div class="step-row">
            <span class="step-num">${i + 1}</span>
            <span class="grow">${esc(s)}</span>
          </div>`).join('')}
      </div>

      ${recipe.notes ? `
        <div class="section-title">💡 Notes</div>
        <div class="card" style="color:var(--muted);font-weight:600">${esc(recipe.notes)}</div>` : ''}
    </div>`
}

// ——— Écran : mode cuisine ————————————————————————————————————————

let wakeLock = null
async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen')
  } catch { /* non supporté : tant pis */ }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
}

function renderCook(recipe) {
  const step = Math.min(ui.cook.step, recipe.steps.length - 1)
  const total = recipe.steps.length
  const last = step === total - 1
  const inCart = store.state.cart.recipes.find(c => c.recipeId === recipe.id)
  const adults = inCart ? inCart.adults : household.adults
  const children = inCart ? inCart.children : household.children
  const factor = portionsFactor(adults, children, recipe.servings)
  const scaled = recipe.ingredients.map(ing => scaleIngredient(ing, factor))

  screenEl.innerHTML = `
    <div class="cookmode" id="cookmode">
      <div class="cook-head">
        <button class="icon-btn" data-act="open-recipe" data-id="${esc(recipe.id)}" aria-label="Quitter">✕</button>
        <span class="cook-title">${esc(recipe.title)}</span>
        <span class="meta-txt" style="font-weight:800">${step + 1}/${total}</span>
      </div>

      <div class="cook-progress">
        ${recipe.steps.map((_, i) => `<i class="${i <= step ? 'done' : ''}"></i>`).join('')}
      </div>

      <div class="cook-body" id="cook-body">
        <div class="cook-step-label">Étape ${step + 1} sur ${total}</div>
        <div class="cook-text">${esc(recipe.steps[step])}</div>
      </div>

      ${ui.cook.showIngredients ? `
        <div class="cook-ingredients">
          ${scaled.map(ing => `
            <div class="ingredient-row">
              <span class="qty">${esc(ing.text)}</span>
              <span class="grow">${esc(ing.name)}</span>
            </div>`).join('')}
        </div>` : ''}

      <div class="cook-actions">
        <button class="btn btn-soft" style="flex:.7" data-act="cook-ingredients">🧾</button>
        <button class="btn btn-soft" style="flex:1" data-act="cook-prev" ${step === 0 ? 'disabled' : ''}>← Préc.</button>
        <button class="btn ${last ? 'btn-coral' : 'btn-primary'}" style="flex:1.6" data-act="cook-next" data-id="${esc(recipe.id)}">
          ${last ? 'Terminé 🎉' : 'Suivant →'}
        </button>
      </div>
    </div>`

  // Balayage gauche / droite pour changer d'étape.
  const body = screenEl.querySelector('#cook-body')
  let startX = null
  body.addEventListener('touchstart', e => { startX = e.touches[0].clientX }, { passive: true })
  body.addEventListener('touchend', e => {
    if (startX == null) return
    const delta = e.changedTouches[0].clientX - startX
    startX = null
    if (Math.abs(delta) < 60) return
    if (delta < 0) nextCookStep(recipe)
    else { ui.cook.step = Math.max(0, step - 1); render() }
  }, { passive: true })
}

function nextCookStep(recipe) {
  if (ui.cook.step >= recipe.steps.length - 1) {
    toast('Bon appétit ! 🍽️')
    navigate(`recette/${recipe.id}`)
  } else {
    ui.cook.step += 1
    render()
  }
}

// ——— Écran : formulaire de recette ————————————————————————————————

function blankIngredient() {
  return { name: '', qty: '', unit: 'g', dept: 'fruits-legumes' }
}

function startForm(recipe) {
  ui.form = recipe
    ? {
        id: recipe.id,
        title: recipe.title,
        category: recipe.category,
        servings: recipe.servings,
        prepMin: recipe.prepMin ?? '',
        cookMin: recipe.cookMin ?? '',
        notes: recipe.notes ?? '',
        photo: recipe.photo ?? null,
        ingredients: recipe.ingredients.map(i => ({
          name: i.name,
          qty: i.qty == null ? '' : String(i.qty).replace('.', ','),
          unit: i.unit ?? '',
          dept: i.dept,
        })),
        steps: [...recipe.steps],
      }
    : {
        id: null, title: '', category: 'perso', servings: 2, prepMin: '', cookMin: '',
        notes: '', photo: null, ingredients: [blankIngredient()], steps: [''],
      }
}

function renderForm() {
  const f = ui.form
  screenEl.innerHTML = `
    <div class="screen">
      ${backHeader(f.id ? 'Modifier la recette' : 'Nouvelle recette', f.id ? `recette/${f.id}` : 'ajouter')}
      <div class="stack">
        <label class="field">Titre
          <input data-bind="title" value="${esc(f.title)}" placeholder="Lasagnes de la maison">
        </label>

        <div class="field" style="display:block">
          <span style="display:block;margin-bottom:6px">Catégorie</span>
          ${categoryChips(f.category, 'form-cat')}
        </div>

        <div class="card row" style="justify-content:space-between">
          <span style="font-weight:700">Pour combien d’adultes ?</span>
          ${stepperHtml('form-servings', f.servings, { min: 1, small: true })}
        </div>

        <div class="row">
          <label class="field grow">Préparation (min)
            <input type="number" inputmode="numeric" min="0" data-bind="prepMin" value="${esc(f.prepMin)}" placeholder="15">
          </label>
          <label class="field grow">Cuisson (min)
            <input type="number" inputmode="numeric" min="0" data-bind="cookMin" value="${esc(f.cookMin)}" placeholder="30">
          </label>
        </div>

        <div class="field" style="display:block">
          <span style="display:block;margin-bottom:6px">Photo (facultatif)</span>
          <input type="file" accept="image/*" id="photo-input" hidden>
          ${f.photo
            ? `<div class="row">
                 <img src="${esc(f.photo)}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:14px">
                 <button type="button" class="btn btn-soft btn-sm" data-act="pick-photo">Changer</button>
                 <button type="button" class="btn btn-danger-soft btn-sm" data-act="drop-photo">Retirer</button>
               </div>`
            : `<button type="button" class="btn btn-soft" data-act="pick-photo">📷 Ajouter une photo</button>`}
        </div>

        <div class="section-title" style="margin:10px 0 0">🧾 Ingrédients</div>
        ${f.ingredients.map((ing, i) => `
          <div class="card" style="padding:12px">
            <div class="row">
              <input class="grow" data-ing="${i}" data-field="name" value="${esc(ing.name)}" placeholder="Carotte">
              <button type="button" class="icon-btn plain" data-act="del-ing" data-i="${i}" aria-label="Retirer l’ingrédient">✕</button>
            </div>
            <div class="row" style="margin-top:8px">
              <input style="width:76px" inputmode="decimal" data-ing="${i}" data-field="qty" value="${esc(ing.qty)}" placeholder="200">
              <select style="width:110px" data-ing="${i}" data-field="unit">${unitOptions(ing.unit)}</select>
              <select class="grow" data-ing="${i}" data-field="dept">${deptOptions(ing.dept)}</select>
            </div>
          </div>`).join('')}
        <button type="button" class="btn btn-soft" data-act="add-ing">＋ Ingrédient</button>

        <div class="section-title" style="margin:10px 0 0">👩‍🍳 Étapes</div>
        ${f.steps.map((s, i) => `
          <div class="row" style="align-items:flex-start">
            <span class="step-num" style="margin-top:12px">${i + 1}</span>
            <textarea class="grow" rows="2" data-step="${i}" placeholder="Décris l’étape…">${esc(s)}</textarea>
            <button type="button" class="icon-btn plain" style="margin-top:6px" data-act="del-step" data-i="${i}" aria-label="Retirer l’étape">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-soft" data-act="add-step">＋ Étape</button>

        <label class="field">Notes (facultatif)
          <textarea data-bind="notes" rows="2" placeholder="Source, astuces, variantes…">${esc(f.notes)}</textarea>
        </label>

        <button class="btn btn-primary" data-act="save-recipe">
          ${f.id ? 'Enregistrer les modifications' : 'Ajouter à la bible 📖'}
        </button>
      </div>
    </div>`

  // Saisie : on met à jour le brouillon sans re-rendre (le focus reste en place).
  screenEl.querySelectorAll('[data-bind]').forEach(el => {
    el.addEventListener('input', e => { f[e.target.dataset.bind] = e.target.value })
  })
  screenEl.querySelectorAll('[data-ing]').forEach(el => {
    const handler = e => {
      f.ingredients[Number(e.target.dataset.ing)][e.target.dataset.field] = e.target.value
    }
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', handler)
  })
  screenEl.querySelectorAll('[data-step]').forEach(el => {
    el.addEventListener('input', e => { f.steps[Number(e.target.dataset.step)] = e.target.value })
  })
  screenEl.querySelector('#photo-input').addEventListener('change', onPhotoPicked)
}

// Réduit la photo avant stockage : en local comme en base commune, elle est
// gardée en data-URL, donc on vise petit (900 px, JPEG 72 %).
function shrinkImage(file, maxSize = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo illisible')) }
    img.src = url
  })
}

async function onPhotoPicked(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    ui.form.photo = await shrinkImage(file)
    render()
  } catch {
    toast('Photo illisible', 'error')
  }
}

async function saveForm() {
  const f = ui.form
  const draft = {
    title: f.title,
    category: f.category,
    servings: f.servings,
    prepMin: f.prepMin === '' ? null : Number(f.prepMin),
    cookMin: f.cookMin === '' ? null : Number(f.cookMin),
    notes: (f.notes || '').trim() || null,
    ingredients: f.ingredients
      .filter(i => i.name.trim())
      .map(i => ({ name: i.name, qty: i.qty === '' ? null : i.qty, unit: i.unit || null, dept: i.dept })),
    steps: f.steps.filter(s => s.trim()),
  }
  const { recipe, errors } = validateRecipe(draft)
  if (errors.length) {
    toast(errors.join(' · '), 'error')
    return
  }
  recipe.photo = f.photo ?? null // la photo est une data-URL, pas un chemin serveur
  await run(async () => {
    const saved = f.id ? await store.updateRecipe(f.id, recipe) : await store.addRecipe(recipe)
    toast(f.id ? 'Recette mise à jour ✓' : 'Recette ajoutée ✓')
    ui.form = null
    navigate(`recette/${saved.id}`)
  }, { rerender: false })
}

// ——— Écran : courses ————————————————————————————————————————————

function cartLines() {
  const cartRecipes = store.state.cart.recipes
    .map(c => ({ ...c, recipe: store.state.recipes.find(r => r.id === c.recipeId) }))
    .filter(c => c.recipe)
  const lines = aggregateIngredients(
    cartRecipes.map(c => ({ recipe: c.recipe, adults: c.adults, children: c.children }))
  )
  const extras = store.state.cart.extras.map(extraToLine)
  return { cartRecipes, priced: priceLines([...lines, ...extras], store.state.prices) }
}

function renderShopping() {
  const { cartRecipes, priced } = cartLines()
  const empty = cartRecipes.length === 0 && store.state.cart.extras.length === 0

  if (empty) {
    screenEl.innerHTML = `
      <div class="screen">
        <div class="header"><span class="logo">🛒</span><h1>Courses</h1></div>
        <div class="empty">
          <div class="big">🧺</div>
          <p>Choisis des recettes, la liste de courses se prépare toute seule.</p>
          <button class="btn btn-primary" style="width:auto;margin:0 auto" data-act="pick-recipes">＋ Choisir des recettes</button>
        </div>
      </div>`
    return
  }

  const byDept = new Map()
  for (const line of priced.lines) {
    if (!byDept.has(line.dept)) byDept.set(line.dept, [])
    byDept.get(line.dept).push(line)
  }

  const groups = DEPTS.filter(d => byDept.has(d.id)).map(d => `
    <div>
      <div class="dept-head"><span>${d.emoji}</span> ${esc(d.label)}</div>
      <div class="card" style="padding:4px 14px">
        ${byDept.get(d.id).map(shoppingLineHtml).join('')}
      </div>
    </div>`).join('')

  screenEl.innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="logo">🛒</span><h1>Courses</h1>
        <button class="btn btn-ghost btn-sm" data-act="clear-cart">Vider</button>
      </div>

      <div class="section-title">🍽️ Recettes au menu</div>
      <div class="stack">
        ${cartRecipes.map(c => `
          <div class="card" style="padding:12px">
            <div class="row">
              <button class="grow" style="text-align:left;font-weight:750;font-size:16px" data-act="open-recipe" data-id="${esc(c.recipeId)}">
                ${esc(c.recipe.title)}
              </button>
              <button class="icon-btn plain" data-act="remove-cart" data-id="${esc(c.recipeId)}" aria-label="Retirer la recette">✕</button>
            </div>
            <div style="margin-top:6px">
              ${peopleHtml(`cart:${c.recipeId}`, c.adults, c.children, true)}
            </div>
          </div>`).join('')}
        <button class="btn btn-soft" data-act="pick-recipes">＋ Ajouter une recette</button>
      </div>

      ${groups}

      <div class="stack" style="margin-top:16px">
        <button class="btn btn-soft" data-act="add-extra">＋ Autre article</button>
        <div class="total-card">
          <div>
            <div style="font-weight:800">Total estimé</div>
            <div class="hint">
              ${priced.unknown > 0 ? `${priced.unknown} article${priced.unknown > 1 ? 's' : ''} sans prix · ` : ''}prix indicatifs Carrefour
            </div>
          </div>
          <div class="amount">≈ ${formatPrice(priced.total)}</div>
        </div>
        <div class="hint" style="text-align:center">Touche un prix pour le corriger.</div>
      </div>
    </div>`
}

function shoppingLineHtml(line) {
  const checked = line.extra ? line.checked : !!store.state.cart.checked[line.key]
  const est = line.estimate
  return `
    <div class="checkrow ${checked ? 'checked' : ''}">
      <button class="checkbox" data-act="toggle-check" data-key="${esc(line.key)}" data-extra="${line.extra ? line.id : ''}" data-checked="${checked}" aria-label="Cocher">${checked ? '✓' : ''}</button>
      <div class="grow" data-act="toggle-check" data-key="${esc(line.key)}" data-extra="${line.extra ? line.id : ''}" data-checked="${checked}">
        <div class="item-name">
          ${line.qty != null ? `<span class="item-qty">${esc(line.text)} </span>` : ''}
          ${esc(line.name)}
          ${line.qty == null && line.text === 'selon goût' ? '<span class="meta-txt"> · selon goût</span>' : ''}
        </div>
        ${est
          ? `<button class="item-sub" data-act="edit-price" data-name="${esc(line.name)}" data-dept="${esc(line.dept)}" data-entry="${esc(est.entry.name)}">
               🏷 ${esc(est.buyLabel)} · <span class="price-tag">${est.approx ? '~' : ''}${formatPrice(est.cost)}</span>
             </button>`
          : `<button class="item-sub unknown" data-act="edit-price" data-name="${esc(line.name)}" data-dept="${esc(line.dept)}">
               <span class="price-tag">prix inconnu — ajouter</span>
             </button>`}
      </div>
      ${line.extra ? `<button class="icon-btn plain" data-act="del-extra" data-id="${esc(line.id)}" aria-label="Supprimer l’article">✕</button>` : ''}
    </div>`
}

// ——— Feuilles : choix de recettes, article libre, prix ————————————

function sheetPickRecipes() {
  const inCart = new Set(store.state.cart.recipes.map(c => c.recipeId))
  const list = store.state.recipes.filter(r => !inCart.has(r.id))
  openSheet('Ajouter une recette aux courses', `
    <div class="stack">
      ${list.length === 0 ? '<div class="hint" style="text-align:center;padding:20px">Toutes les recettes sont déjà au menu.</div>' : ''}
      ${list.map(r => `
        <button class="recipe-card" style="box-shadow:none;border:1.5px solid var(--line)" data-act="cart-add" data-id="${esc(r.id)}">
          <span class="grow">
            <span class="title">${esc(r.title)}</span>
            <span class="meta"><span class="meta-txt">👤 ${r.servings} · ${r.ingredients.length} ingrédients</span></span>
          </span>
          <span style="font-size:22px">＋</span>
        </button>`).join('')}
    </div>`)
}

function sheetAddExtra() {
  openSheet('Ajouter un article', `
    <form class="stack" id="extra-form">
      <input id="ex-name" placeholder="Essuie-tout, chocolat…">
      <div class="row">
        <input style="width:90px" inputmode="decimal" id="ex-qty" placeholder="Qté">
        <select style="width:120px" id="ex-unit">${unitOptions('')}</select>
        <select class="grow" id="ex-dept">${deptOptions('autres')}</select>
      </div>
      <button class="btn btn-primary" type="submit">Ajouter</button>
    </form>`)

  sheetHost.querySelector('#extra-form').addEventListener('submit', async e => {
    e.preventDefault()
    const name = sheetHost.querySelector('#ex-name').value.trim()
    if (!name) return
    const rawQty = sheetHost.querySelector('#ex-qty').value.replace(',', '.')
    const qty = Number(rawQty)
    await run(async () => {
      await store.addExtra({
        name,
        qty: rawQty !== '' && Number.isFinite(qty) && qty > 0 ? qty : null,
        unit: sheetHost.querySelector('#ex-unit').value || null,
        dept: sheetHost.querySelector('#ex-dept').value,
      })
      closeSheet()
    })
  })
}

function sheetEditPrice(name, dept, entryName) {
  const entry = entryName ? store.state.prices.find(p => p.name === entryName) : null
  openSheet(entry ? `Corriger « ${entry.name} »` : 'Nouveau prix de référence', `
    <form class="stack" id="price-form">
      <label class="field">Produit
        <input id="p-name" value="${esc(entry?.name ?? name)}">
      </label>
      <div class="row">
        <label class="field" style="width:110px">Prix (€)
          <input inputmode="decimal" id="p-price" value="${entry ? esc(String(entry.price).replace('.', ',')) : ''}" placeholder="1,95">
        </label>
        <label class="field" style="width:90px">Pour
          <input inputmode="decimal" id="p-qty" value="${entry ? esc(String(entry.unitQty).replace('.', ',')) : '1'}">
        </label>
        <label class="field grow">Unité
          <select id="p-unit">${unitOptions(entry?.unit ?? 'kg')}</select>
        </label>
      </div>
      <label class="row" style="font-weight:700;gap:10px">
        <input type="checkbox" style="width:22px;height:22px" id="p-loose" ${entry ? (entry.loose ? 'checked' : '') : 'checked'}>
        Vendu au poids / à l’unité (sinon : par paquet entier)
      </label>
      <label class="field">Rayon
        <select id="p-dept">${deptOptions(entry?.dept ?? dept ?? 'autres')}</select>
      </label>
      <button class="btn btn-primary" type="submit">Enregistrer</button>
    </form>`)

  sheetHost.querySelector('#price-form').addEventListener('submit', async e => {
    e.preventDefault()
    const pName = sheetHost.querySelector('#p-name').value.trim()
    const price = Number(sheetHost.querySelector('#p-price').value.replace(',', '.'))
    const unitQty = Number(sheetHost.querySelector('#p-qty').value.replace(',', '.'))
    if (!pName || !Number.isFinite(price) || price < 0 || !Number.isFinite(unitQty) || unitQty <= 0) {
      toast('Vérifie le nom, la quantité et le prix', 'error')
      return
    }
    await run(async () => {
      await store.upsertPrice({
        name: pName,
        price,
        unitQty,
        unit: sheetHost.querySelector('#p-unit').value || 'pièce',
        loose: sheetHost.querySelector('#p-loose').checked,
        dept: sheetHost.querySelector('#p-dept').value,
      })
      toast('Prix enregistré ✓')
      closeSheet()
    })
  })
}

// ——— Écran : ajouter ————————————————————————————————————————————

function renderAdd(sub) {
  if (sub === 'scan') return renderPromptFlow('scan')
  if (sub === 'claude') return renderPromptFlow('claude')
  if (sub === 'import') return renderImport()
  if (sub === 'commune') return renderRemoteSetup()

  screenEl.innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="logo">➕</span><h1>Ajouter</h1>
        <span class="mode-pill ${store.isRemote ? 'commun' : ''}">${store.isRemote ? '☁️ commune' : '📱 locale'}</span>
      </div>
      <div class="stack">
        ${addOption('📷', 'var(--lavande-soft)', 'Scanner une recette', 'Une photo de fiche ou de livre, Claude la transcrit', 'ajouter/scan')}
        ${addOption('✨', 'var(--gold-soft)', 'Demander à Claude', 'Claude invente une recette au bon format', 'ajouter/claude')}
        ${addOption('✍️', 'var(--coral-soft)', 'Créer à la main', 'Le formulaire complet, pour tes recettes à toi', 'ajouter/nouvelle')}
        ${addOption('📋', 'var(--sage-soft)', 'Importer du JSON', 'Colle une recette au format HelloMiam', 'ajouter/import')}
        <div class="section-title">⚙️ Réglages</div>
        ${addOption(store.isRemote ? '☁️' : '📱', 'var(--bg-deep)', 'Base commune',
          store.isRemote ? 'Partagée avec la famille — appuie pour gérer' : 'Actuellement sur ce téléphone seulement', 'ajouter/commune')}
        <button class="btn btn-soft" data-act="export-backup">💾 Sauvegarder mes données (JSON)</button>
      </div>
    </div>`
}

function addOption(emoji, bg, title, sub, path) {
  return `
    <button class="add-option" data-act="go" data-path="${esc(path)}">
      <span class="emoji" style="background:${bg}">${emoji}</span>
      <span class="grow">
        <span class="title" style="display:block">${esc(title)}</span>
        <span class="sub">${esc(sub)}</span>
      </span>
      <span style="color:var(--muted);font-size:20px">›</span>
    </button>`
}

function renderPromptFlow(kind) {
  const isScan = kind === 'scan'
  const prompt = isScan ? buildScanPrompt(ui.scanCat) : buildCreatePrompt()
  const steps = isScan
    ? [
        'Copie le prompt ci-dessous et ouvre <b>claude.ai</b>.',
        'Colle le prompt, <b>joins la ou les photos</b> de la recette, envoie.',
        'Copie la réponse de Claude et colle-la plus bas.',
      ]
    : [
        'Copie le <b>mode d’emploi</b> ci-dessous et colle-le dans claude.ai.',
        'Discute de tes envies — Claude crée les recettes au format HelloMiam.',
        'Colle sa réponse JSON plus bas pour l’importer.',
      ]

  screenEl.innerHTML = `
    <div class="screen">
      ${backHeader(isScan ? 'Scanner une recette' : 'Demander à Claude', 'ajouter')}
      <div class="stack">
        <div class="card stack" style="gap:14px">
          ${steps.map((s, i) => `<div class="step-guide"><span class="n">${i + 1}</span><span>${s}</span></div>`).join('')}
        </div>

        ${isScan ? `
          <div class="field" style="display:block">
            <span style="display:block;margin-bottom:6px">Catégorie de la recette scannée</span>
            ${categoryChips(ui.scanCat, 'scan-cat')}
          </div>` : ''}

        <button class="btn btn-primary" data-act="copy-prompt" data-kind="${kind}">📋 Copier le prompt</button>
        <div class="row">
          ${navigator.share ? `<button class="btn btn-soft" style="flex:1" data-act="share-prompt" data-kind="${kind}">Partager</button>` : ''}
          <a class="btn btn-gold-soft" style="flex:1;text-decoration:none" href="${CLAUDE_URL}" target="_blank" rel="noreferrer">Ouvrir claude.ai ↗</a>
        </div>
        <details><summary class="hint" style="cursor:pointer">Voir le prompt</summary><pre class="prompt-preview">${esc(prompt)}</pre></details>
        <hr class="divider">
        ${pasteZoneHtml('Colle ici la réponse JSON de Claude…')}
      </div>
    </div>`
  wirePasteZone()
}

function renderImport() {
  screenEl.innerHTML = `
    <div class="screen">
      ${backHeader('Importer du JSON', 'ajouter')}
      <div class="stack">
        <div class="hint">Colle une ou plusieurs recettes au format HelloMiam, ou une sauvegarde exportée depuis l’appli.</div>
        ${pasteZoneHtml('{"recipes": [ … ]}')}
      </div>
    </div>`
  wirePasteZone()
}

function pasteZoneHtml(placeholder) {
  const p = ui.paste
  let previewHtml = ''
  if (p.preview) {
    previewHtml = `
      ${p.preview.valid.map(v => `
        <div class="card row" style="padding:12px">
          <span style="font-size:22px">✅</span>
          <span class="grow">
            <span style="font-weight:750">${esc(v.cleaned.title)}</span>
            <span class="hint" style="display:block">
              ${v.cleaned.ingredients.length} ingrédient${v.cleaned.ingredients.length > 1 ? 's' : ''} ·
              ${v.cleaned.steps.length} étape${v.cleaned.steps.length > 1 ? 's' : ''} · pour ${v.cleaned.servings}
            </span>
          </span>
          <span class="badge ${categoryInfo(v.cleaned.category).id}">
            ${categoryInfo(v.cleaned.category).emoji} ${esc(categoryInfo(v.cleaned.category).label)}
          </span>
        </div>`).join('')}
      ${p.preview.invalid.map(msg => `
        <div class="card" style="padding:12px;background:var(--danger-soft);color:var(--danger);font-weight:650;box-shadow:none">⚠️ ${esc(msg)}</div>`).join('')}
      ${p.preview.valid.length
        ? `<button class="btn btn-primary" data-act="do-import">Importer ${p.preview.valid.length} recette${p.preview.valid.length > 1 ? 's' : ''} 📖</button>`
        : ''}`
  }

  return `
    <div class="stack">
      <textarea id="paste" rows="5" placeholder="${esc(placeholder)}">${esc(p.text)}</textarea>
      ${p.preview ? '' : `<button class="btn btn-lavande-soft" data-act="analyse-paste" ${p.text.trim() ? '' : 'disabled'}>Vérifier avant import</button>`}
      ${previewHtml}
    </div>`
}

function wirePasteZone() {
  const ta = screenEl.querySelector('#paste')
  if (!ta) return
  ta.addEventListener('input', e => {
    const wasEmpty = !ui.paste.text.trim()
    ui.paste.text = e.target.value
    ui.paste.preview = null
    // Le bouton n'apparaît qu'au premier caractère : un seul re-rendu.
    if (wasEmpty !== !e.target.value.trim()) {
      render()
      const again = screenEl.querySelector('#paste')
      again.focus()
      again.setSelectionRange(again.value.length, again.value.length)
    }
  })
}

function analysePaste() {
  const { recipes, error } = parseImportText(ui.paste.text)
  if (error) {
    toast(error, 'error')
    return
  }
  const valid = []
  const invalid = []
  recipes.forEach((raw, i) => {
    const { recipe, errors } = validateRecipe(raw)
    if (errors.length) invalid.push(`Recette ${i + 1} : ${errors.join(', ')}`)
    else valid.push({ raw: recipe, cleaned: recipe })
  })
  ui.paste.preview = { valid, invalid }
  render()
}

// ——— Écran : base commune ————————————————————————————————————————

function renderRemoteSetup() {
  const config = loadRemoteConfig()
  screenEl.innerHTML = `
    <div class="screen">
      ${backHeader('Base commune', 'ajouter')}
      <div class="stack">
        <div class="card row" style="justify-content:space-between">
          <div>
            <div style="font-weight:800">Mode actuel</div>
            <div class="hint">${store.isRemote ? 'Partagé avec toute la famille' : 'Ce téléphone uniquement'}</div>
          </div>
          <span class="mode-pill ${store.isRemote ? 'commun' : ''}">${store.isRemote ? '☁️ commune' : '📱 locale'}</span>
        </div>

        <div class="info-card">
          GitHub Pages ne sert que des fichiers : pour que <b>tout le monde voie les mêmes recettes</b>,
          il faut une base en ligne. Supabase en offre une gratuite, en 5 minutes et sans carte bancaire.
        </div>

        <details class="faq">
          <summary>1 · Créer la base (une seule fois)</summary>
          <p>
            Va sur <a class="link-inline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>,
            crée un compte puis un projet (n’importe quelle région).
            Ouvre <b>SQL Editor</b>, colle le script ci-dessous et clique <b>Run</b>.
          </p>
          <div style="margin-top:10px">
            <button class="btn btn-soft btn-sm" data-act="copy-sql">📋 Copier le script SQL</button>
          </div>
          <pre class="sql-box" style="margin-top:10px">${esc(SUPABASE_SQL)}</pre>
        </details>

        <details class="faq">
          <summary>2 · Où trouver l’URL et la clé ?</summary>
          <p>
            Dans Supabase : <b>Settings → API</b>. Copie <b>Project URL</b>
            (du type https://xxxx.supabase.co) et la clé <b>anon public</b>.
            Colle-les ci-dessous, sur chaque téléphone de la famille.
          </p>
        </details>

        <label class="field">URL du projet Supabase
          <input id="r-url" placeholder="https://xxxx.supabase.co" value="${esc(config?.url ?? '')}">
        </label>
        <label class="field">Clé anon (public)
          <input id="r-key" placeholder="eyJhbGciOi…" value="${esc(config?.key ?? '')}">
        </label>

        <button class="btn btn-primary" data-act="connect-remote">☁️ Connecter la base commune</button>
        ${store.isRemote ? '<button class="btn btn-danger-soft" data-act="disconnect-remote">Revenir en local</button>' : ''}

        <div class="hint" style="text-align:center">
          Les clés restent sur ce téléphone : elles ne sont jamais écrites dans le dépôt GitHub.
        </div>
      </div>
    </div>`
}

async function connectRemote() {
  const url = screenEl.querySelector('#r-url').value.trim()
  const key = screenEl.querySelector('#r-key').value.trim()
  if (!url || !key) {
    toast('Renseigne l’URL et la clé', 'error')
    return
  }
  await run(async () => {
    const config = { url: url.replace(/\/+$/, ''), key }
    const { pushed, skipped } = await store.pushLocalTo(config)
    await store.useRemote(config)
    toast(skipped
      ? 'Base commune connectée ☁️'
      : `Base commune connectée — ${pushed} recette${pushed > 1 ? 's' : ''} envoyée${pushed > 1 ? 's' : ''} ☁️`)
    navigate('')
  }, { rerender: false })
}

// ——— Sauvegarde ————————————————————————————————————————————————

function exportBackup() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `hellomiam-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast('Sauvegarde téléchargée 💾')
}

// ——— Barre d'onglets ——————————————————————————————————————————————

const TAB_ICONS = {
  recettes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M9 8h7M9 11.5h5"/></svg>',
  courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/><circle cx="10" cy="20.2" r="1.4"/><circle cx="17.5" cy="20.2" r="1.4"/></svg>',
  ajouter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>',
}

function renderTabbar(active, hidden) {
  tabbarEl.hidden = hidden
  if (hidden) return
  const count = store.state.cart.recipes.length
  tabbarEl.innerHTML = `
    <button class="${active === 'recettes' ? 'active' : ''}" data-act="go" data-path="">${TAB_ICONS.recettes}Recettes</button>
    <button class="${active === 'courses' ? 'active' : ''}" data-act="go" data-path="courses">${TAB_ICONS.courses}Courses${count ? `<span class="tab-badge">${count}</span>` : ''}</button>
    <button class="${active === 'ajouter' ? 'active' : ''}" data-act="go" data-path="ajouter">${TAB_ICONS.ajouter}Ajouter</button>`
}

// ——— Routeur ————————————————————————————————————————————————————

function render() {
  if (!booted) return
  const [a, b, c] = route()

  if (a === 'courses') {
    renderShopping()
    renderTabbar('courses', false)
  } else if (a === 'ajouter') {
    if (b === 'nouvelle') {
      if (!ui.form || ui.form.id) startForm(null)
      renderForm()
    } else {
      renderAdd(b)
    }
    renderTabbar('ajouter', false)
  } else if (a === 'recette' && b) {
    const recipe = store.state.recipes.find(r => r.id === b)
    if (!recipe) {
      navigate('')
      return
    }
    if (c === 'cuisine') {
      renderCook(recipe)
      renderTabbar('recettes', true)
      return
    }
    if (c === 'modifier') {
      if (!ui.form || ui.form.id !== recipe.id) startForm(recipe)
      renderForm()
    } else {
      renderDetail(recipe)
    }
    renderTabbar('recettes', false)
  } else {
    renderRecipes()
    renderTabbar('recettes', false)
  }
}

window.addEventListener('hashchange', () => {
  const [a, b, c] = route()
  // On repart du haut et on nettoie l'état d'écran en changeant de page.
  if (!(a === 'recette' && c === 'cuisine')) {
    ui.cook = { step: 0, showIngredients: false }
    releaseWakeLock()
  } else {
    acquireWakeLock()
  }
  if (!(a === 'recette' && !c)) {
    ui.detailAdults = undefined
    ui.detailChildren = undefined
  }
  if (a !== 'ajouter') ui.paste = { text: '', preview: null }
  closeSheet()
  window.scrollTo(0, 0)
  render()
})

// ——— Actions (délégation d'événements) ————————————————————————————

document.addEventListener('click', async e => {
  if (e.target.closest('[data-close-overlay]') === e.target && e.target.hasAttribute?.('data-close-overlay')) {
    closeSheet()
    return
  }

  const el = e.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  const id = el.dataset.id

  if (act === 'close-sheet') return closeSheet()

  // — navigation —
  if (act === 'go') return navigate(el.dataset.path)
  if (act === 'open-recipe') return navigate(`recette/${id}`)
  if (act === 'edit-recipe') return navigate(`recette/${id}/modifier`)
  if (act === 'cook') return navigate(`recette/${id}/cuisine`)

  // — liste des recettes —
  if (act === 'filter') { ui.cat = el.dataset.cat === ui.cat ? 'toutes' : el.dataset.cat; return render() }
  if (act === 'clear-q') { ui.query = ''; return render() }

  // — détail —
  if (act.startsWith('detail:')) {
    const field = act.split(':')[1]
    const delta = Number(el.dataset.delta)
    if (field === 'adults') ui.detailAdults = Math.max(0, Math.min(20, ui.detailAdults + delta))
    else ui.detailChildren = Math.max(0, Math.min(20, ui.detailChildren + delta))
    household = { adults: ui.detailAdults, children: ui.detailChildren }
    saveHousehold(household.adults, household.children)
    const [, rid] = route()
    const inCart = store.state.cart.recipes.find(cc => cc.recipeId === rid)
    if (inCart) return run(() => store.setCartRecipe(rid, ui.detailAdults, ui.detailChildren))
    return render()
  }
  if (act === 'add-cart') {
    return run(async () => {
      const already = store.state.cart.recipes.some(cc => cc.recipeId === id)
      await store.setCartRecipe(id, ui.detailAdults ?? household.adults, ui.detailChildren ?? household.children)
      toast(already ? 'Courses mises à jour 🛒' : 'Ajouté aux courses 🛒')
    })
  }
  if (act === 'remove-cart') return run(() => store.removeCartRecipe(id))
  if (act === 'delete-recipe') {
    const recipe = store.state.recipes.find(r => r.id === id)
    if (!confirm(`Supprimer « ${recipe.title} » ?`)) return
    return run(async () => {
      await store.deleteRecipe(id)
      toast('Recette supprimée')
      navigate('')
    }, { rerender: false })
  }

  // — mode cuisine —
  if (act === 'cook-prev') { ui.cook.step = Math.max(0, ui.cook.step - 1); return render() }
  if (act === 'cook-next') {
    const recipe = store.state.recipes.find(r => r.id === id)
    return nextCookStep(recipe)
  }
  if (act === 'cook-ingredients') { ui.cook.showIngredients = !ui.cook.showIngredients; return render() }

  // — formulaire —
  if (act === 'form-cat') { ui.form.category = el.dataset.cat; return render() }
  if (act === 'form-servings') {
    ui.form.servings = Math.max(1, Math.min(20, ui.form.servings + Number(el.dataset.delta)))
    return render()
  }
  if (act === 'add-ing') { ui.form.ingredients.push(blankIngredient()); return render() }
  if (act === 'del-ing') { ui.form.ingredients.splice(Number(el.dataset.i), 1); return render() }
  if (act === 'add-step') { ui.form.steps.push(''); return render() }
  if (act === 'del-step') { ui.form.steps.splice(Number(el.dataset.i), 1); return render() }
  if (act === 'pick-photo') return screenEl.querySelector('#photo-input').click()
  if (act === 'drop-photo') { ui.form.photo = null; return render() }
  if (act === 'save-recipe') return saveForm()

  // — courses —
  if (act === 'pick-recipes') return sheetPickRecipes()
  if (act === 'cart-add') {
    return run(async () => {
      await store.setCartRecipe(id, household.adults, household.children)
      closeSheet()
      toast('Ajoutée aux courses 🛒')
    })
  }
  if (act.startsWith('cart:')) {
    const [, recipeId, field] = act.split(':')
    const entry = store.state.cart.recipes.find(cc => cc.recipeId === recipeId)
    if (!entry) return
    const delta = Number(el.dataset.delta)
    const clamp = v => Math.max(0, Math.min(20, v))
    const adults = field === 'adults' ? clamp(entry.adults + delta) : entry.adults
    const children = field === 'children' ? clamp(entry.children + delta) : entry.children
    return run(() => store.setCartRecipe(recipeId, adults, children))
  }
  if (act === 'toggle-check') {
    const checked = el.dataset.checked !== 'true'
    const extraId = el.dataset.extra
    return run(() => extraId
      ? store.updateExtra(extraId, { checked })
      : store.setChecked(el.dataset.key, checked))
  }
  if (act === 'del-extra') return run(() => store.deleteExtra(id))
  if (act === 'add-extra') return sheetAddExtra()
  if (act === 'clear-cart') {
    if (!confirm('Vider toute la liste de courses ?')) return
    return run(async () => { await store.clearCart(); toast('Liste vidée') })
  }
  if (act === 'edit-price') {
    return sheetEditPrice(el.dataset.name, el.dataset.dept, el.dataset.entry)
  }

  // — ajouter / Claude —
  if (act === 'scan-cat') { ui.scanCat = el.dataset.cat; return render() }
  if (act === 'copy-prompt') {
    const prompt = el.dataset.kind === 'scan' ? buildScanPrompt(ui.scanCat) : buildCreatePrompt()
    const ok = await copyText(prompt)
    return toast(ok ? 'Prompt copié 📋' : 'Copie impossible — utilise « Voir le prompt »', ok ? 'ok' : 'error')
  }
  if (act === 'share-prompt') {
    const prompt = el.dataset.kind === 'scan' ? buildScanPrompt(ui.scanCat) : buildCreatePrompt()
    return sharePrompt(prompt)
  }
  if (act === 'analyse-paste') return analysePaste()
  if (act === 'do-import') {
    return run(async () => {
      const list = ui.paste.preview.valid.map(v => v.raw)
      const saved = await store.addRecipes(list)
      ui.paste = { text: '', preview: null }
      toast(`${saved.length} recette${saved.length > 1 ? 's' : ''} importée${saved.length > 1 ? 's' : ''} ✓`)
      navigate('')
    }, { rerender: false })
  }

  // — base commune —
  if (act === 'copy-sql') {
    const ok = await copyText(SUPABASE_SQL)
    return toast(ok ? 'Script SQL copié 📋' : 'Copie impossible — sélectionne le texte', ok ? 'ok' : 'error')
  }
  if (act === 'connect-remote') return connectRemote()
  if (act === 'disconnect-remote') {
    if (!confirm('Revenir aux données de ce téléphone seulement ?')) return
    return run(async () => { await store.useLocal(); toast('Retour en mode local 📱') })
  }
  if (act === 'export-backup') return exportBackup()
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet()
})

// La base commune peut avoir bougé chez quelqu'un d'autre : on recharge en
// revenant sur l'appli.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.isRemote) {
    store.load().then(render).catch(() => {})
  }
})

// ——— Démarrage ————————————————————————————————————————————————————

async function boot() {
  try {
    await store.load()
  } catch (e) {
    // Base commune injoignable : on n'enferme pas l'utilisateur dehors.
    toast(`${e.message} — passage en local`, 'error')
    await store.useLocal().catch(() => {})
  }
  booted = true
  render()

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  }
}

screenEl.innerHTML = '<div class="empty" style="padding-top:38dvh"><div class="big">🍲</div><p>HelloMiam…</p></div>'
boot()
