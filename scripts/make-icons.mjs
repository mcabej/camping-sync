// The app icon is the same tent that sits in the favicon, drawn once here and
// baked into PNGs because that is the only format a home screen will take.
// Everything is done by hand — a PNG is a zlib stream with a checksum, and a
// tent is two triangles — so adding an image library to draw three shapes would
// cost more than it saves.
//
//   node scripts/make-icons.mjs
//
// Re-run it if the mark or the brand colours change; commit what it writes.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'icons')

// ---- png --------------------------------------------------------------------

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// Truecolour with alpha, no interlacing, and filter 0 on every row: the shapes
// are flat, so the filters that help photographs would only cost cycles.
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const stride = size * 4
  const raw = Buffer.alloc(size * (stride + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- the mark ---------------------------------------------------------------

const FOREST = [0x1b, 0x38, 0x2e]
const CANVAS = [0xe9, 0xed, 0xe6]

// Drawn in the favicon's 32-unit box so the two can never drift apart.
const TENT = [16, 6, 6, 26, 26, 26]
const DOOR = [16, 14, 11, 26, 21, 26]

const inRoundRect = (x, y, r) => {
  const dx = x - Math.min(Math.max(x, r), 32 - r)
  const dy = y - Math.min(Math.max(y, r), 32 - r)
  return dx * dx + dy * dy <= r * r
}

const inTri = (x, y, [ax, ay, bx, by, cx, cy]) => {
  const s = (px, py, qx, qy) => (qx - px) * (y - py) - (qy - py) * (x - px)
  const d = [s(ax, ay, bx, by), s(bx, by, cx, cy), s(cx, cy, ax, ay)]
  return d.every((v) => v >= 0) || d.every((v) => v <= 0)
}

// `radius` rounds the plate (0 leaves it square, for the platforms that cut
// their own shape out of it) and `logo` shrinks the tent about the centre to
// clear a mask's safe zone.
function colourAt(x, y, { radius, logo }) {
  let colour = inRoundRect(x, y, radius) ? FOREST : null
  const lx = (x - 16) / logo + 16
  const ly = (y - 16) / logo + 16
  if (inTri(lx, ly, TENT)) colour = CANVAS
  if (inTri(lx, ly, DOOR)) colour = FOREST
  return colour
}

// Sixteen samples a pixel. There is no curve here steep enough to need more,
// and the corners are the only place it shows at all.
const SUB = 4

function render(size, opts) {
  const rgba = Buffer.alloc(size * size * 4)
  const unit = 32 / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const c = colourAt((px + (sx + 0.5) / SUB) * unit, (py + (sy + 0.5) / SUB) * unit, opts)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a++
        }
      }
      const i = (py * size + px) * 4
      if (!a) continue
      // Averaged over the samples that landed on the shape, not over all of
      // them, so an edge pixel keeps its colour and only loses opacity.
      rgba[i] = Math.round(r / a)
      rgba[i + 1] = Math.round(g / a)
      rgba[i + 2] = Math.round(b / a)
      rgba[i + 3] = Math.round((a / (SUB * SUB)) * 255)
    }
  }
  return png(size, rgba)
}

// `any` keeps the rounded plate and the transparent corners, because that icon
// is shown as drawn. `maskable` gives the whole square away to the launcher and
// pulls the tent into the middle 60%, which survives a circle. Apple crops to
// its own squircle and never uses transparency, so that one is square too.
const ICONS = [
  ['icon-192.png', 192, { radius: 7, logo: 1 }],
  ['icon-512.png', 512, { radius: 7, logo: 1 }],
  ['maskable-192.png', 192, { radius: 0, logo: 0.6 }],
  ['maskable-512.png', 512, { radius: 0, logo: 0.6 }],
  ['apple-touch-icon.png', 180, { radius: 0, logo: 0.78 }],
]

mkdirSync(OUT, { recursive: true })
for (const [name, size, opts] of ICONS) {
  const bytes = render(size, opts)
  writeFileSync(join(OUT, name), bytes)
  console.log(`${name.padEnd(22)} ${size}×${size}  ${(bytes.length / 1024).toFixed(1)} kB`)
}
