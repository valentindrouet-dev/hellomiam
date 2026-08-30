import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRecipe, parseImportText } from './validate.js'

const valid = {
  title: 'Tarte aux pommes',
  category: 'perso',
  servings: 6,
  prepMin: 20,
  cookMin: 40,
  ingredients: [
    { name: 'Pommes', qty: 4, unit: 'pièce', dept: 'fruits-legumes' },
    { name: 'Pâte brisée', qty: 1, unit: 'pièce', dept: 'cremerie' },
  ],
  steps: ['Étaler la pâte.', 'Ajouter les pommes.', 'Cuire 40 min.'],
}

test('recette valide acceptée telle quelle', () => {
  const { recipe, errors } = validateRecipe(valid)
  assert.deepEqual(errors, [])
  assert.equal(recipe.title, 'Tarte aux pommes')
  assert.equal(recipe.servings, 6)
  assert.equal(recipe.ingredients.length, 2)
})

test('valeurs douteuses nettoyées sans bloquer', () => {
  const { recipe, errors } = validateRecipe({
    ...valid,
    category: 'nimporte-quoi',
    servings: '4',
    ingredients: [
      { name: '  Sucre ', qty: '0,5', unit: 'kg', dept: 'rayon-inconnu' },
      { name: '', qty: 1 },
      { name: 'Sel', qty: -2, unit: null },
    ],
  })
  assert.deepEqual(errors, [])
  assert.equal(recipe.category, 'perso')
  assert.equal(recipe.servings, 4)
  assert.equal(recipe.ingredients.length, 2)
  assert.equal(recipe.ingredients[0].qty, 0.5)
  assert.equal(recipe.ingredients[0].dept, 'autres')
  assert.equal(recipe.ingredients[1].qty, null)
})

test('titre, ingrédients et étapes obligatoires', () => {
  const { errors } = validateRecipe({ title: '', ingredients: [], steps: [] })
  assert.equal(errors.length, 3)
})

test('les photos extérieures sont écartées', () => {
  const ok = validateRecipe({ ...valid, photo: '/uploads/abc.jpg' })
  assert.equal(ok.recipe.photo, '/uploads/abc.jpg')
  const ko = validateRecipe({ ...valid, photo: 'https://ailleurs.example/x.jpg' })
  assert.equal(ko.recipe.photo, null)
})

test('parseImportText : JSON nu, enveloppé, ou entouré de texte', () => {
  const one = parseImportText(JSON.stringify(valid))
  assert.equal(one.recipes.length, 1)

  const wrapped = parseImportText(JSON.stringify({ recipes: [valid, valid] }))
  assert.equal(wrapped.recipes.length, 2)

  const fenced = parseImportText('Voici la recette :\n```json\n' + JSON.stringify([valid]) + '\n```\nBon appétit !')
  assert.equal(fenced.recipes.length, 1)

  const chatty = parseImportText('Bien sûr ! ' + JSON.stringify(valid) + ' Et voilà.')
  assert.equal(chatty.recipes.length, 1)

  const bad = parseImportText('pas du json')
  assert.ok(bad.error)
})
