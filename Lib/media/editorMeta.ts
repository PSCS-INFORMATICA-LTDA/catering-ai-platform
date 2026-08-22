export const MEDIA_AUTO_FOCUS_ENGINE = 'HEURISTIC' as const

export type OverlayPosition =
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right'

export type FocusPoint = { x: number; y: number }

export type DeviceFocusMap = {
  mobile: FocusPoint
  tablet: FocusPoint
  desktop: FocusPoint
}

export type MediaEditorMeta = {
  autoFocus: typeof MEDIA_AUTO_FOCUS_ENGINE
  focusMode: 'auto' | 'manual'
  overlayEnabled: boolean
  overlayDecided: boolean
  overlayPosition: OverlayPosition
  title_pt: string
  title_en: string
  title_es: string
  subtitle_pt: string
  subtitle_en: string
  subtitle_es: string
  suggested: DeviceFocusMap
  applied: DeviceFocusMap
}

export function clampFocus(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

export function point(x: number, y: number): FocusPoint {
  return { x: clampFocus(x), y: clampFocus(y) }
}

export function defaultFocusMap(base?: FocusPoint | null): DeviceFocusMap {
  const fallback = point(base?.x ?? 0.5, base?.y ?? 0.5)
  return {
    mobile: { ...fallback },
    tablet: { ...fallback },
    desktop: { ...fallback },
  }
}

export function defaultEditorMeta(input?: Partial<MediaEditorMeta>): MediaEditorMeta {
  const suggested = input?.suggested ?? defaultFocusMap()
  return {
    autoFocus: MEDIA_AUTO_FOCUS_ENGINE,
    focusMode: input?.focusMode ?? 'auto',
    overlayEnabled: input?.overlayEnabled === true,
    overlayDecided: input?.overlayDecided === true,
    overlayPosition: input?.overlayPosition ?? 'top-left',
    title_pt: input?.title_pt ?? '',
    title_en: input?.title_en ?? '',
    title_es: input?.title_es ?? '',
    subtitle_pt: input?.subtitle_pt ?? '',
    subtitle_en: input?.subtitle_en ?? '',
    subtitle_es: input?.subtitle_es ?? '',
    suggested,
    applied: input?.applied ?? {
      mobile: { ...suggested.mobile },
      tablet: { ...suggested.tablet },
      desktop: { ...suggested.desktop },
    },
  }
}

export function parseCssFocus(position: string | null | undefined): FocusPoint {
  const [x, y] = String(position || '50% 50%')
    .split(/\s+/)
    .map((part) => Number(String(part).replace('%', '')) / 100)
  return point(x, y)
}

export function focusToCss(focus: FocusPoint) {
  return `${Math.round(clampFocus(focus.x) * 100)}% ${Math.round(clampFocus(focus.y) * 100)}%`
}

export function isOverlayPosition(value: string | null | undefined): value is OverlayPosition {
  return (
    value === 'top-left' ||
    value === 'top-right' ||
    value === 'center' ||
    value === 'bottom-left' ||
    value === 'bottom-right'
  )
}

export function isEditorMeta(value: unknown): value is Partial<MediaEditorMeta> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function formatSequence(order: number) {
  const safe = Number.isFinite(order) && order > 0 ? Math.floor(order) : 1
  return `SEQ. ${String(safe).padStart(2, '0')}`
}

export function nextDisplayOrder(orders: number[]) {
  const max = orders.reduce((current, value) => Math.max(current, Number(value) || 0), 0)
  return max + 1
}

export function normalizeDisplayOrders<T extends { id: string; display_order: number }>(
  items: T[],
): T[] {
  return items.map((item, index) => ({ ...item, display_order: index + 1 }))
}
