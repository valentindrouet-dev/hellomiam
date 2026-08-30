import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, storeKey } from './api.js'
import { ToastProvider, useToast, TabIcons } from './ui.jsx'
import RecipesTab from './tabs/RecipesTab.jsx'
import RecipeDetail from './tabs/RecipeDetail.jsx'
import CookMode from './tabs/CookMode.jsx'
import RecipeForm from './tabs/RecipeForm.jsx'
import ShoppingTab from './tabs/ShoppingTab.jsx'
import AddTab from './tabs/AddTab.jsx'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function navigate(path) {
  location.hash = path
}

function parseHash() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

const HOUSEHOLD_KEY = 'hellomiam:household'

function loadHousehold() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOUSEHOLD_KEY))
    if (parsed && Number.isFinite(parsed.adults) && Number.isFinite(parsed.children)) return parsed
  } catch { /* valeur par défaut */ }
  return { adults: 2, children: 0 }
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  )
}

function Root() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [route, setRoute] = useState(parseHash())
  const [household, setHouseholdState] = useState(loadHousehold)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const load = useCallback(async () => {
    try {
      setLoadError(null)
      setData(await api.all())
    } catch (e) {
      setLoadError(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // La base est commune : on se resynchronise quand on revient sur l'appli.
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState === 'visible') {
        api.all().then(setData).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', refetch)
    window.addEventListener('focus', refetch)
    return () => {
      document.removeEventListener('visibilitychange', refetch)
      window.removeEventListener('focus', refetch)
    }
  }, [])

  const setHousehold = useCallback((adults, children) => {
    const value = { adults, children }
    setHouseholdState(value)
    try {
      localStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(value))
    } catch { /* pas grave */ }
  }, [])

  const actions = useMemo(() => {
    // Chaque action renvoie undefined en cas d'échec (déjà signalé par un toast).
    const guard = fn => async (...args) => {
      try {
        return await fn(...args)
      } catch (e) {
        if (e.status === 401) {
          storeKey('')
          setLoadError(e)
        } else {
          toast(e.message || 'Oups, ça n’a pas marché', 'error')
        }
        return undefined
      }
    }

    return {
      refresh: load,
      saveRecipe: guard(async (recipe, id) => {
        const saved = id ? await api.updateRecipe(id, recipe) : await api.createRecipe(recipe)
        setData(d => ({
          ...d,
          recipes: id ? d.recipes.map(r => (r.id === id ? saved : r)) : [saved, ...d.recipes],
        }))
        return saved
      }),
      removeRecipe: guard(async id => {
        await api.deleteRecipe(id)
        setData(d => ({
          ...d,
          recipes: d.recipes.filter(r => r.id !== id),
          cart: { ...d.cart, recipes: d.cart.recipes.filter(c => c.recipeId !== id) },
        }))
        return true
      }),
      importRecipes: guard(async list => {
        const res = await api.importRecipes(list)
        if (res.created.length) setData(d => ({ ...d, recipes: [...res.created, ...d.recipes] }))
        return res
      }),
      upload: guard(api.upload),
      upsertPrice: guard(async price => {
        const saved = await api.upsertPrice(price)
        setData(d => {
          const exists = d.prices.some(p => p.id === saved.id)
          return {
            ...d,
            prices: exists ? d.prices.map(p => (p.id === saved.id ? saved : p)) : [...d.prices, saved],
          }
        })
        return saved
      }),
      setCartRecipe: guard(async (recipeId, adults, children) => {
        const cart = await api.setCartRecipe(recipeId, adults, children)
        setData(d => ({ ...d, cart }))
        return cart
      }),
      removeCartRecipe: guard(async recipeId => {
        const cart = await api.removeCartRecipe(recipeId)
        setData(d => ({ ...d, cart }))
        return cart
      }),
      clearCart: guard(async () => {
        const cart = await api.clearCart()
        setData(d => ({ ...d, cart }))
        return cart
      }),
      addExtra: guard(async extra => {
        const cart = await api.addExtra(extra)
        setData(d => ({ ...d, cart }))
        return cart
      }),
      updateExtra: guard(async (id, fields) => {
        const cart = await api.updateExtra(id, fields)
        setData(d => ({ ...d, cart }))
        return cart
      }),
      deleteExtra: guard(async id => {
        const cart = await api.deleteExtra(id)
        setData(d => ({ ...d, cart }))
        return cart
      }),
      toggleChecked: (key, checked) => {
        // Optimiste : la coche répond immédiatement, la synchro suit.
        setData(d => ({ ...d, cart: { ...d.cart, checked: { ...d.cart.checked, [key]: checked } } }))
        api.setChecked(key, checked).catch(() => {
          setData(d => ({ ...d, cart: { ...d.cart, checked: { ...d.cart.checked, [key]: !checked } } }))
          toast('Coche non synchronisée — vérifie ta connexion', 'error')
        })
      },
    }
  }, [load, toast])

  if (loadError?.status === 401) return <AccessGate onUnlocked={load} />
  if (loadError) {
    return (
      <div className="app">
        <div className="screen">
          <div className="empty" style={{ paddingTop: '30dvh' }}>
            <div className="big">📡</div>
            <p>{loadError.message}</p>
            <button className="btn btn-primary" onClick={load}>Réessayer</button>
          </div>
        </div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="app">
        <div className="empty" style={{ paddingTop: '38dvh' }}>
          <div className="big">🍲</div>
          <p>HelloMiam…</p>
        </div>
      </div>
    )
  }

  const [seg0, seg1, seg2] = route
  let tab = 'recettes'
  let page = null
  let fullscreen = false

  if (seg0 === 'courses') {
    tab = 'courses'
    page = <ShoppingTab />
  } else if (seg0 === 'ajouter') {
    tab = 'ajouter'
    page = seg1 === 'nouvelle' ? <RecipeForm key="new" /> : <AddTab sub={seg1 || null} />
  } else if (seg0 === 'recette' && seg1) {
    const recipe = data.recipes.find(r => r.id === seg1)
    if (!recipe) {
      page = <RecipesTab />
    } else if (seg2 === 'cuisine') {
      page = <CookMode recipe={recipe} />
      fullscreen = true
    } else if (seg2 === 'modifier') {
      page = <RecipeForm key={recipe.id} recipe={recipe} />
    } else {
      page = <RecipeDetail recipe={recipe} />
    }
  } else {
    page = <RecipesTab />
  }

  const cartCount = data.cart.recipes.length

  return (
    <AppContext.Provider value={{ data, actions, toast, household, setHousehold }}>
      <div className="app">
        {page}
        {!fullscreen && (
          <nav className="tabbar">
            <TabButton id="recettes" label="Recettes" active={tab} onClick={() => navigate('')} />
            <TabButton id="courses" label="Courses" active={tab} onClick={() => navigate('courses')} badge={cartCount} />
            <TabButton id="ajouter" label="Ajouter" active={tab} onClick={() => navigate('ajouter')} />
          </nav>
        )}
      </div>
    </AppContext.Provider>
  )
}

function TabButton({ id, label, active, onClick, badge = 0 }) {
  return (
    <button className={active === id ? 'active' : ''} onClick={onClick}>
      {TabIcons[id]}
      {label}
      {badge > 0 && <span className="tab-badge">{badge}</span>}
    </button>
  )
}

function AccessGate({ onUnlocked }) {
  const [code, setCode] = useState('')

  const submit = e => {
    e.preventDefault()
    storeKey(code.trim())
    onUnlocked()
  }

  return (
    <div className="app">
      <div className="screen" style={{ paddingTop: '22dvh' }}>
        <div className="empty">
          <div className="big">🔐</div>
          <p>Cette bible de recettes est protégée.<br />Entre le code d’accès de la famille.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <input
            type="password"
            inputMode="text"
            placeholder="Code d’accès"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" type="submit">Entrer</button>
        </form>
      </div>
    </div>
  )
}
