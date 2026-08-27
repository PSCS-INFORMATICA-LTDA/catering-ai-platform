#!/usr/bin/env node
/**
 * Re-frame the official CDL fire plate into a fixed safe-area canvas.
 *
 * The source plate zooms inside its own 512x610 canvas: at t=0 the ring spans
 * 450px and the "BBQ AT HOME" banner sits 4px from the bottom edge, so the mark
 * reads as clipped no matter how small the HTML box is. On top of that the ring
 * sits ~29px below the frame centre, so any centred round mask eats the banner.
 *
 * This rebuilds the SAME footage on a constant 610x610 canvas with the ring dead
 * centre. The room added around the plate is filled by smearing the plate's own
 * border outwards and blurring it, so the backdrop is pixel-aligned with the
 * plate and its border cannot read as a box. A radial falloff closes the canvas
 * on black.
 *
 *   node scripts/dev/build-cdl-fire-safe-asset.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCE = join(ROOT, 'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4')
const TARGET = join(ROOT, 'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V7.mp4')

const SRC_W = 512
const SRC_H = 610
// Ring bounding box measured over the full 151-frame cycle.
const RING = { x0: 37, y0: 182, x1: 486, y1: 605 }
// Working canvas, padded so the ring sits dead centre.
const PAD_W = 768
const PAD_H = 840
// Delivered canvas. Square so the success stage never letterboxes.
const CANVAS = 610
// Ring is rendered at this share of the canvas, leaving ~17% safe area. Larger
// than V6's 0.58 so the mark carries the top of the screen on its own.
const RING_SHARE = 0.655
const BACKDROP_BLUR = 38
// Plate border melts into its own blurred backdrop everywhere except over the
// ring itself, which runs to the very bottom of the source frame.
const FEATHER = 38
const RING_GUARD = 0.08
// Radial falloff starts just outside the ring and ends on pure black, so the
// flames above the mark fade out across the whole distance to the canvas edge
// instead of dying in the last few percent.
const FALLOFF_START = 0.67

if (!existsSync(SOURCE)) {
  console.error(`Missing source plate: ${SOURCE}`)
  process.exit(1)
}

const ringCx = (RING.x0 + RING.x1) / 2
const ringCy = (RING.y0 + RING.y1) / 2
const padX = Math.round(PAD_W / 2 - ringCx)
const padY = Math.round(PAD_H / 2 - ringCy)
const borders = {
  left: padX,
  right: PAD_W - SRC_W - padX,
  top: padY,
  bottom: PAD_H - SRC_H - padY,
}
const scale = (RING_SHARE * CANVAS) / (RING.x1 - RING.x0 + 1)
const backdrop = { w: Math.round(PAD_W * scale), h: Math.round(PAD_H * scale) }
const backdropX = Math.round(CANVAS / 2 - (padX + ringCx) * scale)
const backdropY = Math.round(CANVAS / 2 - (padY + ringCy) * scale)
const plate = { w: Math.round(SRC_W * scale), h: Math.round(SRC_H * scale) }
const plateX = Math.round(CANVAS / 2 - ringCx * scale)
const plateY = Math.round(CANVAS / 2 - ringCy * scale)

const half = CANVAS / 2
const radial = `hypot(X-${half},Y-${half})/${half}`
const ramp = `clip((1-${radial})/${(1 - FALLOFF_START).toFixed(3)},0,1)`
const falloff = `(${ramp}*${ramp}*(3-2*${ramp}))`
const ringPlate = {
  cx: (ringCx * scale).toFixed(1),
  cy: (ringCy * scale).toFixed(1),
  a: (((RING.x1 - RING.x0 + 1) / 2) * scale + 3).toFixed(1),
  b: (((RING.y1 - RING.y0 + 1) / 2) * scale + 3).toFixed(1),
}
const border = `clip(min(min(X,W-1-X),min(Y,H-1-Y))/${FEATHER},0,1)`
const guard =
  `clip((1-hypot((X-${ringPlate.cx})/${ringPlate.a},` +
  `(Y-${ringPlate.cy})/${ringPlate.b}))/${RING_GUARD},0,1)`
const alpha = `255*max(${border},${guard})`

const filter = [
  `color=black:s=${CANVAS}x${CANVAS}:r=30[base]`,
  '[0:v]split=2[bg][fg]',
  `[bg]pad=${PAD_W}:${PAD_H}:${padX}:${padY},` +
    `fillborders=left=${borders.left}:right=${borders.right}:` +
    `top=${borders.top}:bottom=${borders.bottom}:mode=smear,` +
    `gblur=sigma=${BACKDROP_BLUR},scale=${backdrop.w}:${backdrop.h}[bgv]`,
  `[base][bgv]overlay=${backdropX}:${backdropY}:shortest=1[skirt]`,
  `[fg]scale=${plate.w}:${plate.h},format=rgba,` +
    `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alpha}'[fgv]`,
  `[skirt][fgv]overlay=${plateX}:${plateY}[comp]`,
  `[comp]format=rgb24,` +
    `geq=r='r(X,Y)*${falloff}':g='g(X,Y)*${falloff}':b='b(X,Y)*${falloff}'[out]`,
].join(';')

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', SOURCE,
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:v', 'libx264',
    '-crf', '17',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    TARGET,
  ],
  { stdio: 'inherit' },
)

console.log(`padded borders ${JSON.stringify(borders)} scale ${scale.toFixed(4)}`)
console.log(`plate ${plate.w}x${plate.h} at ${plateX},${plateY}`)
console.log(`backdrop ${backdrop.w}x${backdrop.h} at ${backdropX},${backdropY}`)
console.log(`built ${TARGET}`)
