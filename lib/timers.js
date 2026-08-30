// Chronomètres de cuisson.
//
// Plusieurs minuteurs tournent en parallèle (le riz pendant que la sauce
// mijote). Chacun mémorise une date de fin absolue plutôt qu'un décompte :
// l'appli peut être fermée, mise en veille ou rechargée, le temps continue
// de s'écouler correctement.

const LS_TIMERS = 'hellomiam.timers.v1'

// ——— Détection des durées dans le texte d'une étape ————————————————

const NUM = '(\\d+(?:[.,]\\d+)?)'

// « 12 min », « 1 h 15 », « 1h30 », « 2 heures », « 45 secondes », « 4 à 5 min »
const PATTERNS = [
  // heures + minutes : 1 h 15, 1h30
  { re: new RegExp(`${NUM}\\s*h(?:eures?)?\\s*${NUM}\\b`, 'gi'), seconds: m => num(m[1]) * 3600 + num(m[2]) * 60 },
  // heures seules : 2 h, 1 heure
  { re: new RegExp(`${NUM}\\s*h(?:eures?)?\\b(?!\\s*\\d)`, 'gi'), seconds: m => num(m[1]) * 3600 },
  // fourchette : 4 à 5 min, 4-5 minutes → on retient la borne basse
  { re: new RegExp(`${NUM}\\s*(?:a|à|-|–)\\s*${NUM}\\s*(?:min|mn|minutes?)\\b`, 'gi'), seconds: m => num(m[1]) * 60 },
  // minutes : 12 min, 12 minutes
  { re: new RegExp(`${NUM}\\s*(?:min|mn|minutes?)\\b`, 'gi'), seconds: m => num(m[1]) * 60 },
  // secondes : 30 s, 45 secondes
  { re: new RegExp(`${NUM}\\s*(?:secondes?|sec|s)\\b`, 'gi'), seconds: m => num(m[1]) },
]

function num(s) {
  return Number(String(s).replace(',', '.'))
}

// Renvoie les durées trouvées dans un texte, sans doublon, dans l'ordre.
// [{ seconds, label }]
export function parseDurations(text) {
  const src = String(text ?? '')
  const found = []
  const taken = [] // plages déjà consommées, pour ne pas compter « 1 h 15 » deux fois

  for (const { re, seconds } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) {
      const start = m.index
      const end = m.index + m[0].length
      if (taken.some(([s, e]) => start < e && end > s)) continue
      const secs = Math.round(seconds(m))
      if (!Number.isFinite(secs) || secs <= 0 || secs > 24 * 3600) continue
      taken.push([start, end])
      found.push({ seconds: secs, label: formatDuration(secs), at: start })
    }
  }

  return found
    .sort((a, b) => a.at - b.at)
    .filter((d, i, arr) => arr.findIndex(o => o.seconds === d.seconds) === i)
    .map(({ seconds, label }) => ({ seconds, label }))
}

// 90 → « 1 min 30 », 3600 → « 1 h », 5400 → « 1 h 30 »
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
  if (m) return sec ? `${m} min ${String(sec).padStart(2, '0')}` : `${m} min`
  return `${sec} s`
}

// Décompte affiché : toujours mm:ss (ou h:mm:ss au-delà de l'heure).
export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// ——— Minuteurs en cours ————————————————————————————————————————

let nextId = 1

export class Timers {
  constructor() {
    this.list = []
    this.load()
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_TIMERS))
      if (Array.isArray(raw)) {
        this.list = raw.filter(t => t && typeof t.endsAt === 'number')
        nextId = Math.max(1, ...this.list.map(t => Number(t.id) || 0)) + 1
      }
    } catch { this.list = [] }
  }

  save() {
    try {
      localStorage.setItem(LS_TIMERS, JSON.stringify(this.list))
    } catch { /* stockage plein : les minuteurs restent en mémoire */ }
  }

  add(label, seconds, context = '') {
    const timer = {
      id: String(nextId++),
      label: label || formatDuration(seconds),
      context,
      duration: seconds,
      endsAt: Date.now() + seconds * 1000,
      rang: false,
    }
    this.list.push(timer)
    this.save()
    return timer
  }

  remove(id) {
    this.list = this.list.filter(t => t.id !== id)
    this.save()
  }

  clearFinished() {
    this.list = this.list.filter(t => this.remaining(t) > 0)
    this.save()
  }

  clearAll() {
    this.list = []
    this.save()
  }

  // Ajoute (ou retire, avec un delta négatif) du temps à un minuteur en cours.
  addTime(id, seconds) {
    const t = this.list.find(x => x.id === id)
    if (!t) return
    t.endsAt = Math.max(Date.now(), t.endsAt + seconds * 1000)
    t.duration = Math.max(0, t.duration + seconds)
    if (this.remaining(t) > 0) t.rang = false
    this.save()
  }

  remaining(timer) {
    return timer.endsAt - Date.now()
  }

  get running() {
    return this.list.filter(t => this.remaining(t) > 0)
  }

  get finished() {
    return this.list.filter(t => this.remaining(t) <= 0)
  }

  // Minuteurs arrivés à échéance et pas encore signalés (sonnerie, vibration).
  takeNewlyFinished() {
    const due = this.list.filter(t => this.remaining(t) <= 0 && !t.rang)
    if (due.length) {
      for (const t of due) t.rang = true
      this.save()
    }
    return due
  }
}
