# 🍲 HelloMiam

La bible familiale des recettes de cuisine, avec listes de courses intelligentes.
Une PWA mobile (installable sur l'écran d'accueil) + un petit serveur qui héberge
la **base de données commune à toute la famille** : recettes, prix de référence
et liste de courses partagée.

## Fonctionnalités

- 📖 **Recettes** classées en 4 catégories : Hello Fresh, Personnelles, Restaurants, Claude — avec recherche par plat ou ingrédient.
- 👨‍👩‍👧 **Portions adultes + enfants** : un enfant compte pour ⅔ d'un adulte, toutes les quantités se recalculent en direct.
- 🍳 **Mode cuisine** plein écran : une étape à la fois, gros texte, l'écran ne s'éteint pas, navigation au doigt.
- 🛒 **Courses intelligentes** : sélectionne plusieurs recettes (chacune avec son nombre de convives), les ingrédients sont fusionnés (g + kg, cuillères + cl…), regroupés par rayon, avec les quantités réellement à acheter (paquets entiers ou vrac au poids) et un **total estimé sur des prix indicatifs Carrefour** — corrigeables dans l'appli, pour tout le monde.
- 📷 **Scan de recettes via claude.ai** (gratuit, sans clé API) : l'appli prépare un prompt, tu le colles avec ta photo dans Claude, tu réimportes le JSON généré.
- ✨ **Création par Claude** : un « mode d'emploi » exportable apprend à Claude le format d'import de l'appli.
- 📡 **Hors-ligne** : les dernières recettes consultées restent lisibles sans réseau.
- 🔐 **Code d'accès optionnel** pour protéger la base familiale.

## Structure

```
client/   PWA React + Vite (interface, logique portions/agrégation/prix + tests)
server/   API Express + SQLite (recettes, prix, panier partagé, photos)
scripts/  dev.mjs (lancement dev), gen-icons.mjs (icônes PWA)
```

La logique métier (conversions d'unités, facteur enfants, fusion des listes,
estimation des prix) vit dans `client/src/lib/` en modules purs, testés avec
`node --test`, et le serveur réutilise la même validation.

## Démarrer en local

```bash
npm install
npm run dev        # serveur sur :3000 + client Vite sur :5173
npm test           # tests logique métier + base de données
```

Ouvre http://localhost:5173. Au premier démarrage, la base est créée dans
`server/data/` avec 4 recettes d'exemple et ~150 prix de référence.

## Déployer (base commune en ligne)

Le serveur sert aussi le client compilé : **un seul service à déployer**.

### Option A — Railway / Render / Fly.io (recommandé, gratuit pour cet usage)

1. Pousse ce dépôt sur GitHub, puis crée un service depuis le dépôt :
   - **Railway** : « New Project → Deploy from GitHub repo ». Le `Dockerfile` est détecté tout seul.
   - **Render** : « New → Web Service », environnement **Docker**.
   - **Fly.io** : `fly launch` (le Dockerfile est utilisé).
2. **Monte un volume persistant sur `/data`** (c'est là que vivent la base SQLite et les photos) :
   - Railway : onglet Volumes → Mount path `/data`.
   - Render : « Disks » → Mount path `/data`.
   - Fly : `fly volumes create data` puis `[mounts] source="data" destination="/data"`.
3. Variables d'environnement (facultatif) :
   - `APP_KEY=tonCodeSecret` → l'appli demandera ce code à la première ouverture.
4. Ouvre l'URL du service sur ton téléphone → menu du navigateur → **« Ajouter à l'écran d'accueil »**. C'est installé 🎉

### Option B — Docker n'importe où (VPS, NAS, Raspberry Pi)

```bash
docker build -t hellomiam .
docker run -d --name hellomiam -p 3000:3000 -v hellomiam-data:/data \
  -e APP_KEY=tonCodeSecret hellomiam
```

### Sans Docker

```bash
npm ci && npm run build
DATA_DIR=/chemin/vers/data APP_KEY=tonCodeSecret node server/src/index.js
```

| Variable   | Défaut         | Rôle                                              |
| ---------- | -------------- | ------------------------------------------------- |
| `PORT`     | `3000`         | Port HTTP                                         |
| `DATA_DIR` | `server/data`  | Dossier de la base SQLite et des photos           |
| `APP_KEY`  | *(vide)*       | Si défini : code d'accès demandé par l'appli      |

## Le format d'import (celui qu'on apprend à Claude)

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

Le prompt complet (avec ces règles) est copiable directement depuis l'appli :
onglet **Ajouter → Scanner une recette** ou **Demander à Claude**.

## À propos des prix

Carrefour n'expose pas d'API publique de prix : l'appli embarque donc une base
de ~150 prix de référence réalistes (ordres de grandeur Carrefour France),
clairement affichés comme **estimations**. Chaque prix se corrige en deux tapes
depuis la liste de courses, et la correction profite à toute la famille.
Le `~` devant un prix signale une estimation approximative (unités non
comparables, « selon goût », poids moyen d'une pièce…).
