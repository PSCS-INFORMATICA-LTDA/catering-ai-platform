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

const ENVELOPE_MARK = '__me'
const COMPACT_MARK = '__m1'
const LABEL_ES_MAX = 255

const POSITION_CODE: Record<OverlayPosition, string> = {
  'top-left': 'tl',
  'top-right': 'tr',
  center: 'cc',
  'bottom-left': 'bl',
  'bottom-right': 'br',
}

const CODE_POSITION: Record<string, OverlayPosition> = {
  tl: 'top-left',
  tr: 'top-right',
  cc: 'center',
  bl: 'bottom-left',
  br: 'bottom-right',
}

type EditorEnvelope = {
  [ENVELOPE_MARK]: 1
  label_es?: string | null
  editor: MediaEditorMeta
}

function pct(value: number) {
  return String(Math.round(clampFocus(value) * 100)).padStart(2, '0')
}

function unpct(raw: string) {
  return clampFocus(Number(raw) / 100)
}

function packFocus(map: DeviceFocusMap) {
  return [map.mobile, map.tablet, map.desktop]
    .map((item) => `${pct(item.x)}${pct(item.y)}`)
    .join('')
}

function unpackFocus(raw: string, fallback: DeviceFocusMap): DeviceFocusMap {
  if (!raw || raw.length < 12) return fallback
  const read = (offset: number) =>
    point(unpct(raw.slice(offset, offset + 2)), unpct(raw.slice(offset + 2, offset + 4)))
  return {
    mobile: read(0),
    tablet: read(4),
    desktop: read(8),
  }
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

export function parseEditorEnvelope(labelEs: string | null | undefined): {
  label_es: string | null
  editor: MediaEditorMeta | null
} {
  const raw = labelEs?.trim() || ''
  if (raw.startsWith(`${COMPACT_MARK}|`)) {
    const [, flags = '', packed = '', ...rest] = raw.split('|')
    const remainder = rest.join('|')
    const [esLabel, subtitlePt, subtitleEn, subtitleEs] = remainder.split('\u001f')
    const suggested = unpackFocus(packed.slice(0, 12), defaultFocusMap())
    const applied = unpackFocus(packed.slice(12, 24), suggested)
    return {
      label_es: esLabel || null,
      editor: defaultEditorMeta({
        focusMode: flags[0] === 'm' ? 'manual' : 'auto',
        overlayEnabled: flags[1] === '1',
        overlayDecided: flags[2] === '1',
        overlayPosition: CODE_POSITION[flags.slice(3, 5)] ?? 'top-left',
        title_es: esLabel || '',
        subtitle_pt: subtitlePt || '',
        subtitle_en: subtitleEn || '',
        subtitle_es: subtitleEs || '',
        suggested,
        applied,
      }),
    }
  }
  if (!raw.startsWith('{')) return { label_es: labelEs ?? null, editor: null }
  try {
    const parsed = JSON.parse(raw) as EditorEnvelope
    if (parsed?.[ENVELOPE_MARK] !== 1 || !parsed.editor) {
      return { label_es: labelEs ?? null, editor: null }
    }
    return {
      label_es: parsed.label_es ?? null,
      editor: defaultEditorMeta(parsed.editor),
    }
  } catch {
    return { label_es: labelEs ?? null, editor: null }
  }
}

export function serializeEditorEnvelope(
  labelEs: string | null | undefined,
  editor: MediaEditorMeta,
) {
  const meta = defaultEditorMeta(editor)
  const flags = `${meta.focusMode === 'manual' ? 'm' : 'a'}${meta.overlayEnabled ? '1' : '0'}${
    meta.overlayDecided ? '1' : '0'
  }${POSITION_CODE[meta.overlayPosition]}`
  const packed = `${packFocus(meta.suggested)}${packFocus(meta.applied)}`
  const extras = [meta.subtitle_pt, meta.subtitle_en, meta.subtitle_es]
  const hasSubs = extras.some(Boolean)
  const visibleEs = (labelEs ?? meta.title_es ?? '').replaceAll('\u001f', ' ')
  let compact = `${COMPACT_MARK}|${flags}|${packed}|${visibleEs}`
  if (hasSubs) compact += `\u001f${extras.map((item) => item.replaceAll('\u001f', ' ')).join('\u001f')}`
  if (compact.length <= LABEL_ES_MAX) return compact
  compact = `${COMPACT_MARK}|${flags}|${packed}|${visibleEs}`.slice(0, LABEL_ES_MAX)
  return compact
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
