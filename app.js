// HelloMiam — application complète. Pas de framework, pas de build : des
// modules ES chargés directement par le navigateur, comme les autres apps
// du dépôt. Toute la logique de calcul vit dans lib/ et est testée avec
// `npm test`.

import { CATEGORIES, DEPTS, UNITS, categoryInfo, deptInfo } from './lib/constants.js'
import { normalizeName } from './lib/normalize.js'
import { formatQty, formatQtyUnit } from './lib/units.js'
import { portionsFactor, scaleIngredient, equivalentServings } from './lib/portions.js'
import { aggregateIngredients, extraToLine } from './lib/aggregate.js'
import { priceLines, formatPrice } from './lib/pricing.js'
import { validateRecipe, parseImportText, cleanPhoto } from './lib/validate.js'
import { effectiveRecipe, effectiveIngredients, adjustmentCount, setSwap, clearSwap, swapKey } from './lib/adjust.js'
import { effectiveTags, autoTags, allTags, cleanTag, tagEmoji } from './lib/tags.js'
import { Timers, parseDurations, formatRemaining, formatDuration } from './lib/timers.js'
import { APP_VERSION } from './lib/version.js'
import { buildScanPrompt, buildCreatePrompt, copyText, sharePrompt, CLAUDE_URL } from './lib/claudePrompts.js'
import { Store, loadHousehold, saveHousehold, SUPABASE_SQL, loadRemoteConfig } from './lib/store.js'

const LS_VIEW = 'hellomiam.view.v1'

const store = new Store()
const timers = new Timers()
let household = loadHousehold()
let booted = false

const screenEl = document.getElementById('screen')
const tabbarEl = document.getElementById('tabbar')
const timerHost = document.getElementById('timer-host')
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
  view: (() => {
    try {
      return localStorage.getItem(LS_VIEW) === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })(),
  cat: 'toutes',
  sub: null,            // sous-catégorie sélectionnée (« Chez Marcel »)
  tag: null,            // filtre par étiquette
  cook: { done: new Set(), showIngredients: false, scrollTo: false, firstPaint: true },
  form: null,
  paste: { text: '', preview: null },
  scanCat: 'hellofresh',
}

function resetCook() {
  ui.cook = { done: new Set(), showIngredients: false, scrollTo: false, firstPaint: true }
}

// ——— Écran : liste des recettes ————————————————————————————————

// Sous-catégories réellement utilisées dans une catégorie (« Chez Marcel »,
// « Le Petit Vietnamien »…), avec le nombre de recettes.
function subcategoriesOf(category) {
  const counts = new Map()
  for (const r of store.state.recipes) {
    if (category !== 'toutes' && r.category !== category) continue
    if (!r.sub) continue
    counts.set(r.sub, (counts.get(r.sub) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([sub, count]) => ({ sub, count }))
}

function matchesFilters(r) {
  if (ui.cat !== 'toutes' && r.category !== ui.cat) return false
  if (ui.sub && r.sub !== ui.sub) return false
  if (ui.tag && !effectiveTags(r).includes(ui.tag)) return false
  const q = normalizeName(ui.query)
  if (!q) return true
  const hay = normalizeName(`${r.title} ${r.sub ?? ''} ${r.ingredients.map(i => i.name).join(' ')} ${effectiveTags(r).join(' ')}`)
  return q.split(' ').every(w => hay.includes(w))
}

// Vignette d'une recette : la photo si elle charge, sinon l'emoji de sa
// catégorie. Un lien mort ne doit jamais laisser une image cassée.
function thumbHtml(recipe, className) {
  const info = categoryInfo(recipe.category)
  if (!recipe.photo) {
    return `<span class="${className}" style="background:${CAT_SOFT[info.id]}">${info.emoji}</span>`
  }
  return `<img class="${className}" src="${esc(recipe.photo)}" alt="" loading="lazy" decoding="async"
               referrerpolicy="no-referrer"
               data-fallback="${info.emoji}" data-fallback-bg="${CAT_SOFT[info.id]}">`
}

// Remplace après coup les images qui n'ont pas pu charger (lien cassé,
// hors-ligne, site qui refuse le partage) par la pastille de catégorie.
function wireImageFallbacks(root = document) {
  for (const img of root.querySelectorAll('img[data-fallback]')) {
    const swap = () => {
      const span = document.createElement('span')
      span.className = img.className
      span.textContent = img.dataset.fallback || '🍲'
      span.title = 'Image indisponible'
      const bg = img.dataset.fallbackBg || 'var(--sage-soft)'
      if (img.className) span.style.background = bg
      else if (img.parentElement) img.parentElement.style.background = bg
      img.replaceWith(span)
    }
    if (img.complete && img.naturalWidth === 0) swap()
    else img.addEventListener('error', swap, { once: true })
  }
}

function renderRecipes() {
  const list = store.state.recipes.filter(matchesFilters)
  const subs = subcategoriesOf(ui.cat)
  const filtering = ui.query || ui.cat !== 'toutes' || ui.sub || ui.tag
  const grid = ui.view === 'grid'

  const cards = list.map(r => {
    const info = categoryInfo(r.category)
    const time = totalTime(r)
    const tags = effectiveTags(r).slice(0, grid ? 2 : 3)

    if (grid) {
      return `
        <button class="grid-card" data-act="open-recipe" data-id="${esc(r.id)}">
          ${thumbHtml(r, 'grid-thumb')}
          <span class="grid-body">
            <span class="grid-title">${esc(r.title)}</span>
            <span class="grid-meta">
              ${time ? `⏱ ${time} · ` : ''}👤 ${r.servings}
            </span>
            ${tags.length ? `<span class="card-tags">${tags.map(t => `<span class="tag mini">${tagEmoji(t)} ${esc(t)}</span>`).join('')}</span>` : ''}
          </span>
        </button>`
    }

    return `
      <button class="recipe-card" data-act="open-recipe" data-id="${esc(r.id)}">
        ${thumbHtml(r, 'recipe-thumb')}
        <span class="grow">
          <span class="title">${esc(r.title)}</span>
          <span class="meta">
            <span class="badge ${info.id}">${info.emoji} ${esc(r.sub || info.label)}</span>
            ${time ? `<span class="meta-txt">⏱ ${time}</span>` : ''}
            <span class="meta-txt">👤 ${r.servings}</span>
          </span>
          ${tags.length ? `<span class="meta card-tags">${tags.map(t => `<span class="tag mini">${tagEmoji(t)} ${esc(t)}</span>`).join('')}</span>` : ''}
        </span>
      </button>`
  }).join('')

  screenEl.innerHTML = `
    <div class="screen">
      <div class="header">
        <span class="logo">🍲</span>
        <h1>HelloMiam</h1>
        <span class="version">v${APP_VERSION}</span>
        <div class="grow"></div>
        <button class="icon-btn" data-act="toggle-view" aria-label="${grid ? 'Afficher en liste' : 'Afficher en vignettes'}">
          ${grid ? '☰' : '▦'}
        </button>
        <button class="icon-btn" data-act="go" data-path="ajouter/tags" aria-label="Étiquettes">🏷️</button>
      </div>

      <div class="searchbar">
        <span aria-hidden>🔍</span>
        <input type="search" id="q" placeholder="Plat, ingrédient, étiquette…" value="${esc(ui.query)}">
        ${ui.query ? '<button class="icon-btn plain" data-act="clear-q">✕</button>' : ''}
      </div>

      <div class="chips">
        <button class="chip ${ui.cat === 'toutes' ? 'active' : ''}" data-act="filter" data-cat="toutes">Toutes</button>
        ${CATEGORIES.map(c => `
          <button class="chip ${c.id} ${ui.cat === c.id ? 'active' : ''}" data-act="filter" data-cat="${c.id}">
            ${c.emoji} ${esc(c.label)}
          </button>`).join('')}
      </div>

      ${subs.length ? `
        <div class="chips sub-chips">
          ${subs.map(s => `
            <button class="chip small ${ui.sub === s.sub ? 'active' : ''}" data-act="filter-sub" data-sub="${esc(s.sub)}">
              ${esc(s.sub)} <span class="chip-count">${s.count}</span>
            </button>`).join('')}
        </div>` : ''}

      ${ui.tag ? `
        <div class="active-filter">
          <span class="tag on">${tagEmoji(ui.tag)} ${esc(ui.tag)}</span>
          <button class="link-btn" data-act="clear-tag">retirer le filtre</button>
        </div>` : ''}

      <div class="count-line">${list.length} recette${list.length > 1 ? 's' : ''}${filtering ? ' trouvée' + (list.length > 1 ? 's' : '') : ''}</div>

      ${list.length
        ? `<div class="${grid ? 'grid' : 'stack'}">${cards}</div>`
        : `<div class="empty">
             <div class="big">🥣</div>
             <p>${filtering ? 'Aucune recette ne correspond.' : 'La bible est vide — ajoute ta première recette !'}</p>
             <button class="btn btn-primary" style="width:auto;margin:0 auto" data-act="${filtering ? 'clear-filters' : 'go'}" data-path="ajouter">
               ${filtering ? 'Enlever les filtres' : '＋ Ajouter une recette'}
             </button>
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
  const ingredients = effectiveIngredients(recipe)
  const scaled = ingredients.map(ing => scaleIngredient(ing, factor))
  const adjusted = adjustmentCount(recipe)
  const time = totalTime(recipe)
  const tags = effectiveTags(recipe)

  screenEl.innerHTML = `
    <div class="screen" style="padding-top:0">
      <div class="detail-hero" style="background:${recipe.photo ? 'none' : CAT_SOFT[info.id]}">
        ${recipe.photo
          ? `<img src="${esc(recipe.photo)}" alt="" referrerpolicy="no-referrer"
                  data-fallback="${info.emoji}" data-fallback-bg="${CAT_SOFT[info.id]}">`
          : `<span>${info.emoji}</span>`}
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
        ${recipe.sub ? `<span class="badge sub">${esc(recipe.sub)}</span>` : ''}
        ${recipe.prepMin != null ? `<span class="meta-txt">🔪 ${recipe.prepMin} min</span>` : ''}
        ${recipe.cookMin != null ? `<span class="meta-txt">🍳 ${recipe.cookMin} min</span>` : ''}
        ${time ? `<span class="meta-txt">⏱ ${time} en tout</span>` : ''}
      </div>

      <div class="tag-row">
        ${tags.map(t => `<button class="tag" data-act="filter-tag" data-tag="${esc(t)}">${tagEmoji(t)} ${esc(t)}</button>`).join('')}
        <button class="tag add" data-act="edit-tags" data-id="${esc(recipe.id)}">🏷️ ${tags.length ? 'gérer' : 'ajouter'}</button>
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

      <div class="section-title">
        🧾 Ingrédients
        <button class="link-btn" data-act="adjust" data-id="${esc(recipe.id)}">
          ${adjusted.total ? `⚙️ ${adjusted.total} ajustement${adjusted.total > 1 ? 's' : ''}` : '⚙️ Ajuster'}
        </button>
      </div>
      <div class="card">
        ${scaled.map(ing => `
          <div class="ingredient-row">
            <span class="qty">${esc(ing.text)}</span>
            <span class="grow">
              ${esc(ing.name)}
              ${ing.replacedFrom ? `<span class="swap-note">au lieu de ${esc(ing.replacedFrom)}</span>` : ''}
            </span>
          </div>`).join('')}
        ${adjusted.removed ? `<div class="removed-note">${adjusted.removed} ingrédient${adjusted.removed > 1 ? 's' : ''} retiré${adjusted.removed > 1 ? 's' : ''}</div>` : ''}
      </div>

      <div class="section-title">👩‍🍳 Étapes</div>
      <div class="card">
        ${recipe.steps.map((s, i) => `
          <div class="step-row">
            <span class="step-num">${i + 1}</span>
            <span class="grow">${esc(s)}</span>
          </div>`).join('')}
      </div>

      <div class="section-title">
        💡 Notes
        <button class="link-btn" data-act="edit-notes" data-id="${esc(recipe.id)}">${recipe.notes ? '✏️ Modifier' : '＋ Ajouter'}</button>
      </div>
      <div class="card ${recipe.notes ? '' : 'muted-card'}" data-act="edit-notes" data-id="${esc(recipe.id)}">
        ${recipe.notes ? esc(recipe.notes) : 'Aucune note — touche pour en écrire une (astuce, variante, qui a aimé…).'}
      </div>
    </div>`
}

// ——— Feuille : ajuster les ingrédients ————————————————————————————
//
// Retirer ce qu'on n'aime pas ou le remplacer, avant de cuisiner comme avant
// de faire les courses : les deux écrans lisent les mêmes ajustements.

function sheetAdjust(recipeId) {
  const recipe = store.state.recipes.find(r => r.id === recipeId)
  if (!recipe) return
  const swaps = recipe.swaps || {}

  openSheet(`Ajuster « ${recipe.title} »`, `
    <div class="hint" style="margin-bottom:12px">
      Vaut pour la cuisine <b>et</b> pour les courses. Réversible à tout moment.
    </div>
    <div class="stack">
      ${recipe.ingredients.map(ing => {
        const key = swapKey(ing.name)
        const has = Object.prototype.hasOwnProperty.call(swaps, key)
        const removed = has && swaps[key] == null
        const replacement = has && swaps[key] != null ? swaps[key] : null
        return `
          <div class="card adjust-row ${removed ? 'removed' : ''} ${replacement ? 'replaced' : ''}" style="padding:12px">
            <div class="row">
              <span class="grow">
                <span class="adjust-name">${esc(ing.name)}</span>
                <span class="hint" style="display:block">${esc(formatQtyUnit(ing.qty, ing.unit))}</span>
                ${replacement ? `<span class="swap-note block">→ remplacé par ${esc(replacement.name)}</span>` : ''}
                ${removed ? '<span class="swap-note block">→ retiré de la recette</span>' : ''}
              </span>
              ${has
                ? `<button class="btn btn-soft btn-sm" data-act="swap-reset" data-id="${esc(recipe.id)}" data-name="${esc(ing.name)}">Rétablir</button>`
                : `<div class="row" style="gap:6px">
                     <button class="btn btn-danger-soft btn-sm" data-act="swap-remove" data-id="${esc(recipe.id)}" data-name="${esc(ing.name)}">Retirer</button>
                     <button class="btn btn-lavande-soft btn-sm" data-act="swap-replace" data-id="${esc(recipe.id)}" data-name="${esc(ing.name)}">Remplacer</button>
                   </div>`}
            </div>
          </div>`
      }).join('')}
    </div>`)
}

function sheetReplace(recipeId, originalName) {
  const recipe = store.state.recipes.find(r => r.id === recipeId)
  const ing = recipe?.ingredients.find(i => swapKey(i.name) === swapKey(originalName))
  if (!ing) return

  openSheet(`Remplacer « ${ing.name} »`, `
    <form class="stack" id="replace-form">
      <label class="field">Par
        <input id="s-name" placeholder="Crème de soja" value="">
      </label>
      <div class="row">
        <input style="width:90px" inputmode="decimal" id="s-qty" placeholder="Qté" value="${ing.qty == null ? '' : esc(String(ing.qty).replace('.', ','))}">
        <select style="width:120px" id="s-unit">${unitOptions(ing.unit ?? '')}</select>
        <select class="grow" id="s-dept">${deptOptions(ing.dept)}</select>
      </div>
      <div class="hint">La quantité reprend celle d’origine : ajuste-la si le remplaçant se dose autrement.</div>
      <button class="btn btn-primary" type="submit">Remplacer</button>
    </form>`)

  sheetHost.querySelector('#replace-form').addEventListener('submit', async e => {
    e.preventDefault()
    const name = sheetHost.querySelector('#s-name').value.trim()
    if (!name) {
      toast('Indique le remplaçant', 'error')
      return
    }
    const rawQty = sheetHost.querySelector('#s-qty').value.replace(',', '.')
    const qty = Number(rawQty)
    await run(async () => {
      await store.patchRecipe(recipe.id, {
        swaps: setSwap(recipe, originalName, {
          name,
          qty: rawQty !== '' && Number.isFinite(qty) && qty > 0 ? qty : null,
          unit: sheetHost.querySelector('#s-unit').value || null,
          dept: sheetHost.querySelector('#s-dept').value,
        }),
      })
      toast(`${ing.name} → ${name} ✓`)
      closeSheet()
    })
  })
}

// ——— Feuille : notes ————————————————————————————————————————————

function sheetNotes(recipeId) {
  const recipe = store.state.recipes.find(r => r.id === recipeId)
  if (!recipe) return
  openSheet(`Notes — ${recipe.title}`, `
    <form class="stack" id="notes-form">
      <textarea id="n-text" rows="6" placeholder="Astuce, variante, ce qu’en pensent les enfants…">${esc(recipe.notes ?? '')}</textarea>
      <button class="btn btn-primary" type="submit">Enregistrer</button>
      ${recipe.notes ? '<button type="button" class="btn btn-danger-soft" data-act="notes-clear" data-id="' + esc(recipe.id) + '">Effacer la note</button>' : ''}
    </form>`)

  sheetHost.querySelector('#notes-form').addEventListener('submit', async e => {
    e.preventDefault()
    const text = sheetHost.querySelector('#n-text').value.trim()
    await run(async () => {
      await store.patchRecipe(recipe.id, { notes: text || null })
      toast('Note enregistrée ✓')
      closeSheet()
    })
  })
}

// ——— Feuille : tags d'une recette ————————————————————————————————

function sheetTags(recipeId) {
  const recipe = store.state.recipes.find(r => r.id === recipeId)
  if (!recipe) return
  const auto = autoTags(recipe)
  const off = new Set(recipe.tagsOff || [])
  const manual = (recipe.tags || [])
  const suggestions = allTags(store.state.recipes)
    .map(t => t.tag)
    .filter(t => !auto.includes(t) && !manual.includes(t))
    .slice(0, 12)

  openSheet(`Étiquettes — ${recipe.title}`, `
    <div class="stack">
      <div>
        <div class="hint" style="margin-bottom:8px">Déduites de la recette — décoche celles qui sont fausses.</div>
        <div class="tag-row">
          ${auto.length
            ? auto.map(t => `
                <button class="tag ${off.has(t) ? 'off' : 'on'}" data-act="tag-auto" data-id="${esc(recipe.id)}" data-tag="${esc(t)}">
                  ${tagEmoji(t)} ${esc(t)} ${off.has(t) ? '' : '✓'}
                </button>`).join('')
            : '<span class="hint">Aucune étiquette automatique pour cette recette.</span>'}
        </div>
      </div>

      <hr class="divider">

      <div>
        <div class="hint" style="margin-bottom:8px">Ajoutées à la main</div>
        <div class="tag-row">
          ${manual.map(t => `
            <button class="tag on" data-act="tag-remove" data-id="${esc(recipe.id)}" data-tag="${esc(t)}">
              ${tagEmoji(t)} ${esc(t)} ✕
            </button>`).join('')}
          ${manual.length ? '' : '<span class="hint">Aucune pour l’instant.</span>'}
        </div>
      </div>

      <form class="row" id="tag-form" style="gap:8px">
        <input class="grow" id="tag-input" placeholder="été, sans gluten, favori…" list="tag-suggestions">
        <datalist id="tag-suggestions">${suggestions.map(t => `<option value="${esc(t)}"></option>`).join('')}</datalist>
        <button class="btn btn-primary btn-sm" type="submit">Ajouter</button>
      </form>

      ${suggestions.length ? `
        <div>
          <div class="hint" style="margin-bottom:8px">Déjà utilisées ailleurs</div>
          <div class="tag-row">
            ${suggestions.map(t => `
              <button class="tag" data-act="tag-add" data-id="${esc(recipe.id)}" data-tag="${esc(t)}">
                ${tagEmoji(t)} ${esc(t)} ＋
              </button>`).join('')}
          </div>
        </div>` : ''}
    </div>`)

  sheetHost.querySelector('#tag-form').addEventListener('submit', async e => {
    e.preventDefault()
    const tag = cleanTag(sheetHost.querySelector('#tag-input').value)
    if (!tag) return
    await addTagTo(recipe.id, tag)
  })
}

async function addTagTo(recipeId, tag) {
  const recipe = store.state.recipes.find(r => r.id === recipeId)
  if (!recipe) return
  if ((recipe.tags || []).includes(tag)) {
    toast('Étiquette déjà présente')
    return
  }
  await run(async () => {
    await store.patchRecipe(recipeId, {
      tags: [...(recipe.tags || []), tag],
      // Ajouter à la main une étiquette qu'on avait masquée la réactive.
      tagsOff: (recipe.tagsOff || []).filter(t => t !== tag),
    })
    sheetTags(recipeId)
  })
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

// Les étapes défilent toutes à la suite : on garde le fil de la recette,
// l'étape en cours est mise en avant, et chaque durée repérée dans le texte
// donne un bouton qui lance un chronomètre.
function renderCook(recipe) {
  const cooked = effectiveRecipe(recipe)
  const inCart = store.state.cart.recipes.find(c => c.recipeId === recipe.id)
  const adults = inCart ? inCart.adults : household.adults
  const children = inCart ? inCart.children : household.children
  const factor = portionsFactor(adults, children, recipe.servings)
  const scaled = cooked.ingredients.map(ing => scaleIngredient(ing, factor))
  const done = ui.cook.done
  const current = firstUndoneStep(recipe)

  screenEl.innerHTML = `
    <div class="cookmode">
      <div class="cook-head">
        <button class="icon-btn" data-act="open-recipe" data-id="${esc(recipe.id)}" aria-label="Quitter">✕</button>
        <span class="cook-title">${esc(recipe.title)}</span>
        <span class="cook-count">${done.size}/${recipe.steps.length}</span>
      </div>

      <div class="cook-progress">
        ${recipe.steps.map((_, i) => `<i class="${done.has(i) ? 'done' : ''}"></i>`).join('')}
      </div>

      <div class="cook-scroll" id="cook-scroll">
        <details class="cook-ing-fold" ${ui.cook.showIngredients ? 'open' : ''}>
          <summary>🧾 Ingrédients pour ${adults} adulte${adults > 1 ? 's' : ''}${children ? ` + ${children} enfant${children > 1 ? 's' : ''}` : ''}</summary>
          <div class="card" style="margin-top:10px">
            ${scaled.map(ing => `
              <div class="ingredient-row">
                <span class="qty">${esc(ing.text)}</span>
                <span class="grow">${esc(ing.name)}</span>
              </div>`).join('')}
          </div>
        </details>

        ${recipe.steps.map((step, i) => cookStepHtml(step, i, done.has(i), i === current, recipe.title)).join('')}

        <div class="cook-end">
          ${done.size === recipe.steps.length
            ? `<button class="btn btn-primary" data-act="cook-finish" data-id="${esc(recipe.id)}">C’est prêt, bon appétit 🎉</button>`
            : `<div class="hint">Coche les étapes au fur et à mesure — l’écran reste allumé.</div>`}
        </div>
      </div>
    </div>`

  // On amène l'étape en cours sous les yeux, sans l'arracher au contexte.
  const target = screenEl.querySelector(`.cook-step[data-i="${current}"]`)
  if (target && ui.cook.scrollTo) {
    target.scrollIntoView({ block: 'center', behavior: ui.cook.firstPaint ? 'auto' : 'smooth' })
  }
  ui.cook.scrollTo = false
  ui.cook.firstPaint = false
}

function cookStepHtml(step, i, isDone, isCurrent, recipeTitle) {
  const durations = parseDurations(step)
  return `
    <div class="cook-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-i="${i}">
      <button class="cook-step-check" data-act="cook-toggle" data-i="${i}" aria-label="Étape faite">
        ${isDone ? '✓' : i + 1}
      </button>
      <div class="grow">
        <div class="cook-step-text">${esc(step)}</div>
        ${durations.length ? `
          <div class="cook-timers">
            ${durations.map(d => `
              <button class="timer-chip" data-act="start-timer" data-seconds="${d.seconds}"
                      data-label="Étape ${i + 1}" data-context="${esc(recipeTitle)}">
                ⏱ ${esc(d.label)}
              </button>`).join('')}
            <button class="timer-chip ghost" data-act="custom-timer" data-label="Étape ${i + 1}" data-context="${esc(recipeTitle)}">＋</button>
          </div>` : `
          <div class="cook-timers">
            <button class="timer-chip ghost" data-act="custom-timer" data-label="Étape ${i + 1}" data-context="${esc(recipeTitle)}">⏱ minuteur</button>
          </div>`}
      </div>
    </div>`
}

function firstUndoneStep(recipe) {
  for (let i = 0; i < recipe.steps.length; i++) {
    if (!ui.cook.done.has(i)) return i
  }
  return recipe.steps.length - 1
}

// ——— Chronomètres ————————————————————————————————————————————————

// Barre flottante : visible partout dans l'appli tant qu'un minuteur tourne,
// pour pouvoir quitter la recette sans perdre une cuisson.
function renderTimerBar(tabbarVisible) {
  const list = timers.list
  if (!list.length) {
    timerHost.innerHTML = ''
    document.documentElement.style.setProperty('--timer-h', '0px')
    return
  }
  timerHost.innerHTML = `
    <div class="timer-bar ${tabbarVisible ? '' : 'no-tabbar'}">
      ${list.map(t => {
        const left = timers.remaining(t)
        const over = left <= 0
        return `
          <div class="timer-item ${over ? 'over' : ''}">
            <div class="grow">
              <div class="timer-label">${esc(t.label)}${t.context ? ` · ${esc(t.context)}` : ''}</div>
              <div class="timer-time" data-timer-time="${esc(t.id)}">${over ? 'terminé !' : formatRemaining(left)}</div>
            </div>
            ${over
              ? `<button class="timer-act" data-act="timer-add" data-id="${esc(t.id)}" data-seconds="60">+1 min</button>`
              : `<button class="timer-act" data-act="timer-add" data-id="${esc(t.id)}" data-seconds="60">+1 min</button>`}
            <button class="timer-act stop" data-act="timer-stop" data-id="${esc(t.id)}" aria-label="Arrêter">✕</button>
          </div>`
      }).join('')}
    </div>`

  // Hauteur mesurée plutôt que devinée : le nombre de minuteurs varie.
  // C'est la barre elle-même qu'on mesure : en `position: fixed`, elle ne
  // donne aucune hauteur à son conteneur.
  const bar = timerHost.querySelector('.timer-bar')
  document.documentElement.style.setProperty('--timer-h', `${bar ? bar.offsetHeight : 0}px`)
}

// Un seul intervalle pour toute l'appli : il ne redessine pas la page, il met
// juste à jour les décomptes déjà affichés (économe en batterie).
function startTimerTicker() {
  setInterval(() => {
    const due = timers.takeNewlyFinished()
    if (due.length) {
      ringTimer()
      toast(`⏰ ${due.map(t => t.label).join(', ')} — c’est prêt !`)
      render()
      return
    }
    // La barre affichée ne correspond plus à la liste : on la redessine.
    if (document.querySelectorAll('[data-timer-time]').length !== timers.list.length) {
      render()
      return
    }
    for (const t of timers.list) {
      const el = document.querySelector(`[data-timer-time="${CSS.escape(t.id)}"]`)
      if (!el) continue
      const left = timers.remaining(t)
      el.textContent = left <= 0 ? 'terminé !' : formatRemaining(left)
    }
  }, 1000)
}

// Sonnerie courte sans fichier audio + vibration si le téléphone la propose.
function ringTimer() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400])
  } catch { /* pas de vibreur */ }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.001, now + i * 0.45)
      gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.45 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.45 + 0.32)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.45)
      osc.stop(now + i * 0.45 + 0.35)
    }
    setTimeout(() => ctx.close().catch(() => {}), 2000)
  } catch { /* audio indisponible : la vibration et le bandeau suffisent */ }
}

function sheetCustomTimer(label, context) {
  openSheet('Lancer un minuteur', `
    <form class="stack" id="timer-form">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        ${[1, 3, 5, 10, 15, 20, 30, 45, 60].map(m =>
          `<button type="button" class="timer-chip big" data-act="start-timer" data-seconds="${m * 60}"
                   data-label="${esc(label)}" data-context="${esc(context)}" data-close>⏱ ${m} min</button>`).join('')}
      </div>
      <hr class="divider">
      <div class="row">
        <label class="field grow">Minutes
          <input inputmode="numeric" id="t-min" placeholder="12">
        </label>
        <label class="field grow">Secondes
          <input inputmode="numeric" id="t-sec" placeholder="0">
        </label>
      </div>
      <button class="btn btn-primary" type="submit">Lancer</button>
    </form>`)

  sheetHost.querySelector('#timer-form').addEventListener('submit', e => {
    e.preventDefault()
    const min = Number(sheetHost.querySelector('#t-min').value) || 0
    const sec = Number(sheetHost.querySelector('#t-sec').value) || 0
    const total = min * 60 + sec
    if (total <= 0) {
      toast('Indique une durée', 'error')
      return
    }
    timers.add(label, total, context)
    closeSheet()
    render()
  })
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
        sub: recipe.sub ?? '',
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
        // Conservés tels quels : une modification du texte ne doit pas faire
        // perdre les étiquettes ni les ajustements déjà réglés.
        tags: [...(recipe.tags || [])],
        tagsOff: [...(recipe.tagsOff || [])],
        swaps: { ...(recipe.swaps || {}) },
      }
    : {
        id: null, title: '', category: 'perso', sub: '', servings: 2, prepMin: '', cookMin: '',
        notes: '', photo: null, ingredients: [blankIngredient()], steps: [''],
        tags: [], tagsOff: [], swaps: {},
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

        <label class="field">Sous-catégorie (facultatif)
          <input data-bind="sub" value="${esc(f.sub)}" list="sub-suggestions"
                 placeholder="${f.category === 'resto' ? 'Le Petit Vietnamien' : 'Entrées, Fêtes, Mamie…'}">
          <datalist id="sub-suggestions">
            ${subcategoriesOf(f.category).map(s => `<option value="${esc(s.sub)}"></option>`).join('')}
          </datalist>
        </label>

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
          <span style="display:block;margin-bottom:6px">Photo de prévisualisation (facultatif)</span>
          <input type="file" accept="image/*" id="photo-input" hidden>

          ${f.photo ? `
            <div class="row" style="margin-bottom:8px">
              <img class="photo-preview" src="${esc(f.photo)}" alt="" referrerpolicy="no-referrer"
                   data-fallback="🖼️" data-fallback-bg="var(--danger-soft)">
              <span class="grow">
                <span class="hint" style="display:block">${photoKindLabel(f.photo)}</span>
                <button type="button" class="btn btn-danger-soft btn-sm" style="margin-top:6px" data-act="drop-photo">Retirer</button>
              </span>
            </div>` : ''}

          <div class="row">
            <input class="grow" id="photo-url" inputmode="url" placeholder="Coller un lien https://…"
                   value="${esc(f.photo && !f.photo.startsWith('data:') ? f.photo : '')}">
            <button type="button" class="btn btn-soft btn-sm" data-act="pick-photo" aria-label="Prendre une photo">📷</button>
          </div>
          <div class="hint" style="margin-top:6px">
            Un lien ne pèse rien et se partage avec la famille ; une photo prise ici
            marche hors-ligne mais alourdit la base.
          </div>
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

  const photoUrl = screenEl.querySelector('#photo-url')
  // On ne redessine pas à chaque frappe (le champ perdrait le focus) : le
  // brouillon suit la saisie, l'aperçu apparaît quand on quitte le champ.
  photoUrl.addEventListener('input', e => {
    const value = e.target.value.trim()
    ui.form.photo = value ? cleanPhoto(value) : null
  })
  photoUrl.addEventListener('change', () => {
    const raw = photoUrl.value.trim()
    if (raw && !cleanPhoto(raw)) toast('Lien refusé : il doit commencer par https://', 'error')
    render()
  })
}

function photoKindLabel(photo) {
  if (!photo) return ''
  if (photo.startsWith('data:')) {
    return `Photo intégrée · ~${Math.round((photo.length * 3) / 4 / 1024)} Ko dans la base`
  }
  try {
    return `Lien vers ${new URL(photo).hostname}`
  } catch {
    return 'Lien'
  }
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
    sub: f.sub,
    servings: f.servings,
    prepMin: f.prepMin === '' ? null : Number(f.prepMin),
    cookMin: f.cookMin === '' ? null : Number(f.cookMin),
    notes: (f.notes || '').trim() || null,
    ingredients: f.ingredients
      .filter(i => i.name.trim())
      .map(i => ({ name: i.name, qty: i.qty === '' ? null : i.qty, unit: i.unit || null, dept: i.dept })),
    steps: f.steps.filter(s => s.trim()),
    tags: f.tags,
    tagsOff: f.tagsOff,
    swaps: f.swaps,
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
    // Les ingrédients retirés ou remplacés le sont aussi dans les courses.
    cartRecipes.map(c => ({ recipe: effectiveRecipe(c.recipe), adults: c.adults, children: c.children }))
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
  if (sub === 'tags') return renderManage()

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
        ${addOption('🏷️', 'var(--lavande-soft)', 'Étiquettes & sous-catégories', 'Renommer, supprimer, voir ce qui est utilisé', 'ajouter/tags')}
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

// ——— Écran : gérer les sous-catégories et les étiquettes ————————————

function renderManage() {
  const recipes = store.state.recipes
  const tags = allTags(recipes)
  const manualTags = new Set(recipes.flatMap(r => r.tags || []))

  const groups = CATEGORIES.map(c => {
    const subs = subcategoriesOf(c.id)
    return { cat: c, subs }
  }).filter(g => g.subs.length)

  screenEl.innerHTML = `
    <div class="screen">
      ${backHeader('Étiquettes & sous-catégories', 'ajouter')}
      <div class="stack">
        <div class="info-card">
          Les étiquettes marquées <b>auto</b> sont déduites des ingrédients et des étapes.
          Les autres, tu les as ajoutées — tu peux les renommer ou les supprimer partout d’un coup.
        </div>

        <div class="section-title">🏷️ Étiquettes</div>
        ${tags.length ? `
          <div class="card" style="padding:4px 14px">
            ${tags.map(({ tag, count }) => {
              const isManual = manualTags.has(tag)
              return `
                <div class="manage-row">
                  <span class="grow">
                    <span class="manage-name">${tagEmoji(tag)} ${esc(tag)}</span>
                    <span class="hint"> ${count} recette${count > 1 ? 's' : ''}${isManual ? '' : ' · auto'}</span>
                  </span>
                  <button class="link-btn" data-act="see-tag" data-tag="${esc(tag)}">voir</button>
                  ${isManual ? `
                    <button class="icon-btn plain" data-act="rename-tag" data-tag="${esc(tag)}" aria-label="Renommer">✏️</button>
                    <button class="icon-btn plain" data-act="delete-tag" data-tag="${esc(tag)}" aria-label="Supprimer">🗑️</button>` : ''}
                </div>`
            }).join('')}
          </div>`
          : '<div class="card muted-card">Aucune étiquette pour l’instant.</div>'}

        <div class="section-title">📂 Sous-catégories</div>
        ${groups.length ? groups.map(g => `
          <div>
            <div class="dept-head"><span>${g.cat.emoji}</span> ${esc(g.cat.label)}</div>
            <div class="card" style="padding:4px 14px">
              ${g.subs.map(s => `
                <div class="manage-row">
                  <span class="grow">
                    <span class="manage-name">${esc(s.sub)}</span>
                    <span class="hint"> ${s.count} recette${s.count > 1 ? 's' : ''}</span>
                  </span>
                  <button class="link-btn" data-act="see-sub" data-cat="${g.cat.id}" data-sub="${esc(s.sub)}">voir</button>
                  <button class="icon-btn plain" data-act="rename-sub" data-cat="${g.cat.id}" data-sub="${esc(s.sub)}" aria-label="Renommer">✏️</button>
                  <button class="icon-btn plain" data-act="delete-sub" data-cat="${g.cat.id}" data-sub="${esc(s.sub)}" aria-label="Supprimer">🗑️</button>
                </div>`).join('')}
            </div>
          </div>`).join('')
          : `<div class="card muted-card">
               Aucune sous-catégorie. Ajoute-en une depuis le formulaire d’une recette
               (« Le Petit Vietnamien » sous Restaurants, par exemple).
             </div>`}
      </div>
    </div>`
}

// Renommer une étiquette partout : elle peut être présente comme tag manuel
// et comme tag masqué, il faut traiter les deux.
async function renameTagEverywhere(oldTag, newTag) {
  const clean = cleanTag(newTag)
  if (!clean || clean === oldTag) return
  const touched = store.state.recipes.filter(r =>
    (r.tags || []).includes(oldTag) || (r.tagsOff || []).includes(oldTag)
  )
  await run(async () => {
    for (const r of touched) {
      const tags = [...new Set((r.tags || []).map(t => (t === oldTag ? clean : t)))]
      const tagsOff = [...new Set((r.tagsOff || []).map(t => (t === oldTag ? clean : t)))]
      await store.patchRecipe(r.id, { tags, tagsOff })
    }
    toast(`« ${oldTag} » → « ${clean} » sur ${touched.length} recette${touched.length > 1 ? 's' : ''} ✓`)
  })
}

async function deleteTagEverywhere(tag) {
  const touched = store.state.recipes.filter(r => (r.tags || []).includes(tag))
  await run(async () => {
    for (const r of touched) {
      await store.patchRecipe(r.id, { tags: (r.tags || []).filter(t => t !== tag) })
    }
    toast(`Étiquette « ${tag} » supprimée`)
  })
}

async function renameSubEverywhere(category, oldSub, newSub) {
  const clean = String(newSub ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!clean || clean === oldSub) return
  const touched = store.state.recipes.filter(r => r.category === category && r.sub === oldSub)
  await run(async () => {
    for (const r of touched) await store.patchRecipe(r.id, { sub: clean })
    toast(`« ${oldSub} » → « ${clean} » sur ${touched.length} recette${touched.length > 1 ? 's' : ''} ✓`)
  })
}

async function deleteSubEverywhere(category, sub) {
  const touched = store.state.recipes.filter(r => r.category === category && r.sub === sub)
  await run(async () => {
    for (const r of touched) await store.patchRecipe(r.id, { sub: null })
    toast(`Sous-catégorie « ${sub} » supprimée`)
  })
}

// ——— Barre d'onglets ——————————————————————————————————————————————

const TAB_ICONS = {
  recettes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M9 8h7M9 11.5h5"/></svg>',
  courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/><circle cx="10" cy="20.2" r="1.4"/><circle cx="17.5" cy="20.2" r="1.4"/></svg>',
  ajouter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>',
}

function renderTabbar(active, hidden) {
  tabbarEl.hidden = hidden
  renderTimerBar(!hidden)
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
  renderScreen()
  wireImageFallbacks(screenEl)
}

function renderScreen() {
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
    releaseWakeLock()
  } else {
    acquireWakeLock()
    ui.cook.scrollTo = true
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
  if (act === 'filter') {
    ui.cat = el.dataset.cat === ui.cat ? 'toutes' : el.dataset.cat
    ui.sub = null
    return render()
  }
  if (act === 'filter-sub') {
    ui.sub = el.dataset.sub === ui.sub ? null : el.dataset.sub
    return render()
  }
  if (act === 'clear-tag') { ui.tag = null; return render() }
  if (act === 'clear-filters') {
    ui.query = ''
    ui.cat = 'toutes'
    ui.sub = null
    ui.tag = null
    return render()
  }
  if (act === 'clear-q') { ui.query = ''; return render() }
  if (act === 'toggle-view') {
    ui.view = ui.view === 'grid' ? 'list' : 'grid'
    try {
      localStorage.setItem(LS_VIEW, ui.view)
    } catch { /* mode privé : la vue ne sera pas mémorisée */ }
    return render()
  }

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

  // — ajustements d'ingrédients —
  if (act === 'adjust') return sheetAdjust(id)
  if (act === 'swap-replace') return sheetReplace(id, el.dataset.name)
  if (act === 'swap-remove') {
    const recipe = store.state.recipes.find(r => r.id === id)
    return run(async () => {
      await store.patchRecipe(id, { swaps: setSwap(recipe, el.dataset.name, null) })
      sheetAdjust(id)
    })
  }
  if (act === 'swap-reset') {
    const recipe = store.state.recipes.find(r => r.id === id)
    return run(async () => {
      await store.patchRecipe(id, { swaps: clearSwap(recipe, el.dataset.name) })
      sheetAdjust(id)
    })
  }

  // — notes —
  if (act === 'edit-notes') return sheetNotes(id)
  if (act === 'notes-clear') {
    return run(async () => {
      await store.patchRecipe(id, { notes: null })
      toast('Note effacée')
      closeSheet()
    })
  }

  // — étiquettes —
  if (act === 'edit-tags') return sheetTags(id)
  if (act === 'tag-add') return addTagTo(id, el.dataset.tag)
  if (act === 'tag-remove') {
    const recipe = store.state.recipes.find(r => r.id === id)
    return run(async () => {
      await store.patchRecipe(id, { tags: (recipe.tags || []).filter(t => t !== el.dataset.tag) })
      sheetTags(id)
    })
  }
  if (act === 'tag-auto') {
    // Masque (ou réaffiche) une étiquette déduite automatiquement.
    const recipe = store.state.recipes.find(r => r.id === id)
    const tag = el.dataset.tag
    const off = new Set(recipe.tagsOff || [])
    if (off.has(tag)) off.delete(tag)
    else off.add(tag)
    return run(async () => {
      await store.patchRecipe(id, { tagsOff: [...off] })
      sheetTags(id)
    })
  }
  if (act === 'filter-tag') {
    ui.tag = ui.tag === el.dataset.tag ? null : el.dataset.tag
    ui.cat = 'toutes'
    ui.sub = null
    closeSheet()
    return navigate('')
  }

  // — mode cuisine —
  if (act === 'cook-toggle') {
    const i = Number(el.dataset.i)
    if (ui.cook.done.has(i)) ui.cook.done.delete(i)
    else ui.cook.done.add(i)
    ui.cook.scrollTo = !ui.cook.done.has(i) ? false : true
    return render()
  }
  if (act === 'cook-finish') {
    toast('Bon appétit ! 🍽️')
    resetCook()
    return navigate(`recette/${id}`)
  }

  // — chronomètres —
  if (act === 'start-timer') {
    timers.add(el.dataset.label || 'Minuteur', Number(el.dataset.seconds), el.dataset.context || '')
    toast(`Minuteur lancé : ${formatDuration(Number(el.dataset.seconds))} ⏱`)
    if (el.hasAttribute('data-close')) closeSheet()
    return render()
  }
  if (act === 'custom-timer') return sheetCustomTimer(el.dataset.label || 'Minuteur', el.dataset.context || '')
  if (act === 'timer-add') { timers.addTime(id, Number(el.dataset.seconds)); return render() }
  if (act === 'timer-stop') { timers.remove(id); return render() }
  if (act === 'timers-clear') { timers.clearFinished(); return render() }

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

  // — gestion des étiquettes et sous-catégories —
  if (act === 'see-tag') {
    ui.tag = el.dataset.tag
    ui.cat = 'toutes'
    ui.sub = null
    return navigate('')
  }
  if (act === 'see-sub') {
    ui.cat = el.dataset.cat
    ui.sub = el.dataset.sub
    ui.tag = null
    return navigate('')
  }
  if (act === 'rename-tag') {
    const next = prompt(`Renommer l’étiquette « ${el.dataset.tag} » en :`, el.dataset.tag)
    return next == null ? undefined : renameTagEverywhere(el.dataset.tag, next)
  }
  if (act === 'delete-tag') {
    if (!confirm(`Supprimer l’étiquette « ${el.dataset.tag} » de toutes les recettes ?`)) return
    return deleteTagEverywhere(el.dataset.tag)
  }
  if (act === 'rename-sub') {
    const next = prompt(`Renommer la sous-catégorie « ${el.dataset.sub} » en :`, el.dataset.sub)
    return next == null ? undefined : renameSubEverywhere(el.dataset.cat, el.dataset.sub, next)
  }
  if (act === 'delete-sub') {
    if (!confirm(`Retirer la sous-catégorie « ${el.dataset.sub} » de ses recettes ?`)) return
    return deleteSubEverywhere(el.dataset.cat, el.dataset.sub)
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
  startTimerTicker()

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // `updateViaCache: 'none'` force le navigateur à aller chercher sw.js sur
    // le réseau pour vérifier les mises à jour, au lieu de le relire dans son
    // cache HTTP (GitHub Pages le sert avec une durée de vie de 10 minutes).
    navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`, { updateViaCache: 'none' })
      .then(reg => {
        // Une appli ajoutée à l'écran d'accueil peut rester ouverte des
        // jours : on redemande une vérification à chaque retour dessus.
        const check = () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
        }
        document.addEventListener('visibilitychange', check)
        check()
      })
      .catch(() => {})

    // Quand une nouvelle version prend la main, on recharge une fois. Sans
    // ça, la page garderait les modules déjà chargés depuis l'ancien cache
    // et mélangerait deux versions du code — un bug très difficile à voir.
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      location.reload()
    })
  }
}

screenEl.innerHTML = '<div class="empty" style="padding-top:38dvh"><div class="big">🍲</div><p>HelloMiam…</p></div>'
boot()
