'use client'

import type { PointerEvent } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import {
  defaultEditorMeta,
  emptyMediaCopy,
  point,
  type OverlayPosition,
} from '@/Lib/media/editorMeta'
import { suggestFocusFromImageSource } from '@/Lib/media/autoFocus'
import type { HeroDraft } from './HeroMediaCard'

const POSITIONS: OverlayPosition[] = [
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
]

export default function HeroFocusEditor({
  locale,
  draft,
  onChange,
  onClose,
  onCompare,
}: {
  locale: string
  draft: HeroDraft
  onChange: (next: HeroDraft) => void
  onClose: () => void
  onCompare: () => void
}) {
  const focus = draft.editor.applied[draft.preview]
  const suggested = draft.editor.suggested[draft.preview]
  const previewSrc = draft.mediaUrl

  function patchEditor(partial: Parameters<typeof defaultEditorMeta>[0]) {
    onChange({
      ...draft,
      dirty: true,
      savedFlash: false,
      editor: defaultEditorMeta({ ...draft.editor, ...partial }),
    })
  }

  function setApplied(next: { x?: number; y?: number }, mode: 'auto' | 'manual' = 'manual') {
    const current = draft.editor.applied[draft.preview]
    patchEditor({
      focusMode: mode,
      applied: {
        ...draft.editor.applied,
        [draft.preview]: point(next.x ?? current.x, next.y ?? current.y),
      },
    })
  }

  function applyPointerFocus(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    setApplied({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">{tMedia(locale, 'focusEditorTitle')}</h2>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-semibold"
            onClick={onClose}
          >
            {tMedia(locale, 'actionCancel')}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['mobile', 'tablet', 'desktop'] as const).map((device) => (
            <button
              key={device}
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                draft.preview === device ? 'bg-neutral-900 text-white' : 'border border-cdl-border'
              }`}
              onClick={() => onChange({ ...draft, preview: device })}
            >
              {tMedia(
                locale,
                device === 'mobile'
                  ? 'previewMobile'
                  : device === 'tablet'
                    ? 'previewTablet'
                    : 'previewDesktop',
              )}
            </button>
          ))}
        </div>
        <div
          data-media-single-canvas
          data-media-preview={draft.preview}
          className="mt-4 overflow-hidden rounded-3xl border border-cdl-border bg-neutral-950"
        >
          <button
            type="button"
            className={`relative w-full ${
              draft.preview === 'mobile'
                ? 'aspect-[9/16] max-h-[70vh]'
                : draft.preview === 'tablet'
                  ? 'aspect-[3/4] max-h-[70vh]'
                  : 'aspect-[16/9] max-h-[70vh]'
            }`}
            onPointerDown={applyPointerFocus}
            onPointerMove={(event) => {
              if (event.buttons === 1) applyPointerFocus(event)
            }}
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`,
                }}
              />
            ) : null}
            <span
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--brand-primary)] shadow"
              style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
              aria-hidden
            />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['left', 0],
            ['center', 0.5],
            ['right', 1],
          ].map(([key, value]) => (
            <button
              key={String(key)}
              type="button"
              className="rounded-lg border border-cdl-border px-3 py-2 text-xs font-semibold"
              onClick={() => setApplied({ x: Number(value) })}
            >
              {tMedia(
                locale,
                key === 'left' ? 'focusLeft' : key === 'right' ? 'focusRight' : 'focusCenter',
              )}
            </button>
          ))}
          {[
            ['top', 0],
            ['middle', 0.5],
            ['bottom', 1],
          ].map(([key, value]) => (
            <button
              key={String(key)}
              type="button"
              className="rounded-lg border border-cdl-border px-3 py-2 text-xs font-semibold"
              onClick={() => setApplied({ y: Number(value) })}
            >
              {tMedia(
                locale,
                key === 'top' ? 'focusTop' : key === 'bottom' ? 'focusBottom' : 'focusMiddle',
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-cdl-border px-3 py-2 text-xs font-semibold"
            onClick={() => setApplied(suggested, draft.editor.focusMode)}
          >
            {tMedia(locale, 'actionUseSuggested')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-cdl-border px-3 py-2 text-xs font-semibold"
            onClick={() => {
              if (!draft.mediaUrl) return
              void suggestFocusFromImageSource(draft.mediaUrl).then((analysis) => {
                patchEditor({ suggested: analysis.suggested })
              })
            }}
          >
            {tMedia(locale, 'actionRecalcFocus')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-cdl-border px-3 py-2 text-xs font-semibold"
            onClick={onCompare}
          >
            {tMedia(locale, 'actionCompareDevices')}
          </button>
        </div>
        <details className="mt-4 text-sm text-cdl-muted">
          <summary className="cursor-pointer font-semibold">
            {tMedia(locale, 'advancedDetails')}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label>
              X
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="mt-1 min-h-10 w-full rounded-lg border border-cdl-border px-2"
                value={Number(focus.x.toFixed(2))}
                onChange={(event) => setApplied({ x: Number(event.target.value) })}
              />
            </label>
            <label>
              Y
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="mt-1 min-h-10 w-full rounded-lg border border-cdl-border px-2"
                value={Number(focus.y.toFixed(2))}
                onChange={(event) => setApplied({ y: Number(event.target.value) })}
              />
            </label>
          </div>
          <p className="mt-2 text-xs">
            {tMedia(locale, 'suggested')}: X {suggested.x.toFixed(2)} / Y {suggested.y.toFixed(2)}
          </p>
        </details>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-cdl-muted">
            {tMedia(locale, 'overlayToggle')}
          </legend>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                !draft.editor.overlayEnabled ? 'bg-neutral-900 text-white' : 'border border-cdl-border'
              }`}
              onClick={() => patchEditor({ overlayEnabled: false, overlayDecided: true })}
            >
              {tMedia(locale, 'overlayNo')}
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                draft.editor.overlayEnabled ? 'bg-neutral-900 text-white' : 'border border-cdl-border'
              }`}
              onClick={() => patchEditor({ overlayEnabled: true, overlayDecided: true })}
            >
              {tMedia(locale, 'overlayYes')}
            </button>
          </div>
          {draft.editor.overlayEnabled ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {(['pt', 'en', 'es'] as const).map((lang) => (
                <input
                  key={lang}
                  className="min-h-10 w-full rounded-lg border border-cdl-border px-2 text-sm"
                  placeholder={`${lang.toUpperCase()} ${tMedia(locale, 'overlayTitle')}`}
                  value={draft.copy[`title_${lang}`]}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      dirty: true,
                      copy: emptyMediaCopy({
                        ...draft.copy,
                        [`title_${lang}`]: event.target.value,
                      }),
                    })
                  }
                />
              ))}
              <select
                className="min-h-10 rounded-lg border border-cdl-border px-2 text-sm"
                value={draft.editor.overlayPosition}
                onChange={(event) =>
                  patchEditor({ overlayPosition: event.target.value as OverlayPosition })
                }
              >
                {POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </fieldset>
      </div>
    </div>
  )
}
