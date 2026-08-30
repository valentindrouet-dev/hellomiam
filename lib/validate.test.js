import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRecipe, parseImportText, cleanPhoto } from './validate.js'

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

test('photo : lien https ou image intégrée, rien d’autre', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  const lien = 'https://images.example.com/tarte.jpg?w=800'
  assert.equal(validateRecipe({ ...valid, photo: dataUrl }).recipe.photo, dataUrl)
  assert.equal(validateRecipe({ ...valid, photo: lien }).recipe.photo, lien)

  // http en clair : bloqué de toute façon depuis une page https.
  assert.equal(validateRecipe({ ...valid, photo: 'http://exemple.fr/x.jpg' }).recipe.photo, null)
  // Restes de l'ancienne version à serveur.
  assert.equal(validateRecipe({ ...valid, photo: '/uploads/abc.jpg' }).recipe.photo, null)
})

test('photo : les schémas dangereux sont refusés', () => {
  for (const mauvais of [
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'https://x.fr/a.jpg" onerror="alert(1)',
    'blob:https://exemple.fr/1234',
  ]) {
    assert.equal(validateRecipe({ ...valid, photo: mauvais }).recipe.photo, null, mauvais)
  }
})

test('sous-catégorie, tags et ajustements nettoyés', () => {
  const { recipe } = validateRecipe({
    ...valid,
    category: 'resto',
    sub: '   Chez   Marcel  ',
    tags: ['Plancha', 'plancha', '  ÉTÉ  ', ''],
    tagsOff: ['four'],
    swaps: {
      'Pommes': null,
      'pate brisee': { name: 'Pâte feuilletée', qty: '1', unit: 'pièce', dept: 'cremerie' },
      'ingredient absent': null,
    },
  })
  assert.equal(recipe.sub, 'Chez Marcel')
  assert.deepEqual(recipe.tags, ['plancha', 'été'])
  assert.deepEqual(recipe.tagsOff, ['four'])
  assert.equal(recipe.swaps.pomme, null)
  assert.deepEqual(recipe.swaps['pate brisee'], { name: 'Pâte feuilletée', qty: 1, unit: 'pièce', dept: 'cremerie' })
  assert.equal('ingredient absent' in recipe.swaps, false, 'clé orpheline retirée')
})

test('valeurs par défaut des nouveaux champs', () => {
  const { recipe } = validateRecipe(valid)
  assert.equal(recipe.sub, null)
  assert.deepEqual(recipe.tags, [])
  assert.deepEqual(recipe.tagsOff, [])
  assert.deepEqual(recipe.swaps, {})
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

test('cleanPhoto accepte les formats d’image courants', () => {
  for (const type of ['jpeg', 'png', 'webp', 'gif', 'avif']) {
    assert.equal(cleanPhoto(`data:image/${type};base64,AAAA`), `data:image/${type};base64,AAAA`)
  }
  assert.equal(cleanPhoto('  https://exemple.fr/a.jpg  '), 'https://exemple.fr/a.jpg', 'espaces retirés')
  assert.equal(cleanPhoto(''), null)
  assert.equal(cleanPhoto(undefined), null)
})

test('import : la prose autour du JSON ne gêne pas', () => {
  const recette = '{"title":"Tarte","ingredients":[{"name":"Pomme","qty":4}],"steps":["Cuire."]}'

  // Le cas qui cassait : une phrase finale contenant des crochets.
  const avecCrochets = parseImportText(`Voici la recette :\n${recette}\nTu peux l'importer [dans l'appli].`)
  assert.equal(avecCrochets.error, null)
  assert.equal(avecCrochets.recipes[0].title, 'Tarte')

  // Accolade à l'intérieur d'une chaîne : ne doit pas fausser le comptage.
  const piege = parseImportText('{"title":"Riz } piégé","ingredients":[{"name":"Riz"}],"steps":["a"]}')
  assert.equal(piege.recipes[0].title, 'Riz } piégé')

  // Bloc balisé suivi de texte contenant un tableau vide.
  const balise = parseImportText('```json\n{"recipes":[' + recette + ']}\n```\nVoilà, rien d’autre []')
  assert.equal(balise.recipes.length, 1)
})

test('import : un JSON sans rapport est ignoré au profit de la recette', () => {
  const texte = `配置 : {"theme":"dark","size":3}

Et la recette :
{"title":"Soupe","ingredients":[{"name":"Courge"}],"steps":["Mixer."]}`
  const { recipes, error } = parseImportText(texte)
  assert.equal(error, null)
  assert.equal(recipes.length, 1)
  assert.equal(recipes[0].title, 'Soupe')
})

test('import : plusieurs recettes dans un tableau', () => {
  const { recipes } = parseImportText(
    '[{"title":"A","ingredients":[{"name":"x"}],"steps":["s"]},{"title":"B","ingredients":[{"name":"y"}],"steps":["s"]}]'
  )
  assert.equal(recipes.length, 2)
})
