import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { categoryInfo } from './lib/constants.js'

// --- Toasts -----------------------------------------------------------------

const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const show = useCallback((message, kind = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, kind })
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 4000 : 2400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>{toast.message}</div>}
    </ToastContext.Provider>
  )
}

// --- Feuille modale (bottom sheet) ------------------------------------------

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

// --- Steppers ---------------------------------------------------------------

export function Stepper({ value, onChange, min = 0, max = 20, small = false, label }) {
  return (
    <div className={`stepper ${small ? 'small' : ''}`}>
      {label && <span style={{ fontSize: small ? 15 : 16, fontWeight: 700 }}>{label}</span>}
      <button type="button" className="step-btn" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="moins">−</button>
      <span className="step-val">{value}</span>
      <button type="button" className="step-btn" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="plus">+</button>
    </div>
  )
}

// Sélecteur adultes + enfants (un enfant = ⅔ de portion adulte)
export function PeopleSteppers({ adults, children: kids, onChange, small = false }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <Stepper small={small} label="👤" value={adults} min={0} onChange={v => onChange(v, kids)} />
      <Stepper small={small} label="🧒" value={kids} min={0} onChange={v => onChange(adults, v)} />
    </div>
  )
}

// --- Divers -----------------------------------------------------------------

export function BackHeader({ title, onBack, right }) {
  return (
    <div className="back-header">
      <button className="icon-btn" onClick={onBack} aria-label="Retour">←</button>
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function CategoryBadge({ category }) {
  const info = categoryInfo(category)
  return (
    <span className={`badge ${info.id}`}>
      {info.emoji} {info.label}
    </span>
  )
}

export function EmptyState({ emoji, text, children }) {
  return (
    <div className="empty">
      <div className="big">{emoji}</div>
      <p>{text}</p>
      {children}
    </div>
  )
}

export function totalTime(recipe) {
  const total = (recipe.prepMin || 0) + (recipe.cookMin || 0)
  if (!total) return null
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

// Icônes de la barre d'onglets (traits épais, lisibles)
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const TabIcons = {
  recettes: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
      <path d="M9 8h7M9 11.5h5" />
    </svg>
  ),
  courses: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
      <circle cx="10" cy="20.2" r="1.4" />
      <circle cx="17.5" cy="20.2" r="1.4" />
    </svg>
  ),
  ajouter: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2v7.6M8.2 12h7.6" />
    </svg>
  ),
}
