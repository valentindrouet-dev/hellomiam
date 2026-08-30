import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as db from './db.js'
import { validateRecipe } from '../../client/src/lib/validate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '12mb' }))

// Code d'accès partagé optionnel : si APP_KEY est défini au déploiement,
// toutes les requêtes /api doivent porter l'en-tête X-App-Key correspondant.
const APP_KEY = process.env.APP_KEY || ''
app.use('/api', (req, res, next) => {
  if (!APP_KEY || req.path === '/health') return next()
  if (req.get('x-app-key') === APP_KEY) return next()
  res.status(401).json({ error: 'Code d’accès manquant ou incorrect' })
})

app.get('/api/health', (req, res) => res.json({ ok: true, locked: !!APP_KEY }))

// Une seule requête au chargement : tout l'état partagé de l'appli.
app.get('/api/all', (req, res) => {
  res.json({ recipes: db.listRecipes(), prices: db.listPrices(), cart: db.getCart() })
})

// --- Recettes ---------------------------------------------------------------

app.get('/api/recipes', (req, res) => res.json(db.listRecipes()))

app.get('/api/recipes/:id', (req, res) => {
  const recipe = db.getRecipe(req.params.id)
  if (!recipe) return res.status(404).json({ error: 'Recette introuvable' })
  res.json(recipe)
})

app.post('/api/recipes', (req, res) => {
  const { recipe, errors } = validateRecipe(req.body)
  if (errors.length) return res.status(400).json({ error: errors.join(' · ') })
  res.status(201).json(db.insertRecipe(recipe))
})

app.put('/api/recipes/:id', (req, res) => {
  const { recipe, errors } = validateRecipe(req.body)
  if (errors.length) return res.status(400).json({ error: errors.join(' · ') })
  const updated = db.updateRecipe(req.params.id, recipe)
  if (!updated) return res.status(404).json({ error: 'Recette introuvable' })
  res.json(updated)
})

app.delete('/api/recipes/:id', (req, res) => {
  if (!db.deleteRecipe(req.params.id)) return res.status(404).json({ error: 'Recette introuvable' })
  res.json({ ok: true })
})

// Import en lot (recettes générées par Claude ou exportées d'ailleurs)
app.post('/api/import', (req, res) => {
  const list = Array.isArray(req.body?.recipes) ? req.body.recipes : [req.body]
  const created = []
  const errors = []
  for (const [i, raw] of list.entries()) {
    const { recipe, errors: errs } = validateRecipe(raw)
    if (errs.length) errors.push(`Recette ${i + 1} : ${errs.join(', ')}`)
    else created.push(db.insertRecipe(recipe))
  }
  res.status(errors.length && !created.length ? 400 : 201).json({ created, errors })
})

// --- Photos -----------------------------------------------------------------
// La photo arrive en data-URL JPEG (réduite côté client), on la stocke sur disque.

app.post('/api/upload', (req, res) => {
  const dataUrl = req.body?.dataUrl
  const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/s.exec(dataUrl || '')
  if (!match) return res.status(400).json({ error: 'Image invalide (data-URL jpeg/png/webp attendue)' })
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image trop lourde (8 Mo max)' })
  const name = `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`
  fs.writeFileSync(path.join(db.UPLOADS_DIR, name), buffer)
  res.status(201).json({ url: `/uploads/${name}` })
})

// --- Prix de référence ------------------------------------------------------

app.get('/api/prices', (req, res) => res.json(db.listPrices()))

app.post('/api/prices', (req, res) => {
  const p = req.body || {}
  if (!p.name?.trim() || !(p.price >= 0) || !p.unit?.trim() || !(p.unitQty > 0)) {
    return res.status(400).json({ error: 'Prix invalide : nom, unité, quantité et prix requis' })
  }
  res.status(201).json(db.upsertPrice({ ...p, name: p.name.trim(), unit: p.unit.trim() }))
})

app.delete('/api/prices/:id', (req, res) => {
  if (!db.deletePrice(Number(req.params.id))) return res.status(404).json({ error: 'Prix introuvable' })
  res.json({ ok: true })
})

// --- Liste de courses partagée ----------------------------------------------

app.get('/api/cart', (req, res) => res.json(db.getCart()))

app.put('/api/cart/recipes/:recipeId', (req, res) => {
  const adults = Math.max(0, Math.min(20, Math.round(Number(req.body?.adults ?? 2))))
  const children = Math.max(0, Math.min(20, Math.round(Number(req.body?.children ?? 0))))
  if (!db.setCartRecipe(req.params.recipeId, adults, children)) {
    return res.status(404).json({ error: 'Recette introuvable' })
  }
  res.json(db.getCart())
})

app.delete('/api/cart/recipes/:recipeId', (req, res) => {
  db.removeCartRecipe(req.params.recipeId)
  res.json(db.getCart())
})

app.delete('/api/cart', (req, res) => {
  db.clearCart()
  res.json(db.getCart())
})

app.post('/api/cart/extras', (req, res) => {
  const e = req.body || {}
  if (!e.name?.trim()) return res.status(400).json({ error: 'Nom requis' })
  db.addExtra({ ...e, name: e.name.trim() })
  res.status(201).json(db.getCart())
})

app.put('/api/cart/extras/:id', (req, res) => {
  if (!db.updateExtra(req.params.id, req.body || {})) return res.status(404).json({ error: 'Article introuvable' })
  res.json(db.getCart())
})

app.delete('/api/cart/extras/:id', (req, res) => {
  db.deleteExtra(req.params.id)
  res.json(db.getCart())
})

app.put('/api/cart/checked', (req, res) => {
  const { key, checked } = req.body || {}
  if (typeof key !== 'string' || !key) return res.status(400).json({ error: 'Clé requise' })
  db.setChecked(key, !!checked)
  res.json({ ok: true })
})

// --- Fichiers statiques (photos + build du client) --------------------------

app.use('/uploads', express.static(db.UPLOADS_DIR, { maxAge: '30d', immutable: true }))

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // SPA : toute route non-API renvoie l'appli
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
  console.log(`HelloMiam prêt sur http://localhost:${PORT}${APP_KEY ? ' (protégé par code d’accès)' : ''}`)
})
