import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { portionsFactor, scaleIngredient } from '../lib/portions.js'
import { useToast } from '../ui.jsx'

// Mode cuisine : plein écran, une étape à la fois, gros texte, l'écran reste
// allumé. Navigation par gros boutons ou balayage gauche/droite.
export default function CookMode({ recipe }) {
  const { data, household } = useApp()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const touchStart = useRef(null)

  const inCart = data.cart.recipes.find(c => c.recipeId === recipe.id)
  const adults = inCart ? inCart.adults : household.adults
  const children = inCart ? inCart.children : household.children
  const factor = portionsFactor(adults, children, recipe.servings)
  const scaled = useMemo(
    () => recipe.ingredients.map(ing => scaleIngredient(ing, factor)),
    [recipe.ingredients, factor]
  )

  // Empêche l'écran de s'éteindre pendant qu'on cuisine.
  useEffect(() => {
    let lock = null
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch { /* pas supporté : tant pis */ }
    }
    acquire()
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])

  const total = recipe.steps.length
  const last = step === total - 1

  const next = () => {
    if (last) {
      toast('Bon appétit ! 🍽️')
      navigate(`recette/${recipe.id}`)
    } else {
      setStep(s => s + 1)
    }
  }

  const onTouchStart = e => {
    touchStart.current = e.touches[0].clientX
  }
  const onTouchEnd = e => {
    if (touchStart.current == null) return
    const delta = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) < 60) return
    if (delta < 0) next()
    else setStep(s => Math.max(0, s - 1))
  }

  return (
    <div className="cookmode">
      <div className="cook-head">
        <button className="icon-btn" onClick={() => navigate(`recette/${recipe.id}`)} aria-label="Quitter">✕</button>
        <span className="cook-title">{recipe.title}</span>
        <span className="meta-txt" style={{ fontWeight: 800 }}>
          {step + 1}/{total}
        </span>
      </div>

      <div className="cook-progress">
        {recipe.steps.map((_, i) => (
          <i key={i} className={i <= step ? 'done' : ''} />
        ))}
      </div>

      <div className="cook-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="cook-step-label">Étape {step + 1} sur {total}</div>
        <div className="cook-text">{recipe.steps[step]}</div>
      </div>

      {showIngredients && (
        <div className="cook-ingredients">
          {scaled.map((ing, i) => (
            <div className="ingredient-row" key={i}>
              <span className="qty">{ing.text}</span>
              <span className="grow">{ing.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cook-actions">
        <button className="btn btn-soft" style={{ flex: 0.7 }} onClick={() => setShowIngredients(v => !v)}>
          🧾
        </button>
        <button className="btn btn-soft" style={{ flex: 1 }} disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          ← Préc.
        </button>
        <button className={`btn ${last ? 'btn-coral' : 'btn-primary'}`} style={{ flex: 1.6 }} onClick={next}>
          {last ? 'Terminé 🎉' : 'Suivant →'}
        </button>
      </div>
    </div>
  )
}
