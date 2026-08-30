# HelloMiam 🍲

La bible familiale des recettes de cuisine : recettes pas à pas, quantités
ajustées au nombre de convives, et listes de courses intelligentes chiffrées
sur les prix Carrefour.

C'est une **PWA** (Progressive Web App) : elle s'installe sur l'écran d'accueil
du téléphone comme une vraie app, fonctionne hors-ligne, et n'a besoin d'aucun
serveur — elle tourne telle quelle sur GitHub Pages.

👉 **[Ouvrir l'application](https://valentindrouet-dev.github.io/hellomiam/)**

## Fonctionnalités

- 📖 **Recettes** en 4 catégories : Hello Fresh, Personnelles, Restaurants, Claude — recherche par plat ou par ingrédient
- 👨‍👩‍👧 **Portions adultes + enfants** : un enfant compte pour ⅔ d'un adulte, toutes les quantités se recalculent en direct
- 🍳 **Mode cuisine** plein écran : une étape à la fois en gros texte, l'écran reste allumé, on avance au doigt (balayage ou gros boutons)
- 🛒 **Courses intelligentes** : plusieurs recettes fusionnées en une liste unique (300 g + 0,5 kg → 800 g, 2 c. à soupe + 5 cl → 80 ml), regroupée par rayon
- 💶 **Prix et quantités réelles** : ce qu'il faut vraiment acheter (1 paquet de 1 kg pour 800 g de farine, 2 boîtes de 6 œufs pour 8 œufs) et le total estimé, sur ~160 prix Carrefour indicatifs corrigeables dans l'appli
- 📷 **Scanner une recette** : l'appli prépare le prompt, Claude lit la photo, on recolle sa réponse
- ✨ **Créer avec Claude** : un mode d'emploi exportable apprend à Claude le format d'import de l'appli
- ☁️ **Base commune optionnelle** : par défaut chaque téléphone a ses données ; en branchant une base Supabase gratuite, toute la famille partage la même bible et la même liste de courses
- 💾 Export JSON des données en un bouton

## Lancer en local

Aucune dépendance, aucun build :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

(ou `npx serve`, ou n'importe quel serveur statique — un `file://` ne marche
pas, les modules ES ont besoin du HTTP)

## Publier sur GitHub Pages

Dans le dépôt : **Settings → Pages → Source : Deploy from a branch**, branche
`main`, dossier `/ (root)`. Une minute plus tard le site est en ligne sur
`https://valentindrouet-dev.github.io/hellomiam/`.

Sur le téléphone :

- **iPhone (Safari)** : ouvrir l'URL → Partager → « Sur l'écran d'accueil »
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → « Installer l'application »

## Base de données commune (facultatif)

Par défaut, les données vivent dans le `localStorage` du navigateur : parfait
pour un usage perso, mais chaque téléphone a sa propre bible.

Pour que **toute la famille partage les mêmes recettes**, l'appli sait parler à
une base [Supabase](https://supabase.com) gratuite. Dans l'appli :
**Ajouter → Base commune**, puis suivre les deux étapes affichées (créer le
projet + coller le script SQL fourni, puis coller l'URL et la clé `anon`).
À la première connexion, les recettes déjà présentes sur le téléphone sont
envoyées dans la base si elle est vide.

Les clés restent dans le `localStorage` de chaque appareil : **rien n'est
jamais écrit dans ce dépôt public**.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille de l'app |
| `styles.css` | Tout le design (pastel clair) |
| `app.js` | Écrans, navigation, interactions |
| `lib/store.js` | Données : mode local (localStorage) ou base commune (Supabase) |
| `lib/seed.js` | Recettes d'exemple + base de prix Carrefour |
| `lib/portions.js` | Facteur adultes/enfants (⅔) et mise à l'échelle |
| `lib/units.js` | Unités, conversions, arrondis « cuisine » |
| `lib/aggregate.js` | Fusion des ingrédients de plusieurs recettes |
| `lib/pricing.js` | Correspondance produit → prix, paquets vs vrac, total |
| `lib/normalize.js` | Normalisation des noms (accents, pluriels) |
| `lib/validate.js` | Validation et import tolérant du JSON |
| `lib/claudePrompts.js` | Prompts prêts à coller dans claude.ai |
| `sw.js` | Service worker (hors-ligne) |
| `scripts/gen-icons.mjs` | Génère les icônes PWA (`npm run icons`) |

## Tests

Toute la logique de calcul est testée (portions, conversions, fusion des
listes, estimation des prix, magasin de données) :

```bash
npm test    # 41 tests, node --test, aucune dépendance
```

## Format d'import (celui qu'on apprend à Claude)

```json
{
  "recipes": [
    {
      "title": "Curry de pois chiches express",
      "category": "claude",
      "servings": 3,
      "prepMin": 10,
      "cookMin": 20,
      "notes": "facultatif",
      "ingredients": [
        { "name": "Pois chiches", "qty": 1, "unit": "boîte", "dept": "epicerie" },
        { "name": "Sel", "qty": null, "unit": null, "dept": "epicerie" }
      ],
      "steps": ["Étape 1…", "Étape 2…"]
    }
  ]
}
```

- `category` : `hellofresh` · `perso` · `resto` · `claude`
- `unit` : `g` `kg` `ml` `cl` `l` `pièce` `c. à soupe` `c. à café` `gousse` `pincée` `botte` `sachet` `tranche` `boîte` `pot` `cube` — ou `null`
- `dept` : `fruits-legumes` `boucherie` `poissonnerie` `cremerie` `epicerie` `epicerie-sucree` `boulangerie` `surgeles` `boissons` `autres`

Le prompt complet est copiable depuis l'appli : **Ajouter → Scanner une
recette** ou **Demander à Claude**.

## À propos des prix

Carrefour n'a pas d'API publique de prix : l'appli embarque ~160 prix de
référence réalistes, affichés comme **estimations**. Un `~` signale une
estimation approximative (unités non comparables, « selon goût », poids moyen
d'une pièce). Chaque prix se corrige en deux tapes depuis la liste de courses.

## Pistes d'amélioration

- Photos stockées dans Supabase Storage plutôt qu'en data-URL
- Planificateur de menus de la semaine
- Minuteurs intégrés au mode cuisine
- Import direct depuis une URL de recette
