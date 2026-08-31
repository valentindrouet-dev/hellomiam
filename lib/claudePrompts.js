// Prompts prêts à coller dans claude.ai : c'est la passerelle gratuite entre
// l'appli et Claude (scan de photos + création de recettes).

const FORMAT_DOC = `RÉPONDS UNIQUEMENT avec un JSON valide (aucun texte autour), au format HelloMiam :

{
  "recipes": [
    {
      "title": "Nom de la recette",
      "category": "hellofresh",
      "sub": "Le Petit Vietnamien",
      "servings": 2,
      "prepMin": 15,
      "cookMin": 25,
      "photo": "https://exemple.com/photo.jpg",
      "notes": "Origine, source ou astuce (facultatif, sinon null)",
      "tags": ["été", "favori"],
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

CATÉGORIE — le champ "category" vaut exactement l’une de ces quatre valeurs :
- "hellofresh" : recette HelloFresh (ou tout autre kit du même genre : Quitoque, Marmite...). Si je dis « c’est du HelloFresh », « fiche HelloFresh », « kit repas », ou si la photo montre une fiche HelloFresh, c’est cette valeur.
- "resto"      : recette d’un restaurant, ou reproduction d’un plat mangé au restaurant.
- "perso"      : recette de famille, carnet, blog, livre, ou trouvée sur internet.
- "claude"     : recette que tu inventes toi-même.
Ce que je dis dans mon message prime toujours sur le reste. Dans le doute, prends "perso".

SOUS-CATÉGORIE — "sub" précise la catégorie, ou null :
- pour "resto", le nom du restaurant : "sub": "Le Petit Vietnamien" ;
- ailleurs, un regroupement libre si je le mentionne ("Entrées", "Noël", "Mamie").
Ne l’invente pas : si je ne donne rien, mets null.

PHOTO — "photo" est le lien vers l’image de prévisualisation, ou null :
- si je te donne une URL de photo (dans mon message, ou celle de la page de la recette), recopie-la telle quelle dans "photo" ;
- elle doit commencer par https:// ;
- n’invente JAMAIS une URL et ne prends pas celle d’une autre recette : sans lien fourni, mets null.

AUTRES RÈGLES :
- Tout en français.
- "servings" : nombre d’ADULTES pour lequel les quantités sont prévues (entier).
- "qty" : un nombre (décimales permises), ou null si "selon goût" (sel, poivre...). Jamais de texte.
- "unit" : uniquement "g", "kg", "ml", "cl", "l", "pièce", "c. à soupe", "c. à café", "gousse", "pincée", "botte", "tranche", "boîte", "pot", "cube" ou "branche" — ou null si sans unité.
- JAMAIS "sachet" : le contenu varie d'une marque à l'autre et ne se dose pas. Convertis en cuillères ou en grammes (1 sachet de levure chimique ≈ 1 c. à soupe, 1 sachet de sucre vanillé ≈ 2 c. à café).
- Quantités utilisables en cuisine : pas de quart de légume. Pour les choses qui se comptent (pièce, gousse, tranche), reste sur des entiers ou des demis.
- "dept" (rayon de supermarché) : "fruits-legumes", "boucherie", "poissonnerie", "cremerie", "epicerie", "epicerie-sucree", "boulangerie", "surgeles", "boissons" ou "autres".
- "prepMin" / "cookMin" : minutes (entiers), ou null si inconnu.
- "tags" : seulement les étiquettes que je demande explicitement, sinon []. L’appli déduit toute seule végétarien, poisson, four, rapide...
- Nom d’ingrédient simple, au singulier, sans quantité dedans ("Carotte", pas "3 belles carottes").
- Étapes courtes et précises, dans l’ordre, sans numéro dans le texte.`

export function buildScanPrompt(category = 'perso') {
  return `Voici une ou plusieurs photos de recettes de cuisine (fiche, livre, magazine ou écran).

Retranscris fidèlement CHAQUE recette visible : mêmes ingrédients, mêmes quantités, mêmes étapes (raccourcis seulement les tournures trop longues). Si une information manque (temps, nombre de personnes), estime-la raisonnablement.

Par défaut, utilise "category": "${category}" — mais si je précise l’origine dans mon message, ou si la photo la montre clairement, suis cette indication à la place.

Je peux aussi te donner, dans le même message, le lien de la photo du plat et le nom du restaurant : reporte-les dans "photo" et "sub".

${FORMAT_DOC}`
}

export function buildCreatePrompt() {
  return `Tu vas créer une ou plusieurs recettes de cuisine pour mon application HelloMiam.

Si je n’ai pas encore dit ce que je veux, demande-moi d’abord mes envies (type de plat, ingrédients disponibles, contraintes, nombre de personnes). Puis génère la ou les recettes avec "category": "claude" — sauf si je te demande de retranscrire une recette venue d’ailleurs (HelloFresh, un restaurant, un blog), auquel cas mets la catégorie correspondante.

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
