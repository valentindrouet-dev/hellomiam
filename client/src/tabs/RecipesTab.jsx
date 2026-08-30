import React, { useMemo, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { CATEGORIES, categoryInfo } from '../lib/constants.js'
import { normalizeName } from '../lib/normalize.js'
import { EmptyState, totalTime } from '../ui.jsx'

const CAT_SOFT = {
  hellofresh: 'var(--sage-soft)',
  perso: 'var(--coral-soft)',
  resto: 'var(--lavande-soft)',
  claude: 'var(--gold-soft)',
}

export default function RecipesTab() {
  const { data } = useApp()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('toutes')

  const filtered = useMemo(() => {
    const q = normalizeName(query)
    return data.recipes.filter(r => {
      if (cat !== 'toutes' && r.category !== cat) return false
      if (!q) return true
      const haystack = normalizeName(`${r.title} ${r.ingredients.map(i => i.name).join(' ')}`)
      return q.split(' ').every(word => haystack.includes(word))
    })
  }, [data.recipes, query, cat])

  return (
    <div className="screen">
      <div className="header">
        <span className="logo">🍲</span>
        <h1>HelloMiam</h1>
        <span className="meta-txt">{data.recipes.length} recettes</span>
      </div>

      <div className="searchbar">
        <span aria-hidden>🔍</span>
        <input
          type="search"
          placeholder="Plat, ingrédient…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && <button className="icon-btn plain" onClick={() => setQuery('')}>✕</button>}
      </div>

      <div className="chips">
        <button className={`chip ${cat === 'toutes' ? 'active' : ''}`} onClick={() => setCat('toutes')}>
          Toutes
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`chip ${c.id} ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(cat === c.id ? 'toutes' : c.id)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState emoji="🥣" text={query || cat !== 'toutes' ? 'Aucune recette ne correspond.' : 'La bible est vide — ajoute ta première recette !'}>
          <button className="btn btn-primary" style={{ width: 'auto', margin: '0 auto' }} onClick={() => navigate('ajouter')}>
            ＋ Ajouter une recette
          </button>
        </EmptyState>
      ) : (
        <div className="stack">
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => navigate(`recette/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

export function RecipeCard({ recipe, onOpen }) {
  const info = categoryInfo(recipe.category)
  const time = totalTime(recipe)
  return (
    <button className="recipe-card" onClick={onOpen}>
      {recipe.photo ? (
        <img className="recipe-thumb" src={recipe.photo} alt="" loading="lazy" />
      ) : (
        <span className="recipe-thumb" style={{ background: CAT_SOFT[info.id] }}>{info.emoji}</span>
      )}
      <span className="grow">
        <span className="title">{recipe.title}</span>
        <span className="meta">
          <span className={`badge ${info.id}`}>{info.emoji} {info.label}</span>
          {time && <span className="meta-txt">⏱ {time}</span>}
          <span className="meta-txt">👤 {recipe.servings}</span>
        </span>
      </span>
    </button>
  )
}
