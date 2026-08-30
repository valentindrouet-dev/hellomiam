// Un enfant compte pour les deux tiers d'une portion adulte.
export const CHILD_RATIO = 2 / 3

export const CATEGORIES = [
  { id: 'hellofresh', label: 'Hello Fresh', emoji: '🥗' },
  { id: 'perso', label: 'Personnelles', emoji: '🏠' },
  { id: 'resto', label: 'Restaurants', emoji: '🍽️' },
  { id: 'claude', label: 'Claude', emoji: '✨' },
]

export const DEPTS = [
  { id: 'fruits-legumes', label: 'Fruits & Légumes', emoji: '🥬' },
  { id: 'boucherie', label: 'Boucherie & Volaille', emoji: '🥩' },
  { id: 'poissonnerie', label: 'Poissonnerie', emoji: '🐟' },
  { id: 'cremerie', label: 'Crèmerie & Œufs', emoji: '🧀' },
  { id: 'epicerie', label: 'Épicerie salée', emoji: '🫙' },
  { id: 'epicerie-sucree', label: 'Épicerie sucrée', emoji: '🍫' },
  { id: 'boulangerie', label: 'Boulangerie', emoji: '🥖' },
  { id: 'surgeles', label: 'Surgelés', emoji: '🧊' },
  { id: 'boissons', label: 'Boissons', emoji: '🥤' },
  { id: 'autres', label: 'Autres', emoji: '🧺' },
]

export const DEPT_IDS = DEPTS.map(d => d.id)
export const CATEGORY_IDS = CATEGORIES.map(c => c.id)

export function deptInfo(id) {
  return DEPTS.find(d => d.id === id) || DEPTS[DEPTS.length - 1]
}

export function categoryInfo(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[1]
}

// Unités proposées dans les formulaires (toute autre unité libre reste acceptée).
export const UNITS = [
  'g', 'kg', 'ml', 'cl', 'l',
  'pièce', 'c. à soupe', 'c. à café',
  'gousse', 'pincée', 'botte', 'sachet', 'tranche', 'boîte', 'pot', 'cube', 'branche',
]
