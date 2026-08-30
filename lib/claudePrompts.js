// Prompts prêts à coller dans claude.ai : c'est la passerelle gratuite entre
// l'appli et Claude (scan de photos + création de recettes).

const FORMAT_DOC = `RÉPONDS UNIQUEMENT avec un JSON valide (aucun texte autour), au format HelloMiam :

{
  "recipes": [
    {
      "title": "Nom de la recette",
      "category": "perso",
      "servings": 2,
      "prepMin": 15,
      "cookMin": 25,
      "notes": "Origine, source ou astuce (facultatif, sinon null)",
      "ingredients": [
        { "name": "Filet de poulet", "qty": 300, "unit": "g", "dept": "boucherie" },
        { "name": "Sel", "qty": null, "unit": null, "dept": "epicerie" }
      ],
      "steps": [
        "Première étape, une ou deux phrases claires.",
        "Deuxième étape..."
      ]
    }
  ]
}

Règles à respecter :
- Tout en français.
- "servings" : nombre d'ADULTES pour lequel les quantités sont prévues (entier).
- "qty" : un nombre (décimales permises), ou null si "selon goût" (sel, poivre...). Jamais de texte.
- "unit" : uniquement "g", "kg", "ml", "cl", "l", "pièce", "c. à soupe", "c. à café", "gousse", "pincée", "botte", "sachet", "tranche", "boîte", "pot" ou "cube" — ou null si sans unité.
- "dept" (rayon de supermarché) : "fruits-legumes", "boucherie", "poissonnerie", "cremerie", "epicerie", "epicerie-sucree", "boulangerie", "surgeles", "boissons" ou "autres".
- "prepMin" / "cookMin" : minutes (entiers), ou null si inconnu.
- Nom d'ingrédient simple, au singulier, sans quantité dedans ("Carotte", pas "3 belles carottes").
- Étapes courtes et précises, dans l'ordre, sans numéro dans le texte.`

export function buildScanPrompt(category = 'perso') {
  return `Voici une ou plusieurs photos de recettes de cuisine (fiche, livre, magazine ou écran).

Retranscris fidèlement CHAQUE recette visible : mêmes ingrédients, mêmes quantités, mêmes étapes (raccourcis seulement les tournures trop longues). Si une information manque (temps, nombre de personnes), estime-la raisonnablement. Utilise "category": "${category}".

${FORMAT_DOC}`
}

export function buildCreatePrompt() {
  return `Tu vas créer une ou plusieurs recettes de cuisine pour mon application HelloMiam.

Si je n'ai pas encore dit ce que je veux, demande-moi d'abord mes envies (type de plat, ingrédients disponibles, contraintes, nombre de personnes). Puis génère la ou les recettes avec "category": "claude".

${FORMAT_DOC}`
}

export const CLAUDE_URL = 'https://claude.ai/new'

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Repli pour les navigateurs sans API clipboard (http, anciens mobiles)
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch { /* rien à faire */ }
    ta.remove()
    return ok
  }
}

export async function sharePrompt(text) {
  if (!navigator.share) return false
  try {
    await navigator.share({ text })
    return true
  } catch {
    return false
  }
}
