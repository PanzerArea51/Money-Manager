// Generates the PWA icons into public/icons. Run manually: node scripts/generate-icons.mjs
// Not part of `npm run build`. No dependencies beyond node built-ins.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BLUE = [0x1a, 0x56, 0xc4]
const WHITE = [255, 255, 255]
const SUBSAMPLES = 3 // 3x3 supersampling for smooth edges

// ---- PNG encoder ----
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- Drawing ----
// Returns [r, g, b, a] (a in 0..1) for a point in unit coordinates (0..1).
function sample(u, v, { rounded, coinRadius }) {
  if (rounded) {
    const radius = 0.22
    const dx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0)
    const dy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0)
    if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0]
  }
  const d = Math.hypot(u - 0.5, v - 0.5)
  if (d <= coinRadius * 0.62) return [...WHITE, 1] // inner coin face
  if (d <= coinRadius * 0.74) return [...BLUE, 1] // ring gap
  if (d <= coinRadius) return [...WHITE, 1] // outer rim
  return [...BLUE, 1]
}

function render(size, options) {
  const rgba = Buffer.alloc(size * size * 4)
  const n = SUBSAMPLES * SUBSAMPLES
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SUBSAMPLES; sy++) {
        for (let sx = 0; sx < SUBSAMPLES; sx++) {
          const [pr, pg, pb, pa] = sample(
            (x + (sx + 0.5) / SUBSAMPLES) / size,
            (y + (sy + 0.5) / SUBSAMPLES) / size,
            options,
          )
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa
        }
      }
      const i = (y * size + x) * 4
      if (a > 0) {
        rgba[i] = Math.round(r / a)
        rgba[i + 1] = Math.round(g / a)
        rgba[i + 2] = Math.round(b / a)
      }
      rgba[i + 3] = Math.round((a / n) * 255)
    }
  }
  return encodePng(size, size, rgba)
}

// Safe zone for maskable icons is a circle of radius 0.4; coin radius 0.3 stays well inside.
const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, coinRadius: 0.32 },
  { file: 'icon-512.png', size: 512, rounded: true, coinRadius: 0.32 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, coinRadius: 0.3 },
  // iOS applies its own rounding and dislikes transparency, so full-bleed.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, coinRadius: 0.32 },
]

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })
for (const { file, size, ...options } of ICONS) {
  writeFileSync(join(outDir, file), render(size, options))
  console.log(`wrote public/icons/${file} (${size}x${size})`)
}
