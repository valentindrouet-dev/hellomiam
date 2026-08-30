// Génère les icônes PWA de HelloMiam (bol fumant sur fond crème) en PNG,
// sans aucune dépendance : dessin par champs de distance + encodeur PNG minimal.
// Usage : node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons')
fs.mkdirSync(OUT, { recursive: true })

// --- Encodeur PNG (RGBA 8 bits) ---------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}

function writePng(file, size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtre "none"
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(file, png)
  console.log(`✔ ${path.relative(process.cwd(), file)} (${size}×${size})`)
}

// --- Champs de distance ------------------------------------------------------

const clamp01 = v => Math.max(0, Math.min(1, v))

function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - hw + r
  const dy = Math.abs(y - cy) - hh + r
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r
}

function sdSegment(x, y, ax, ay, bx, by, r) {
  const pax = x - ax
  const pay = y - ay
  const bax = bx - ax
  const bay = by - ay
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h) - r
}

// --- Dessin de l'icône -------------------------------------------------------

const HEX = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const CREAM_TOP = HEX('#FDF4E5')
const CREAM_BOT = HEX('#F7E6CE')
const SAGE = HEX('#4E9B72')
const SAGE_DARK = HEX('#3D7E5B')
const CORAL = HEX('#E8825E')

function drawIcon(size, { rounded, safeZone }) {
  const img = Buffer.alloc(size * size * 4)
  const S = size
  const px = 1 / S
  // En mode "maskable", tout est resserré vers le centre (zone sûre 80 %).
  const k = safeZone ? 0.82 : 1
  const T = v => 0.5 + (v - 0.5) * k

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S
      const v = (y + 0.5) / S

      // Fond crème en léger dégradé vertical
      let r = CREAM_TOP[0] + (CREAM_BOT[0] - CREAM_TOP[0]) * v
      let g = CREAM_TOP[1] + (CREAM_BOT[1] - CREAM_TOP[1]) * v
      let b = CREAM_TOP[2] + (CREAM_BOT[2] - CREAM_TOP[2]) * v
      let a = 1

      if (rounded) {
        const d = sdRoundRect(u, v, 0.5, 0.5, 0.48, 0.48, 0.22)
        a = clamp01(0.5 - d / px)
      }

      const paint = (d, color) => {
        const cov = clamp01(0.5 - d / px)
        if (cov > 0) {
          r = r + (color[0] - r) * cov
          g = g + (color[1] - g) * cov
          b = b + (color[2] - b) * cov
        }
      }

      // Bol : moitié basse d'un disque + pied
      const bowlD = Math.max(sdCircle(u, v, T(0.5), T(0.5), 0.3 * k), T(0.5) - v)
      paint(bowlD, SAGE)
      paint(sdSegment(u, v, T(0.42), T(0.84), T(0.58), T(0.84), 0.028 * k), SAGE_DARK)
      // Bord du bol
      paint(sdSegment(u, v, T(0.185), T(0.5), T(0.815), T(0.5), 0.038 * k), SAGE_DARK)
      // Vapeur : deux volutes corail
      paint(sdSegment(u, v, T(0.40), T(0.36), T(0.365), T(0.20), 0.028 * k), CORAL)
      paint(sdSegment(u, v, T(0.60), T(0.36), T(0.635), T(0.20), 0.028 * k), CORAL)
      paint(sdSegment(u, v, T(0.50), T(0.33), T(0.50), T(0.14), 0.028 * k), CORAL)

      const i = (y * S + x) * 4
      img[i] = Math.round(r)
      img[i + 1] = Math.round(g)
      img[i + 2] = Math.round(b)
      img[i + 3] = Math.round(a * 255)
    }
  }
  return img
}

writePng(path.join(OUT, 'icon-192.png'), 192, drawIcon(192, { rounded: true }))
writePng(path.join(OUT, 'icon-512.png'), 512, drawIcon(512, { rounded: true }))
writePng(path.join(OUT, 'maskable-512.png'), 512, drawIcon(512, { rounded: false, safeZone: true }))
writePng(path.join(OUT, 'apple-touch-icon.png'), 180, drawIcon(180, { rounded: false }))
