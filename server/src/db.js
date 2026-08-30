import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Toutes les données vivent dans DATA_DIR (base + photos) : un seul volume à
// monter en production pour que rien ne soit perdu au redéploiement.
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'hellomiam.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'perso',
    servings INTEGER NOT NULL DEFAULT 2,
    prep_min INTEGER,
    cook_min INTEGER,
    notes TEXT,
    photo TEXT,
    ingredients TEXT NOT NULL DEFAULT '[]',
    steps TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    unit TEXT NOT NULL,
    unit_qty REAL NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    dept TEXT NOT NULL DEFAULT 'autres',
    loose INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_recipes (
    recipe_id TEXT PRIMARY KEY,
    adults INTEGER NOT NULL DEFAULT 2,
    children INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_extras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    qty REAL,
    unit TEXT,
    dept TEXT NOT NULL DEFAULT 'autres',
    checked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cart_checked (
    key TEXT PRIMARY KEY,
    checked INTEGER NOT NULL DEFAULT 1
  );
`)

function now() {
  return new Date().toISOString()
}

function seedIfEmpty() {
  const nbRecipes = db.prepare('SELECT COUNT(*) AS n FROM recipes').get().n
  if (nbRecipes === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-recipes.json'), 'utf8'))
    const insert = db.prepare(`
      INSERT INTO recipes (id, title, category, servings, prep_min, cook_min, notes, photo, ingredients, steps, created_at, updated_at)
      VALUES (@id, @title, @category, @servings, @prep_min, @cook_min, @notes, @photo, @ingredients, @steps, @created_at, @updated_at)
    `)
    const ts = now()
    for (const r of seed) {
      insert.run({
        id: randomUUID(),
        title: r.title,
        category: r.category,
        servings: r.servings,
        prep_min: r.prepMin ?? null,
        cook_min: r.cookMin ?? null,
        notes: r.notes ?? null,
        photo: null,
        ingredients: JSON.stringify(r.ingredients),
        steps: JSON.stringify(r.steps),
        created_at: ts,
        updated_at: ts,
      })
    }
  }

  const nbPrices = db.prepare('SELECT COUNT(*) AS n FROM prices').get().n
  if (nbPrices === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-prices.json'), 'utf8'))
    const insert = db.prepare(`
      INSERT INTO prices (name, unit, unit_qty, price, dept, loose, updated_at)
      VALUES (@name, @unit, @unitQty, @price, @dept, @loose, @updatedAt)
    `)
    const ts = now()
    for (const p of seed) {
      insert.run({ ...p, loose: p.loose ? 1 : 0, updatedAt: ts })
    }
  }
}

seedIfEmpty()

// --- Recettes ---------------------------------------------------------------

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
    ingredients: JSON.parse(row.ingredients),
    steps: JSON.parse(row.steps),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listRecipes() {
  return db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all().map(rowToRecipe)
}

export function getRecipe(id) {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id)
  return row ? rowToRecipe(row) : null
}

export function insertRecipe(recipe) {
  const id = randomUUID()
  const ts = now()
  db.prepare(`
    INSERT INTO recipes (id, title, category, servings, prep_min, cook_min, notes, photo, ingredients, steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, recipe.title, recipe.category, recipe.servings,
    recipe.prepMin ?? null, recipe.cookMin ?? null, recipe.notes ?? null, recipe.photo ?? null,
    JSON.stringify(recipe.ingredients), JSON.stringify(recipe.steps), ts, ts
  )
  return getRecipe(id)
}

export function updateRecipe(id, recipe) {
  const found = db.prepare(`
    UPDATE recipes SET title = ?, category = ?, servings = ?, prep_min = ?, cook_min = ?,
      notes = ?, photo = ?, ingredients = ?, steps = ?, updated_at = ?
    WHERE id = ?
  `).run(
    recipe.title, recipe.category, recipe.servings,
    recipe.prepMin ?? null, recipe.cookMin ?? null, recipe.notes ?? null, recipe.photo ?? null,
    JSON.stringify(recipe.ingredients), JSON.stringify(recipe.steps), now(), id
  ).changes
  return found ? getRecipe(id) : null
}

export function deleteRecipe(id) {
  db.prepare('DELETE FROM cart_recipes WHERE recipe_id = ?').run(id)
  return db.prepare('DELETE FROM recipes WHERE id = ?').run(id).changes > 0
}

// --- Prix de référence ------------------------------------------------------

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

export function listPrices() {
  return db.prepare('SELECT * FROM prices ORDER BY name COLLATE NOCASE').all().map(rowToPrice)
}

export function upsertPrice(p) {
  db.prepare(`
    INSERT INTO prices (name, unit, unit_qty, price, dept, loose, updated_at)
    VALUES (@name, @unit, @unitQty, @price, @dept, @loose, @updatedAt)
    ON CONFLICT(name) DO UPDATE SET
      unit = excluded.unit, unit_qty = excluded.unit_qty, price = excluded.price,
      dept = excluded.dept, loose = excluded.loose, updated_at = excluded.updated_at
  `).run({
    name: p.name,
    unit: p.unit,
    unitQty: p.unitQty ?? 1,
    price: p.price,
    dept: p.dept ?? 'autres',
    loose: p.loose ? 1 : 0,
    updatedAt: now(),
  })
  return rowToPrice(db.prepare('SELECT * FROM prices WHERE name = ? COLLATE NOCASE').get(p.name))
}

export function deletePrice(id) {
  return db.prepare('DELETE FROM prices WHERE id = ?').run(id).changes > 0
}

// --- Panier (liste de courses partagée) -------------------------------------

export function getCart() {
  return {
    recipes: db.prepare('SELECT * FROM cart_recipes ORDER BY added_at').all()
      .map(r => ({ recipeId: r.recipe_id, adults: r.adults, children: r.children })),
    extras: db.prepare('SELECT * FROM cart_extras ORDER BY rowid').all()
      .map(e => ({ id: e.id, name: e.name, qty: e.qty, unit: e.unit, dept: e.dept, checked: !!e.checked })),
    checked: Object.fromEntries(
      db.prepare('SELECT key, checked FROM cart_checked').all().map(c => [c.key, !!c.checked])
    ),
  }
}

export function setCartRecipe(recipeId, adults, children) {
  if (!getRecipe(recipeId)) return false
  db.prepare(`
    INSERT INTO cart_recipes (recipe_id, adults, children, added_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(recipe_id) DO UPDATE SET adults = excluded.adults, children = excluded.children
  `).run(recipeId, adults, children, now())
  return true
}

export function removeCartRecipe(recipeId) {
  return db.prepare('DELETE FROM cart_recipes WHERE recipe_id = ?').run(recipeId).changes > 0
}

export function clearCart() {
  db.prepare('DELETE FROM cart_recipes').run()
  db.prepare('DELETE FROM cart_extras').run()
  db.prepare('DELETE FROM cart_checked').run()
}

export function addExtra(extra) {
  const id = randomUUID()
  db.prepare('INSERT INTO cart_extras (id, name, qty, unit, dept, checked) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, extra.name, extra.qty ?? null, extra.unit ?? null, extra.dept ?? 'autres')
  return { id, name: extra.name, qty: extra.qty ?? null, unit: extra.unit ?? null, dept: extra.dept ?? 'autres', checked: false }
}

export function updateExtra(id, fields) {
  const cur = db.prepare('SELECT * FROM cart_extras WHERE id = ?').get(id)
  if (!cur) return false
  db.prepare('UPDATE cart_extras SET name = ?, qty = ?, unit = ?, dept = ?, checked = ? WHERE id = ?')
    .run(
      fields.name ?? cur.name,
      fields.qty !== undefined ? fields.qty : cur.qty,
      fields.unit !== undefined ? fields.unit : cur.unit,
      fields.dept ?? cur.dept,
      fields.checked !== undefined ? (fields.checked ? 1 : 0) : cur.checked,
      id
    )
  return true
}

export function deleteExtra(id) {
  return db.prepare('DELETE FROM cart_extras WHERE id = ?').run(id).changes > 0
}

export function setChecked(key, checked) {
  if (checked) {
    db.prepare('INSERT INTO cart_checked (key, checked) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET checked = 1').run(key)
  } else {
    db.prepare('DELETE FROM cart_checked WHERE key = ?').run(key)
  }
}
