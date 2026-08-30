import React, { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { categoryInfo } from '../lib/constants.js'
import { portionsFactor, scaleIngredient, equivalentServings } from '../lib/portions.js'
import { formatQty } from '../lib/units.js'
import { CategoryBadge, PeopleSteppers, totalTime, useToast } from '../ui.jsx'

const CAT_SOFT = {
  hellofresh: 'var(--sage-soft)',
  perso: 'var(--coral-soft)',
  resto: 'var(--lavande-soft)',
  claude: 'var(--gold-soft)',
}

export default function RecipeDetail({ recipe }) {
  const { data, actions, household, setHousehold } = useApp()
  const toast = useToast()
  const info = categoryInfo(recipe.category)

  const inCart = data.cart.recipes.find(c => c.recipeId === recipe.id)
  const [adults, setAdults] = useState(inCart ? inCart.adults : household.adults)
  const [children, setChildren] = useState(inCart ? inCart.children : household.children)

  const factor = portionsFactor(adults, children, recipe.servings)
  const scaled = useMemo(
    () => recipe.ingredients.map(ing => scaleIngredient(ing, factor)),
    [recipe.ingredients, factor]
  )

  const onPeople = (a, c) => {
    setAdults(a)
    setChildren(c)
    setHousehold(a, c)
    if (inCart) actions.setCartRecipe(recipe.id, a, c)
  }

  const addToCart = async () => {
    const ok = await actions.setCartRecipe(recipe.id, adults, children)
    if (ok) toast(inCart ? 'Courses mises à jour 🛒' : 'Ajouté aux courses 🛒')
  }

  const removeRecipe = async () => {
    if (!confirm(`Supprimer « ${recipe.title} » pour tout le monde ?`)) return
    const ok = await actions.removeRecipe(recipe.id)
    if (ok) {
      toast('Recette supprimée')
      navigate('')
    }
  }

  const time = totalTime(recipe)

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <div className="detail-hero" style={{ background: recipe.photo ? 'none' : CAT_SOFT[info.id] }}>
        {recipe.photo ? <img src={recipe.photo} alt="" /> : <span>{info.emoji}</span>}
        <div className="float-btns">
          <button className="icon-btn" onClick={() => history.length > 1 ? history.back() : navigate('')} aria-label="Retour">←</button>
          <div className="grow" />
          <button className="icon-btn" onClick={() => navigate(`recette/${recipe.id}/modifier`)} aria-label="Modifier">✏️</button>
          <button className="icon-btn" onClick={removeRecipe} aria-label="Supprimer">🗑️</button>
        </div>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '16px 0 8px' }}>{recipe.title}</h1>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <CategoryBadge category={recipe.category} />
        {recipe.prepMin != null && <span className="meta-txt">🔪 {recipe.prepMin} min</span>}
        {recipe.cookMin != null && <span className="meta-txt">🍳 {recipe.cookMin} min</span>}
        {time && <span className="meta-txt">⏱ {time} en tout</span>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <PeopleSteppers adults={adults} children={children} onChange={onPeople} />
        <div className="hint" style={{ marginTop: 10 }}>
          {children > 0
            ? `≈ ${formatQty(Math.round(equivalentServings(adults, children) * 10) / 10)} portions adulte (un enfant = ⅔)`
            : `Recette prévue pour ${recipe.servings} — quantités ajustées automatiquement`}
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 10 }}>
        <button className="btn btn-coral" style={{ flex: 1 }} onClick={() => navigate(`recette/${recipe.id}/cuisine`)}>
          ▶ Cuisiner
        </button>
        <button className={`btn ${inCart ? 'btn-soft' : 'btn-primary'}`} style={{ flex: 1 }} onClick={addToCart}>
          {inCart ? '✓ Dans les courses' : '🛒 Aux courses'}
        </button>
      </div>
      {inCart && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ margin: '6px auto 0' }}
          onClick={async () => {
            await actions.removeCartRecipe(recipe.id)
            toast('Retirée des courses')
          }}
        >
          Retirer des courses
        </button>
      )}

      <div className="section-title">🧾 Ingrédients</div>
      <div className="card">
        {scaled.map((ing, i) => (
          <div className="ingredient-row" key={i}>
            <span className="qty">{ing.text}</span>
            <span className="grow">{ing.name}</span>
          </div>
        ))}
      </div>

      <div className="section-title">👩‍🍳 Étapes</div>
      <div className="card">
        {recipe.steps.map((step, i) => (
          <div className="step-row" key={i}>
            <span className="step-num">{i + 1}</span>
            <span className="grow">{step}</span>
          </div>
        ))}
      </div>

      {recipe.notes && (
        <>
          <div className="section-title">💡 Notes</div>
          <div className="card" style={{ color: 'var(--muted)', fontWeight: 600 }}>{recipe.notes}</div>
        </>
      )}
    </div>
  )
}
