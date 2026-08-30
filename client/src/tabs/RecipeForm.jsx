import React, { useRef, useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { shrinkImage } from '../api.js'
import { CATEGORIES, DEPTS, UNITS } from '../lib/constants.js'
import { validateRecipe } from '../lib/validate.js'
import { BackHeader, Stepper, useToast } from '../ui.jsx'

const emptyIngredient = () => ({ name: '', qty: '', unit: 'g', dept: 'fruits-legumes' })

export default function RecipeForm({ recipe = null }) {
  const { actions } = useApp()
  const toast = useToast()
  const editing = !!recipe
  const fileInput = useRef(null)

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [category, setCategory] = useState(recipe?.category ?? 'perso')
  const [servings, setServings] = useState(recipe?.servings ?? 2)
  const [prepMin, setPrepMin] = useState(recipe?.prepMin ?? '')
  const [cookMin, setCookMin] = useState(recipe?.cookMin ?? '')
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [photo, setPhoto] = useState(recipe?.photo ?? null) // /uploads/... ou data: en attente
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients.map(i => ({ ...i, qty: i.qty == null ? '' : String(i.qty).replace('.', ','), unit: i.unit ?? '' }))
      ?? [emptyIngredient()]
  )
  const [steps, setSteps] = useState(recipe?.steps ?? [''])
  const [saving, setSaving] = useState(false)

  const setIng = (i, field, value) => {
    setIngredients(list => list.map((ing, k) => (k === i ? { ...ing, [field]: value } : ing)))
  }
  const setStep = (i, value) => setSteps(list => list.map((s, k) => (k === i ? value : s)))

  const pickPhoto = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhoto(await shrinkImage(file))
    } catch {
      toast('Photo illisible', 'error')
    }
  }

  const save = async () => {
    const draft = {
      title,
      category,
      servings,
      prepMin: prepMin === '' ? null : Number(prepMin),
      cookMin: cookMin === '' ? null : Number(cookMin),
      notes: notes.trim() || null,
      photo: photo?.startsWith('/uploads/') ? photo : null,
      ingredients: ingredients
        .filter(i => i.name.trim())
        .map(i => ({ name: i.name, qty: i.qty === '' ? null : i.qty, unit: i.unit || null, dept: i.dept })),
      steps: steps.filter(s => s.trim()),
    }
    const { recipe: cleaned, errors } = validateRecipe(draft)
    if (errors.length) {
      toast(errors.join(' · '), 'error')
      return
    }
    setSaving(true)
    try {
      if (photo?.startsWith('data:')) {
        const uploaded = await actions.upload(photo)
        if (!uploaded) return
        cleaned.photo = uploaded.url
      }
      const saved = await actions.saveRecipe(cleaned, recipe?.id)
      if (saved) {
        toast(editing ? 'Recette mise à jour ✓' : 'Recette ajoutée ✓')
        navigate(`recette/${saved.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <BackHeader
        title={editing ? 'Modifier la recette' : 'Nouvelle recette'}
        onBack={() => (editing ? navigate(`recette/${recipe.id}`) : navigate('ajouter'))}
      />

      <div className="stack">
        <label className="field">
          Titre
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lasagnes de la maison" />
        </label>

        <div className="field" style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Catégorie</span>
          <div className="chips" style={{ margin: 0, padding: 0 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                className={`chip ${c.id} ${category === c.id ? 'active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Pour combien d’adultes ?</span>
          <Stepper value={servings} min={1} onChange={setServings} small />
        </div>

        <div className="row">
          <label className="field grow">
            Préparation (min)
            <input type="number" inputMode="numeric" min="0" value={prepMin} onChange={e => setPrepMin(e.target.value)} placeholder="15" />
          </label>
          <label className="field grow">
            Cuisson (min)
            <input type="number" inputMode="numeric" min="0" value={cookMin} onChange={e => setCookMin(e.target.value)} placeholder="30" />
          </label>
        </div>

        <div className="field" style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Photo (facultatif)</span>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
          {photo ? (
            <div className="row">
              <img src={photo} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 14 }} />
              <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current.click()}>Changer</button>
              <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => setPhoto(null)}>Retirer</button>
            </div>
          ) : (
            <button type="button" className="btn btn-soft" onClick={() => fileInput.current.click()}>
              📷 Ajouter une photo
            </button>
          )}
        </div>

        <div className="section-title" style={{ margin: '10px 0 0' }}>🧾 Ingrédients</div>
        {ingredients.map((ing, i) => (
          <div className="card" key={i} style={{ padding: 12 }}>
            <div className="row">
              <input
                className="grow"
                value={ing.name}
                onChange={e => setIng(i, 'name', e.target.value)}
                placeholder="Carotte"
              />
              <button
                type="button"
                className="icon-btn plain"
                onClick={() => setIngredients(list => list.filter((_, k) => k !== i))}
                aria-label="Retirer l’ingrédient"
              >
                ✕
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                style={{ width: 76 }}
                inputMode="decimal"
                value={ing.qty}
                onChange={e => setIng(i, 'qty', e.target.value)}
                placeholder="200"
              />
              <select style={{ width: 110 }} value={ing.unit} onChange={e => setIng(i, 'unit', e.target.value)}>
                <option value="">—</option>
                {UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <select className="grow" value={ing.dept} onChange={e => setIng(i, 'dept', e.target.value)}>
                {DEPTS.map(d => (
                  <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-soft" onClick={() => setIngredients(l => [...l, emptyIngredient()])}>
          ＋ Ingrédient
        </button>

        <div className="section-title" style={{ margin: '10px 0 0' }}>👩‍🍳 Étapes</div>
        {steps.map((s, i) => (
          <div className="row" key={i} style={{ alignItems: 'flex-start' }}>
            <span className="step-num" style={{ marginTop: 12 }}>{i + 1}</span>
            <textarea
              className="grow"
              rows={2}
              value={s}
              onChange={e => setStep(i, e.target.value)}
              placeholder="Décris l’étape…"
            />
            <button
              type="button"
              className="icon-btn plain"
              style={{ marginTop: 6 }}
              onClick={() => setSteps(list => list.filter((_, k) => k !== i))}
              aria-label="Retirer l’étape"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-soft" onClick={() => setSteps(l => [...l, ''])}>
          ＋ Étape
        </button>

        <label className="field">
          Notes (facultatif)
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Source, astuces, variantes…" rows={2} />
        </label>

        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter à la bible 📖'}
        </button>
      </div>
    </div>
  )
}
