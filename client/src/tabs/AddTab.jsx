import React, { useState } from 'react'
import { useApp, navigate } from '../App.jsx'
import { CATEGORIES } from '../lib/constants.js'
import { parseImportText, validateRecipe } from '../lib/validate.js'
import { buildScanPrompt, buildCreatePrompt, copyText, sharePrompt, CLAUDE_URL } from '../lib/claudePrompts.js'
import { BackHeader, CategoryBadge, useToast } from '../ui.jsx'

export default function AddTab({ sub }) {
  if (sub === 'scan') return <ScanFlow />
  if (sub === 'claude') return <ClaudeFlow />
  if (sub === 'import') return <ImportFlow />
  return <AddMenu />
}

function AddMenu() {
  return (
    <div className="screen">
      <div className="header">
        <span className="logo">➕</span>
        <h1>Ajouter</h1>
      </div>
      <div className="stack">
        <AddOption
          emoji="📷" bg="var(--lavande-soft)"
          title="Scanner une recette"
          sub="Une photo de fiche ou de livre, Claude la transcrit"
          onClick={() => navigate('ajouter/scan')}
        />
        <AddOption
          emoji="✨" bg="var(--gold-soft)"
          title="Demander à Claude"
          sub="Claude invente une recette au bon format"
          onClick={() => navigate('ajouter/claude')}
        />
        <AddOption
          emoji="✍️" bg="var(--coral-soft)"
          title="Créer à la main"
          sub="Le formulaire complet, pour tes recettes à toi"
          onClick={() => navigate('ajouter/nouvelle')}
        />
        <AddOption
          emoji="📋" bg="var(--sage-soft)"
          title="Importer du JSON"
          sub="Colle une recette au format HelloMiam"
          onClick={() => navigate('ajouter/import')}
        />
      </div>
    </div>
  )
}

function AddOption({ emoji, bg, title, sub, onClick }) {
  return (
    <button className="add-option" onClick={onClick}>
      <span className="emoji" style={{ background: bg }}>{emoji}</span>
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>{title}</span>
        <span className="sub">{sub}</span>
      </span>
      <span style={{ color: 'var(--muted)', fontSize: 20 }}>›</span>
    </button>
  )
}

function PromptButtons({ prompt }) {
  const toast = useToast()
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="stack">
      <button
        className="btn btn-primary"
        onClick={async () => {
          const ok = await copyText(prompt)
          toast(ok ? 'Prompt copié 📋' : 'Copie impossible — utilise « Voir le prompt »', ok ? 'ok' : 'error')
        }}
      >
        📋 Copier le prompt
      </button>
      <div className="row">
        {canShare && (
          <button className="btn btn-soft" style={{ flex: 1 }} onClick={() => sharePrompt(prompt)}>
            Partager
          </button>
        )}
        <a className="btn btn-gold-soft" style={{ flex: 1, textDecoration: 'none' }} href={CLAUDE_URL} target="_blank" rel="noreferrer">
          Ouvrir claude.ai ↗
        </a>
      </div>
      <details>
        <summary className="hint" style={{ cursor: 'pointer' }}>Voir le prompt</summary>
        <pre className="prompt-preview">{prompt}</pre>
      </details>
    </div>
  )
}

function ScanFlow() {
  const [category, setCategory] = useState('hellofresh')

  return (
    <div className="screen">
      <BackHeader title="Scanner une recette" onBack={() => navigate('ajouter')} />

      <div className="stack">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="step-guide"><span className="n">1</span><span>Copie le prompt ci-dessous et ouvre <b>claude.ai</b>.</span></div>
          <div className="step-guide"><span className="n">2</span><span>Colle le prompt, <b>joins la ou les photos</b> de la recette, envoie.</span></div>
          <div className="step-guide"><span className="n">3</span><span>Copie la réponse de Claude et colle-la plus bas.</span></div>
        </div>

        <div className="field" style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Catégorie de la recette scannée</span>
          <div className="chips" style={{ margin: 0, padding: 0 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} type="button" className={`chip ${c.id} ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <PromptButtons prompt={buildScanPrompt(category)} />
        <hr className="divider" />
        <PasteImport placeholder="Colle ici la réponse JSON de Claude…" />
      </div>
    </div>
  )
}

function ClaudeFlow() {
  return (
    <div className="screen">
      <BackHeader title="Demander à Claude" onBack={() => navigate('ajouter')} />
      <div className="stack">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="step-guide"><span className="n">1</span><span>Copie le <b>mode d’emploi</b> ci-dessous et colle-le dans claude.ai.</span></div>
          <div className="step-guide"><span className="n">2</span><span>Discute avec Claude de tes envies — il crée les recettes au format HelloMiam.</span></div>
          <div className="step-guide"><span className="n">3</span><span>Colle sa réponse JSON plus bas pour l’importer.</span></div>
        </div>
        <PromptButtons prompt={buildCreatePrompt()} />
        <hr className="divider" />
        <PasteImport placeholder="Colle ici la réponse JSON de Claude…" />
      </div>
    </div>
  )
}

function ImportFlow() {
  return (
    <div className="screen">
      <BackHeader title="Importer du JSON" onBack={() => navigate('ajouter')} />
      <div className="stack">
        <div className="hint">
          Colle une ou plusieurs recettes au format HelloMiam (celui du prompt « Demander à Claude »).
        </div>
        <PasteImport placeholder='{"recipes": [ … ]}' />
      </div>
    </div>
  )
}

// Zone commune : coller du JSON → aperçu → import dans la base commune.
function PasteImport({ placeholder }) {
  const { actions } = useApp()
  const toast = useToast()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null) // { valid: [raw...], invalid: [message...] }
  const [importing, setImporting] = useState(false)

  const analyse = () => {
    const { recipes, error } = parseImportText(text)
    if (error) {
      toast(error, 'error')
      return
    }
    const valid = []
    const invalid = []
    recipes.forEach((raw, i) => {
      const { recipe, errors } = validateRecipe(raw)
      if (errors.length) invalid.push(`Recette ${i + 1} : ${errors.join(', ')}`)
      else valid.push({ raw, cleaned: recipe })
    })
    setPreview({ valid, invalid })
  }

  const doImport = async () => {
    setImporting(true)
    try {
      const res = await actions.importRecipes(preview.valid.map(v => v.raw))
      if (!res) return
      toast(`${res.created.length} recette${res.created.length > 1 ? 's' : ''} importée${res.created.length > 1 ? 's' : ''} ✓`)
      navigate('')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="stack">
      <textarea
        rows={5}
        value={text}
        onChange={e => {
          setText(e.target.value)
          setPreview(null)
        }}
        placeholder={placeholder}
      />
      {!preview && (
        <button className="btn btn-lavande-soft" disabled={!text.trim()} onClick={analyse}>
          Vérifier avant import
        </button>
      )}

      {preview && (
        <>
          {preview.valid.map((v, i) => (
            <div className="card row" key={i} style={{ padding: 12 }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <span className="grow">
                <span style={{ fontWeight: 750 }}>{v.cleaned.title}</span>
                <span className="hint" style={{ display: 'block' }}>
                  {v.cleaned.ingredients.length} ingrédient{v.cleaned.ingredients.length > 1 ? 's' : ''} · {v.cleaned.steps.length} étape{v.cleaned.steps.length > 1 ? 's' : ''} · pour {v.cleaned.servings}
                </span>
              </span>
              <CategoryBadge category={v.cleaned.category} />
            </div>
          ))}
          {preview.invalid.map((msg, i) => (
            <div className="card" key={i} style={{ padding: 12, background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 650, boxShadow: 'none' }}>
              ⚠️ {msg}
            </div>
          ))}
          {preview.valid.length > 0 && (
            <button className="btn btn-primary" disabled={importing} onClick={doImport}>
              {importing ? 'Import…' : `Importer ${preview.valid.length} recette${preview.valid.length > 1 ? 's' : ''} 📖`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
