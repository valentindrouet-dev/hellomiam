import React, { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { DEPTS, UNITS, deptInfo } from '../lib/constants.js'
import { aggregateIngredients, extraToLine } from '../lib/aggregate.js'
import { priceLines, formatPrice } from '../lib/pricing.js'
import { normalizeName } from '../lib/normalize.js'
import { EmptyState, PeopleSteppers, Sheet, useToast } from '../ui.jsx'

export default function ShoppingTab() {
  const { data, actions, household } = useApp()
  const toast = useToast()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [priceEdit, setPriceEdit] = useState(null) // { name, dept, entry }

  const cartRecipes = data.cart.recipes
    .map(c => ({ ...c, recipe: data.recipes.find(r => r.id === c.recipeId) }))
    .filter(c => c.recipe)

  const { grouped, total, unknown } = useMemo(() => {
    const lines = aggregateIngredients(
      cartRecipes.map(c => ({ recipe: c.recipe, adults: c.adults, children: c.children }))
    )
    const extras = data.cart.extras.map(extraToLine)
    const priced = priceLines([...lines, ...extras], data.prices)
    const byDept = new Map()
    for (const line of priced.lines) {
      if (!byDept.has(line.dept)) byDept.set(line.dept, [])
      byDept.get(line.dept).push(line)
    }
    return {
      grouped: DEPTS.filter(d => byDept.has(d.id)).map(d => ({ dept: d, lines: byDept.get(d.id) })),
      total: priced.total,
      unknown: priced.unknown,
    }
  }, [data, cartRecipes])

  const empty = cartRecipes.length === 0 && data.cart.extras.length === 0

  const clearAll = async () => {
    if (!confirm('Vider toute la liste de courses ?')) return
    await actions.clearCart()
    toast('Liste vidée')
  }

  return (
    <div className="screen">
      <div className="header">
        <span className="logo">🛒</span>
        <h1>Courses</h1>
        {!empty && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll}>Vider</button>
        )}
      </div>

      {empty ? (
        <EmptyState emoji="🧺" text="Choisis des recettes, la liste de courses se prépare toute seule.">
          <button className="btn btn-primary" style={{ width: 'auto', margin: '0 auto' }} onClick={() => setPickerOpen(true)}>
            ＋ Choisir des recettes
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="section-title">🍽️ Recettes au menu</div>
          <div className="stack">
            {cartRecipes.map(c => (
              <div className="card" key={c.recipeId} style={{ padding: 12 }}>
                <div className="row">
                  <button className="grow" style={{ textAlign: 'left', fontWeight: 750, fontSize: 16 }} onClick={() => navigate(`recette/${c.recipeId}`)}>
                    {c.recipe.title}
                  </button>
                  <button
                    className="icon-btn plain"
                    aria-label="Retirer la recette"
                    onClick={() => actions.removeCartRecipe(c.recipeId)}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ marginTop: 6 }}>
                  <PeopleSteppers
                    small
                    adults={c.adults}
                    children={c.children}
                    onChange={(a, k) => actions.setCartRecipe(c.recipeId, a, k)}
                  />
                </div>
              </div>
            ))}
            <button className="btn btn-soft" onClick={() => setPickerOpen(true)}>＋ Ajouter une recette</button>
          </div>

          {grouped.map(({ dept, lines }) => (
            <div key={dept.id}>
              <div className="dept-head">
                <span>{dept.emoji}</span> {dept.label}
              </div>
              <div className="card" style={{ padding: '4px 14px' }}>
                {lines.map(line => (
                  <ShoppingLine
                    key={line.key}
                    line={line}
                    checked={line.extra ? line.checked : !!data.cart.checked[line.key]}
                    onToggle={checked => {
                      if (line.extra) actions.updateExtra(line.id, { checked })
                      else actions.toggleChecked(line.key, checked)
                    }}
                    onDelete={line.extra ? () => actions.deleteExtra(line.id) : null}
                    onPrice={() => setPriceEdit({ name: line.name, dept: line.dept, entry: line.estimate?.entry ?? null })}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="stack" style={{ marginTop: 16 }}>
            <button className="btn btn-soft" onClick={() => setExtraOpen(true)}>＋ Autre article</button>
            <div className="total-card">
              <div>
                <div style={{ fontWeight: 800 }}>Total estimé</div>
                <div className="hint">
                  {unknown > 0 ? `${unknown} article${unknown > 1 ? 's' : ''} sans prix · ` : ''}prix indicatifs Carrefour
                </div>
              </div>
              <div className="amount">≈ {formatPrice(total)}</div>
            </div>
            <div className="hint" style={{ textAlign: 'center' }}>
              Touche un prix pour le corriger — la base est commune à toute la famille.
            </div>
          </div>
        </>
      )}

      {pickerOpen && <RecipePicker onClose={() => setPickerOpen(false)} />}
      {extraOpen && <ExtraSheet onClose={() => setExtraOpen(false)} />}
      {priceEdit && <PriceSheet init={priceEdit} onClose={() => setPriceEdit(null)} />}
    </div>
  )
}

function ShoppingLine({ line, checked, onToggle, onDelete, onPrice }) {
  const est = line.estimate
  return (
    <div className={`checkrow ${checked ? 'checked' : ''}`}>
      <button className="checkbox" onClick={() => onToggle(!checked)} aria-label="Cocher">
        {checked ? '✓' : ''}
      </button>
      <div className="grow" onClick={() => onToggle(!checked)}>
        <div className="item-name">
          {line.qty != null && <span className="item-qty">{line.text} </span>}
          {line.name}
          {line.qty == null && line.text === 'selon goût' && <span className="meta-txt"> · selon goût</span>}
        </div>
        {est ? (
          <button className="item-sub" onClick={e => { e.stopPropagation(); onPrice() }}>
            🏷 {est.buyLabel} · <span className="price-tag">{est.approx ? '~' : ''}{formatPrice(est.cost)}</span>
          </button>
        ) : (
          <button className="item-sub unknown" onClick={e => { e.stopPropagation(); onPrice() }}>
            <span className="price-tag">prix inconnu — ajouter</span>
          </button>
        )}
      </div>
      {onDelete && (
        <button className="icon-btn plain" onClick={onDelete} aria-label="Supprimer l’article">✕</button>
      )}
    </div>
  )
}

function RecipePicker({ onClose }) {
  const { data, actions, household } = useApp()
  const toast = useToast()
  const [query, setQuery] = useState('')

  const inCart = new Set(data.cart.recipes.map(c => c.recipeId))
  const q = normalizeName(query)
  const list = data.recipes.filter(r => !inCart.has(r.id) && (!q || normalizeName(r.title).includes(q)))

  const add = async recipe => {
    const ok = await actions.setCartRecipe(recipe.id, household.adults, household.children)
    if (ok) {
      toast(`« ${recipe.title} » ajoutée 🛒`)
      onClose()
    }
  }

  return (
    <Sheet title="Ajouter une recette aux courses" onClose={onClose}>
      <div className="searchbar" style={{ boxShadow: 'none', border: '1.5px solid var(--line)' }}>
        <span aria-hidden>🔍</span>
        <input autoFocus type="search" placeholder="Rechercher…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {list.length === 0 && <div className="hint" style={{ textAlign: 'center', padding: 20 }}>Aucune recette disponible.</div>}
        {list.map(r => (
          <button key={r.id} className="recipe-card" style={{ boxShadow: 'none', border: '1.5px solid var(--line)' }} onClick={() => add(r)}>
            <span className="grow">
              <span className="title">{r.title}</span>
              <span className="meta"><span className="meta-txt">👤 {r.servings} · {r.ingredients.length} ingrédients</span></span>
            </span>
            <span style={{ fontSize: 22 }}>＋</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function ExtraSheet({ onClose }) {
  const { actions } = useApp()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [dept, setDept] = useState('autres')

  const submit = async e => {
    e.preventDefault()
    if (!name.trim()) return
    const parsed = qty === '' ? null : Number(qty.replace(',', '.'))
    const ok = await actions.addExtra({
      name: name.trim(),
      qty: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      unit: unit || null,
      dept,
    })
    if (ok) onClose()
  }

  return (
    <Sheet title="Ajouter un article" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input autoFocus placeholder="Essuie-tout, chocolat…" value={name} onChange={e => setName(e.target.value)} />
        <div className="row">
          <input style={{ width: 90 }} inputMode="decimal" placeholder="Qté" value={qty} onChange={e => setQty(e.target.value)} />
          <select style={{ width: 120 }} value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="">—</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select className="grow" value={dept} onChange={e => setDept(e.target.value)}>
            {DEPTS.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Ajouter</button>
      </form>
    </Sheet>
  )
}

// Édition d'un prix de référence (base commune, façon Carrefour)
function PriceSheet({ init, onClose }) {
  const { actions } = useApp()
  const toast = useToast()
  const entry = init.entry
  const [name, setName] = useState(entry?.name ?? init.name)
  const [price, setPrice] = useState(entry ? String(entry.price).replace('.', ',') : '')
  const [unitQty, setUnitQty] = useState(entry ? String(entry.unitQty).replace('.', ',') : '1')
  const [unit, setUnit] = useState(entry?.unit ?? 'kg')
  const [loose, setLoose] = useState(entry ? entry.loose : true)
  const [dept, setDept] = useState(entry?.dept ?? init.dept ?? 'autres')

  const submit = async e => {
    e.preventDefault()
    const p = Number(price.replace(',', '.'))
    const uq = Number(unitQty.replace(',', '.'))
    if (!name.trim() || !Number.isFinite(p) || p < 0 || !Number.isFinite(uq) || uq <= 0) {
      toast('Vérifie le nom, la quantité et le prix', 'error')
      return
    }
    const ok = await actions.upsertPrice({ name: name.trim(), price: p, unitQty: uq, unit, loose, dept })
    if (ok) {
      toast('Prix enregistré pour tout le monde ✓')
      onClose()
    }
  }

  return (
    <Sheet title={entry ? `Corriger « ${entry.name} »` : 'Nouveau prix de référence'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Produit
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className="row">
          <label className="field" style={{ width: 110 }}>
            Prix (€)
            <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="1,95" />
          </label>
          <label className="field" style={{ width: 90 }}>
            Pour
            <input inputMode="decimal" value={unitQty} onChange={e => setUnitQty(e.target.value)} />
          </label>
          <label className="field grow">
            Unité
            <select value={unit} onChange={e => setUnit(e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <label className="row" style={{ fontWeight: 700, gap: 10 }}>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={loose} onChange={e => setLoose(e.target.checked)} />
          Vendu au poids / à l’unité (sinon : par paquet entier)
        </label>
        <label className="field">
          Rayon
          <select value={dept} onChange={e => setDept(e.target.value)}>
            {DEPTS.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">Enregistrer</button>
      </form>
    </Sheet>
  )
}
