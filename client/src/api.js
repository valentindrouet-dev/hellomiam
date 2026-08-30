// Client API : toutes les données vivent dans la base commune côté serveur.
// Si le serveur est protégé par un code d'accès (APP_KEY), il est demandé une
// fois puis mémorisé sur l'appareil.

const KEY_STORAGE = 'hellomiam:key'

export function getStoredKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function storeKey(key) {
  try {
    localStorage.setItem(KEY_STORAGE, key)
  } catch { /* mode privé : tant pis, le code sera redemandé */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function call(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const key = getStoredKey()
  if (key) headers['X-App-Key'] = key

  let res
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('Pas de connexion — réessaie quand tu as du réseau', 0)
  }
  let data = null
  try {
    data = await res.json()
  } catch { /* réponse vide */ }
  if (!res.ok) throw new ApiError(data?.error || `Erreur ${res.status}`, res.status)
  return data
}

export const api = {
  health: () => call('GET', '/api/health'),
  all: () => call('GET', '/api/all'),

  createRecipe: recipe => call('POST', '/api/recipes', recipe),
  updateRecipe: (id, recipe) => call('PUT', `/api/recipes/${id}`, recipe),
  deleteRecipe: id => call('DELETE', `/api/recipes/${id}`),
  importRecipes: recipes => call('POST', '/api/import', { recipes }),
  upload: dataUrl => call('POST', '/api/upload', { dataUrl }),

  upsertPrice: price => call('POST', '/api/prices', price),

  setCartRecipe: (recipeId, adults, children) => call('PUT', `/api/cart/recipes/${recipeId}`, { adults, children }),
  removeCartRecipe: recipeId => call('DELETE', `/api/cart/recipes/${recipeId}`),
  clearCart: () => call('DELETE', '/api/cart'),
  addExtra: extra => call('POST', '/api/cart/extras', extra),
  updateExtra: (id, fields) => call('PUT', `/api/cart/extras/${id}`, fields),
  deleteExtra: id => call('DELETE', `/api/cart/extras/${id}`),
  setChecked: (key, checked) => call('PUT', '/api/cart/checked', { key, checked }),
}

// Réduit une photo côté client avant envoi (max 1280 px, JPEG ~82 %).
export function shrinkImage(file, maxSize = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Photo illisible'))
    }
    img.src = url
  })
}
