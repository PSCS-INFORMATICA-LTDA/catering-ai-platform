/**
 * Cuts the official CDL mark out of its white plate so it can be stamped onto
 * the package folders.
 *
 * Only the white *outside* the badge is removed — the white inside the ring and
 * the ribbon is part of the mark and stays. Flood filling from the corners is
 * what makes that distinction, rather than keying every white pixel.
 *
 * Run: node scripts/dev/build-cdl-folder-badge.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCE = join(ROOT, 'public/cdl/logo-cdl.png')
const TARGET = join(ROOT, 'assets/packages/cdl-badge-official.png')

const WHITE = 232 // a pixel this bright, with little colour, counts as plate
const CHROMA = 26

const image = sharp(SOURCE).ensureAlpha()
const { width, height } = await image.metadata()
const raw = await image.raw().toBuffer()

const isPlate = (i) => {
  const r = raw[i * 4]
  const g = raw[i * 4 + 1]
  const b = raw[i * 4 + 2]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return min >= WHITE && max - min <= CHROMA
}

// Flood fill the plate inward from the border.
const outside = new Uint8Array(width * height)
const stack = []
for (let x = 0; x < width; x += 1) {
  stack.push(x, (height - 1) * width + x)
}
for (let y = 0; y < height; y += 1) {
  stack.push(y * width, y * width + width - 1)
}
while (stack.length) {
  const i = stack.pop()
  if (outside[i] || !isPlate(i)) continue
  outside[i] = 1
  const x = i % width
  const y = (i - x) / width
  if (x > 0) stack.push(i - 1)
  if (x < width - 1) stack.push(i + 1)
  if (y > 0) stack.push(i - width)
  if (y < height - 1) stack.push(i + width)
}

for (let i = 0; i < width * height; i += 1) {
  if (outside[i]) raw[i * 4 + 3] = 0
}

// Soften the cut by one pixel so the disc edge does not stair-step, then crop
// to the mark. Feathering happens on the raw alpha: routing it back through
// sharp's channel joins loses the transparency.
const soft = Uint8Array.from(raw)
for (let y = 1; y < height - 1; y += 1) {
  for (let x = 1; x < width - 1; x += 1) {
    const i = y * width + x
    if (outside[i]) continue
    let open = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (outside[i + dy * width + dx]) open += 1
      }
    }
    if (open > 0) soft[i * 4 + 3] = Math.round(255 * (1 - open / 9))
  }
}

const trimmed = await sharp(Buffer.from(soft), {
  raw: { width, height, channels: 4 },
})
  .trim({ threshold: 1 })
  .png({ compressionLevel: 9 })
  .toBuffer()
const meta = await sharp(trimmed).metadata()

writeFileSync(TARGET, trimmed)

const opaque = raw.reduce((n, _v, i) => (i % 4 === 3 && raw[i] > 0 ? n + 1 : n), 0)
console.log(`badge  ${meta.width}x${meta.height}  opaque ${(
  (opaque / (width * height)) * 100
).toFixed(1)}%`)
console.log(`wrote  ${TARGET.replace(ROOT + '/', '')}`)
