// Couche de données de HelloMiam. Deux modes, même interface :
//
//  • local   — tout est dans le localStorage du téléphone. Aucune configuration,
//              l'appli marche dès l'ouverture (comme les autres apps du dépôt).
//  • commun  — une base Supabase gratuite partagée par toute la famille : ce
//              qu'une personne ajoute apparaît chez les autres.
//
// Le mode commun se règle depuis l'appli (onglet Ajouter → Base commune) en
// collant l'URL du projet et sa clé « anon ». Rien n'est écrit en dur ici :
// le dépôt est public, les clés restent sur l'appareil.

import { SEED_RECIPES, SEED_PRICES } from './seed.js'
import { validateRecipe } from './validate.js'

const LS_DATA = 'hellomiam.v1'
const LS_CONFIG = 'hellomiam.remote.v1'
const LS_HOUSEHOLD = 'hellomiam.household.v1'

export const TABLES = ['recipes', 'prices', 'cart_recipes', 'cart_extras', 'cart_checked']

// ——— Identifiants ———————————————————————————————————————————————

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso() {
  return new Date().toISOString()
}

// ——— Réglages de la base commune ————————————————————————————————

export function loadRemoteConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_CONFIG))
    if (raw?.url && raw?.key) return { url: String(raw.url).replace(/\/+$/, ''), key: String(raw.key) }
  } catch { /* pas configuré */ }
  return null
}

export function saveRemoteConfig(config) {
  if (!config) localStorage.removeItem(LS_CONFIG)
  else localStorage.setItem(LS_CONFIG, JSON.stringify({ url: String(config.url).replace(/\/+$/, ''), key: config.key }))
}

export function loadHousehold() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_HOUSEHOLD))
    if (Number.isFinite(raw?.adults) && Number.isFinite(raw?.children)) return raw
  } catch { /* valeur par défaut */ }
  return { adults: 2, children: 0 }
}

export function saveHousehold(adults, children) {
  localStorage.setItem(LS_HOUSEHOLD, JSON.stringify({ adults, children }))
}

// ——— Sauvegarde locale ——————————————————————————————————————————

function blankState() {
  return { recipes: [], prices: [], cart: { recipes: [], extras: [], checked: {} } }
}

function seededState() {
  const ts = nowIso()
  return {
    recipes: SEED_RECIPES.map(r => {
      const { recipe } = validateRecipe(r)
      return { ...recipe, id: newId(), createdAt: ts, updatedAt: ts }
    }),
    prices: SEED_PRICES.map((p, i) => ({ ...p, id: i + 1, updatedAt: ts })),
    cart: { recipes: [], extras: [], checked: {} },
  }
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_DATA))
    if (raw?.recipes && raw?.prices && raw?.cart) return raw
  } catch { /* première ouverture ou données abîmées */ }
  const fresh = seededState()
  writeLocal(fresh)
  return fresh
}

function writeLocal(state) {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(state))
  } catch (e) {
    // Quota dépassé : presque toujours à cause des photos en data-URL.
    throw new Error('Mémoire du téléphone pleine — supprime des photos de recettes')
  }
}

// ——— Appels Supabase (API REST PostgREST) ————————————————————————

async function pg(config, method, path, { body, headers = {}, query = '' } = {}) {
  let res
  try {
    res = await fetch(`${config.url}/rest/v1/${path}${query}`, {
      method,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Base commune injoignable — vérifie ta connexion')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      throw new Error('Base commune refusée : vérifie la clé anon et les règles d’accès')
    }
    if (res.status === 404 || /does not exist/i.test(text)) {
      throw new Error('Tables absentes : exécute le script SQL fourni dans Supabase')
    }
    throw new Error(`Base commune : ${text.slice(0, 120) || res.status}`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Vérifie que la configuration marche et que les tables existent.
export async function testRemote(config) {
  await pg(config, 'GET', 'recipes', { query: '?select=id&limit=1' })
  return true
}

function rowToRecipe(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    servings: row.servings,
    prepMin: row.prep_min,
    cookMin: row.cook_min,
    notes: row.notes,
    photo: row.photo,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function recipeToRow(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    servings: recipe.servings,
    prep_min: recipe.prepMin ?? null,
    cook_min: recipe.cookMin ?? null,
    notes: recipe.notes ?? null,
    photo: recipe.photo ?? null,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    created_at: recipe.createdAt ?? nowIso(),
    updated_at: nowIso(),
  }
}

function priceToRow(p) {
  return {
    name: p.name,
    unit: p.unit,
    unit_qty: p.unitQty ?? 1,
    price: p.price,
    dept: p.dept ?? 'autres',
    loose: !!p.loose,
    updated_at: nowIso(),
  }
}

function rowToPrice(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitQty: row.unit_qty,
    price: row.price,
    dept: row.dept,
    loose: !!row.loose,
    updatedAt: row.updated_at,
  }
}

// ——— Magasin ————————————————————————————————————————————————————
//
// Une seule classe, deux implémentations derrière chaque méthode. L'appli ne
// sait pas dans quel mode elle tourne : elle appelle store.addRecipe(...) et
// reçoit l'état à jour.

export class Store {
  constructor() {
    this.config = loadRemoteConfig()
    this.state = blankState()
  }

  get isRemote() {
    return !!this.config
  }

  get mode() {
    return this.config ? 'commun' : 'local'
  }

  async useRemote(config) {
    await testRemote(config)
    this.config = config
    saveRemoteConfig(config)
    await this.load()
  }

  async useLocal() {
    this.config = null
    saveRemoteConfig(null)
    await this.load()
  }

  async load() {
    if (!this.config) {
      this.state = readLocal()
      return this.state
    }
    const [recipes, prices, cartRecipes, extras, checked] = await Promise.all([
      pg(this.config, 'GET', 'recipes', { query: '?select=*&order=created_at.desc' }),
      pg(this.config, 'GET', 'prices', { query: '?select=*&order=name.asc' }),
      pg(this.config, 'GET', 'cart_recipes', { query: '?select=*' }),
      pg(this.config, 'GET', 'cart_extras', { query: '?select=*' }),
      pg(this.config, 'GET', 'cart_checked', { query: '?select=*' }),
    ])
    this.state = {
      recipes: (recipes ?? []).map(rowToRecipe),
      prices: (prices ?? []).map(rowToPrice),
      cart: {
        recipes: (cartRecipes ?? []).map(r => ({ recipeId: r.recipe_id, adults: r.adults, children: r.children })),
        extras: (extras ?? []).map(e => ({ id: e.id, name: e.name, qty: e.qty, unit: e.unit, dept: e.dept, checked: !!e.checked })),
        checked: Object.fromEntries((checked ?? []).map(c => [c.key, true])),
      },
    }
    return this.state
  }

  // Première synchronisation : envoie les recettes et prix locaux vers une base
  // commune encore vide, pour ne rien perdre en basculant.
  async pushLocalTo(config) {
    const local = readLocal()
    const remote = await pg(config, 'GET', 'recipes', { query: '?select=id&limit=1' })
    if (remote?.length) return { pushed: 0, skipped: true }
    if (local.recipes.length) {
      await pg(config, 'POST', 'recipes', { body: local.recipes.map(recipeToRow) })
    }
    if (local.prices.length) {
      await pg(config, 'POST', 'prices', {
        body: local.prices.map(priceToRow),
        headers: { Prefer: 'resolution=merge-duplicates' },
      })
    }
    return { pushed: local.recipes.length, skipped: false }
  }

  // ——— Recettes ———

  async addRecipe(recipe) {
    const full = { ...recipe, id: newId(), createdAt: nowIso(), updatedAt: nowIso() }
    if (this.config) {
      const [row] = await pg(this.config, 'POST', 'recipes', {
        body: [recipeToRow(full)],
        headers: { Prefer: 'return=representation' },
      })
      const saved = rowToRecipe(row)
      this.state.recipes.unshift(saved)
      return saved
    }
    this.state.recipes.unshift(full)
    writeLocal(this.state)
    return full
  }

  async addRecipes(list) {
    const saved = []
    for (const recipe of list) saved.push(await this.addRecipe(recipe))
    return saved
  }

  async updateRecipe(id, recipe) {
    const existing = this.state.recipes.find(r => r.id === id)
    const full = { ...existing, ...recipe, id, updatedAt: nowIso() }
    if (this.config) {
      await pg(this.config, 'PATCH', 'recipes', { query: `?id=eq.${id}`, body: recipeToRow(full) })
    }
    this.state.recipes = this.state.recipes.map(r => (r.id === id ? full : r))
    if (!this.config) writeLocal(this.state)
    return full
  }

  async deleteRecipe(id) {
    if (this.config) {
      await pg(this.config, 'DELETE', 'cart_recipes', { query: `?recipe_id=eq.${id}` })
      await pg(this.config, 'DELETE', 'recipes', { query: `?id=eq.${id}` })
    }
    this.state.recipes = this.state.recipes.filter(r => r.id !== id)
    this.state.cart.recipes = this.state.cart.recipes.filter(c => c.recipeId !== id)
    if (!this.config) writeLocal(this.state)
  }

  // ——— Prix de référence ———

  async upsertPrice(price) {
    const existing = this.state.prices.find(
      p => p.name.toLowerCase() === price.name.toLowerCase()
    )
    if (this.config) {
      const [row] = await pg(this.config, 'POST', 'prices', {
        body: [priceToRow(price)],
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      })
      const saved = rowToPrice(row)
      this.state.prices = existing
        ? this.state.prices.map(p => (p.id === saved.id || p.name.toLowerCase() === saved.name.toLowerCase() ? saved : p))
        : [...this.state.prices, saved]
      return saved
    }
    const saved = {
      ...price,
      id: existing?.id ?? (Math.max(0, ...this.state.prices.map(p => p.id || 0)) + 1),
      updatedAt: nowIso(),
    }
    this.state.prices = existing
      ? this.state.prices.map(p => (p.id === existing.id ? saved : p))
      : [...this.state.prices, saved]
    writeLocal(this.state)
    return saved
  }

  // ——— Liste de courses ———

  async setCartRecipe(recipeId, adults, children) {
    if (this.config) {
      await pg(this.config, 'POST', 'cart_recipes', {
        body: [{ recipe_id: recipeId, adults, children, added_at: nowIso() }],
        headers: { Prefer: 'resolution=merge-duplicates' },
      })
    }
    const existing = this.state.cart.recipes.find(c => c.recipeId === recipeId)
    this.state.cart.recipes = existing
      ? this.state.cart.recipes.map(c => (c.recipeId === recipeId ? { ...c, adults, children } : c))
      : [...this.state.cart.recipes, { recipeId, adults, children }]
    if (!this.config) writeLocal(this.state)
  }

  async removeCartRecipe(recipeId) {
    if (this.config) await pg(this.config, 'DELETE', 'cart_recipes', { query: `?recipe_id=eq.${recipeId}` })
    this.state.cart.recipes = this.state.cart.recipes.filter(c => c.recipeId !== recipeId)
    if (!this.config) writeLocal(this.state)
  }

  async clearCart() {
    if (this.config) {
      await pg(this.config, 'DELETE', 'cart_recipes', { query: '?recipe_id=not.is.null' })
      await pg(this.config, 'DELETE', 'cart_extras', { query: '?id=not.is.null' })
      await pg(this.config, 'DELETE', 'cart_checked', { query: '?key=not.is.null' })
    }
    this.state.cart = { recipes: [], extras: [], checked: {} }
    if (!this.config) writeLocal(this.state)
  }

  async addExtra(extra) {
    const full = { id: newId(), name: extra.name, qty: extra.qty ?? null, unit: extra.unit ?? null, dept: extra.dept ?? 'autres', checked: false }
    if (this.config) await pg(this.config, 'POST', 'cart_extras', { body: [full] })
    this.state.cart.extras.push(full)
    if (!this.config) writeLocal(this.state)
    return full
  }

  async updateExtra(id, fields) {
    if (this.config) await pg(this.config, 'PATCH', 'cart_extras', { query: `?id=eq.${id}`, body: fields })
    this.state.cart.extras = this.state.cart.extras.map(e => (e.id === id ? { ...e, ...fields } : e))
    if (!this.config) writeLocal(this.state)
  }

  async deleteExtra(id) {
    if (this.config) await pg(this.config, 'DELETE', 'cart_extras', { query: `?id=eq.${id}` })
    this.state.cart.extras = this.state.cart.extras.filter(e => e.id !== id)
    if (!this.config) writeLocal(this.state)
  }

  async setChecked(key, checked) {
    if (this.config) {
      if (checked) await pg(this.config, 'POST', 'cart_checked', { body: [{ key }], headers: { Prefer: 'resolution=merge-duplicates' } })
      else await pg(this.config, 'DELETE', 'cart_checked', { query: `?key=eq.${encodeURIComponent(key)}` })
    }
    if (checked) this.state.cart.checked[key] = true
    else delete this.state.cart.checked[key]
    if (!this.config) writeLocal(this.state)
  }

  // ——— Sauvegarde / restauration ———

  exportJson() {
    return JSON.stringify({ app: 'hellomiam', version: 1, exportedAt: nowIso(), ...this.state }, null, 2)
  }

  async importBackup(parsed) {
    const recipes = Array.isArray(parsed?.recipes) ? parsed.recipes : []
    const valid = []
    for (const raw of recipes) {
      const { recipe, errors } = validateRecipe(raw)
      if (!errors.length) valid.push(recipe)
    }
    await this.addRecipes(valid)
    return valid.length
  }
}

// Script SQL à coller dans Supabase pour créer les tables de la base commune.
export const SUPABASE_SQL = `-- HelloMiam — base commune. À coller dans Supabase : SQL Editor → Run.

create table if not exists recipes (
  id text primary key,
  title text not null,
  category text not null default 'perso',
  servings int not null default 2,
  prep_min int,
  cook_min int,
  notes text,
  photo text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prices (
  id bigint generated by default as identity primary key,
  name text not null unique,
  unit text not null,
  unit_qty real not null default 1,
  price real not null,
  dept text not null default 'autres',
  loose boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists cart_recipes (
  recipe_id text primary key,
  adults int not null default 2,
  children int not null default 0,
  added_at timestamptz not null default now()
);

create table if not exists cart_extras (
  id text primary key,
  name text not null,
  qty real,
  unit text,
  dept text not null default 'autres',
  checked boolean not null default false
);

create table if not exists cart_checked (key text primary key);

-- Accès en lecture et écriture avec la clé « anon » (usage familial).
alter table recipes       enable row level security;
alter table prices        enable row level security;
alter table cart_recipes  enable row level security;
alter table cart_extras   enable row level security;
alter table cart_checked  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes','prices','cart_recipes','cart_extras','cart_checked'] loop
    execute format('drop policy if exists hellomiam_all on %I', t);
    execute format('create policy hellomiam_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
`
