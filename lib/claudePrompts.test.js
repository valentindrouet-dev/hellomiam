import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScanPrompt, buildCreatePrompt } from './claudePrompts.js'
import { validateRecipe, parseImportText } from './validate.js'
import { CATEGORY_IDS, DEPT_IDS, RECIPE_UNITS } from './constants.js'

const scan = buildScanPrompt('hellofresh')
const create = buildCreatePrompt()

// Le piège de ce genre de prompt : il se désynchronise en silence du code, et
// Claude produit alors des recettes que l'appli refuse. Ces tests bloquent la
// dérive.

test('l’exemple donné à Claude passe la validation de l’appli', () => {
  const { recipes, error } = parseImportText(scan)
  assert.equal(error, null, 'le bloc JSON du prompt doit être analysable')
  assert.equal(recipes.length, 1)

  const { recipe, errors } = validateRecipe(recipes[0])
  assert.deepEqual(errors, [], 'l’exemple doit être une recette valide')
  assert.equal(recipe.category, 'hellofresh')
  assert.equal(recipe.sub, 'Le Petit Vietnamien')
  assert.equal(recipe.photo, 'https://exemple.com/photo.jpg', 'le lien photo de l’exemple doit être accepté')
  assert.deepEqual(recipe.tags, ['été', 'favori'])
  assert.ok(recipe.ingredients.length >= 2)
})

test('toutes les catégories acceptées sont expliquées à Claude', () => {
  for (const id of CATEGORY_IDS) {
    assert.ok(scan.includes(`"${id}"`), `catégorie ${id} absente du prompt`)
  }
})

test('tous les rayons et unités acceptés sont listés', () => {
  for (const dept of DEPT_IDS) {
    assert.ok(scan.includes(`"${dept}"`), `rayon ${dept} absent du prompt`)
  }
  for (const unit of RECIPE_UNITS) {
    assert.ok(scan.includes(`"${unit}"`), `unité ${unit} absente du prompt`)
  }
})

test('le prompt interdit les sachets, qui ne se dosent pas', () => {
  assert.ok(/JAMAIS "sachet"/.test(scan), 'la consigne sur les sachets manque')
  assert.ok(/cuillères/.test(scan))
  // « sachet » ne doit pas figurer dans la liste des unités autorisées.
  const ligneUnites = scan.split('\n').find(l => l.startsWith('- "unit"'))
  assert.ok(!ligneUnites.includes('"sachet"'), 'sachet encore proposé comme unité')
})

test('le prompt de scan suit ce que dit l’utilisateur plutôt que le bouton', () => {
  assert.ok(/hellofresh/i.test(scan))
  assert.ok(/HelloFresh/.test(scan), 'le mot que l’utilisateur emploie doit apparaître')
  assert.ok(/prime|à la place|suis cette indication/i.test(scan), 'la consigne doit dire que l’utilisateur prime')
  // Le défaut suit bien le bouton choisi dans l’appli.
  assert.ok(buildScanPrompt('resto').includes('"category": "resto"'))
})

test('la consigne photo exige https et interdit d’inventer un lien', () => {
  for (const prompt of [scan, create]) {
    assert.ok(prompt.includes('"photo"'), 'champ photo absent')
    assert.ok(prompt.includes('https://'), 'exigence https absente')
    assert.ok(/n.invente JAMAIS une URL/i.test(prompt), 'garde-fou contre les liens inventés absent')
  }
})

test('un retour typique de Claude s’importe tel quel', () => {
  // Ce que Claude renvoie quand on lui dit « c'est du HelloFresh » et qu'on
  // lui donne le lien de la photo.
  const reponse = `Voici la recette :

\`\`\`json
{
  "recipes": [
    {
      "title": "Bœuf haché et sauce tomate",
      "category": "hellofresh",
      "sub": null,
      "servings": 2,
      "prepMin": 10,
      "cookMin": 20,
      "photo": "https://cdn.hellofresh.com/plat-1234.jpg",
      "notes": null,
      "tags": [],
      "ingredients": [
        { "name": "Bœuf haché", "qty": 250, "unit": "g", "dept": "boucherie" },
        { "name": "Sel", "qty": null, "unit": null, "dept": "epicerie" }
      ],
      "steps": ["Faire revenir la viande 5 min.", "Ajouter la sauce et mijoter 10 min."]
    }
  ]
}
\`\`\`

Bon appétit !`

  const { recipes, error } = parseImportText(reponse)
  assert.equal(error, null)
  const { recipe, errors } = validateRecipe(recipes[0])
  assert.deepEqual(errors, [])
  assert.equal(recipe.category, 'hellofresh', 'la catégorie annoncée est conservée')
  assert.equal(recipe.photo, 'https://cdn.hellofresh.com/plat-1234.jpg', 'le lien photo est conservé')
})

test('le prompt de création part sur « claude » mais accepte une autre origine', () => {
  assert.ok(create.includes('"category": "claude"'))
  assert.ok(/HelloFresh|restaurant/i.test(create))
})
