import { MEDIA_AUTO_FOCUS_ENGINE, point, type DeviceFocusMap, type FocusPoint } from './editorMeta'

export const AUTO_FOCUS_ENGINE = MEDIA_AUTO_FOCUS_ENGINE

type PixelBuffer = {
  data: ArrayLike<number>
  width: number
  height: number
}

function sampleStride(width: number, height: number) {
  const maxSamples = 80 * 80
  const total = width * height
  if (total <= maxSamples) return 1
  return Math.ceil(Math.sqrt(total / maxSamples))
}

/**
 * Heuristic saliency, not multimodal AI.
 * Weights saturated / high-contrast pixels and slightly prefers the lower-center
 * plate area typical of BBQ photography.
 */
export function suggestFocusFromPixels(buffer: PixelBuffer): FocusPoint {
  const { data, width, height } = buffer
  if (!width || !height) return point(0.5, 0.48)
  const stride = sampleStride(width, height)
  let weightX = 0
  let weightY = 0
  let total = 0

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4
      const r = Number(data[index] ?? 0)
      const g = Number(data[index + 1] ?? 0)
      const b = Number(data[index + 2] ?? 0)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      const contrast = Math.abs(luma - 0.45)
      const nx = x / (width - 1 || 1)
      const ny = y / (height - 1 || 1)
      const centerBias = 1 - Math.hypot(nx - 0.5, ny - 0.58) * 0.85
      const foodBias = 0.65 + saturation * 1.4 + contrast * 0.8
      const weight = Math.max(0.05, foodBias * Math.max(0.15, centerBias))
      weightX += nx * weight
      weightY += ny * weight
      total += weight
    }
  }

  if (total <= 0) return point(0.5, 0.48)
  return point(weightX / total, weightY / total)
}

export function suggestDeviceFocus(base: FocusPoint): DeviceFocusMap {
  return {
    mobile: point(base.x, Math.min(0.92, base.y + 0.02)),
    tablet: point(base.x, base.y),
    desktop: point(base.x, Math.max(0.08, base.y - 0.04)),
  }
}

export async function suggestFocusFromImageSource(
  source: string,
): Promise<{ suggested: DeviceFocusMap; engine: typeof AUTO_FOCUS_ENGINE }> {
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return { suggested: suggestDeviceFocus(point(0.5, 0.48)), engine: AUTO_FOCUS_ENGINE }
  }
  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error('image_fetch_failed')
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height)
    const base = suggestFocusFromPixels(pixels)
    bitmap.close()
    return { suggested: suggestDeviceFocus(base), engine: AUTO_FOCUS_ENGINE }
  } catch {
    return { suggested: suggestDeviceFocus(point(0.5, 0.48)), engine: AUTO_FOCUS_ENGINE }
  }
}

export async function suggestFocusFromFile(file: File) {
  const url = URL.createObjectURL(file)
  try {
    return await suggestFocusFromImageSource(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}
