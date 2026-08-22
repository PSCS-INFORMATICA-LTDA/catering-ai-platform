'use client'

import type { PointerEvent } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import { suggestFocusFromFile, suggestFocusFromImageSource } from '@/Lib/media/autoFocus'
import {
  defaultEditorMeta,
  emptyMediaCopy,
  formatSequence,
  point,
  type MediaCopyFields,
  type MediaEditorMeta,
  type OverlayPosition,
} from '@/Lib/media/editorMeta'
import type { PublicMediaAsset } from '@/Lib/media/types'

export type HeroDraft = {
  id: string
  persisted: PublicMediaAsset | null
  sequence: number
  active: boolean
  entityKey: string
  mediaUrl: string | null
  pendingFile: File | null
  editor: MediaEditorMeta
  copy: MediaCopyFields
  preview: 'mobile' | 'tablet' | 'desktop'
  dirty: boolean
  saving: boolean
  savedFlash: boolean
  confirmDelete: boolean
  showAdvanced: boolean
  lightbox: boolean
}

const POSITIONS: OverlayPosition[] = [
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
]

function posLabel(position: OverlayPosition, locale: string) {
  if (position === 'top-left') return tMedia(locale, 'posTopLeft')
  if (position === 'top-right') return tMedia(locale, 'posTopRight')
  if (position === 'center') return tMedia(locale, 'posCenter')
  if (position === 'bottom-left') return tMedia(locale, 'posBottomLeft')
  return tMedia(locale, 'posBottomRight')
}

function overlayClass(position: OverlayPosition) {
  return `public-hero-caption public-hero-caption--${position}`
}

export default function HeroMediaCard({
  locale,
  draft,
  canManage,
  canDelete,
  isFirst,
  isLast,
  onChange,
  onMove,
  onSave,
  onDelete,
}: {
  locale: string
  draft: HeroDraft
  canManage: boolean
  canDelete: boolean
  isFirst: boolean
  isLast: boolean
  onChange: (next: HeroDraft) => void
  onMove: (direction: -1 | 1) => void
  onSave: () => void
  onDelete: () => void
}) {
  const focus = draft.editor.applied[draft.preview]
  const suggested = draft.editor.suggested[draft.preview]
  const previewSrc = draft.mediaUrl

  function patch(partial: Partial<HeroDraft>) {
    onChange({ ...draft, ...partial, dirty: true, savedFlash: false })
  }

  function patchEditor(partial: Partial<MediaEditorMeta>) {
    patch({ editor: defaultEditorMeta({ ...draft.editor, ...partial }) })
  }

  function patchCopy(partial: Partial<MediaCopyFields>) {
    patch({ copy: emptyMediaCopy({ ...draft.copy, ...partial }) })
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

  async function replaceFile(file: File) {
    const localUrl = URL.createObjectURL(file)
    const analysis = await suggestFocusFromFile(file)
    patch({
      pendingFile: file,
      mediaUrl: localUrl,
      editor: defaultEditorMeta({
        ...draft.editor,
        focusMode: 'auto',
        suggested: analysis.suggested,
        applied: analysis.suggested,
      }),
    })
  }

  async function recalc() {
    if (!draft.mediaUrl) return
    const analysis = await suggestFocusFromImageSource(draft.mediaUrl)
    patchEditor({
      suggested: analysis.suggested,
    })
  }

  return (
    <article
      className={`rounded-3xl border bg-cdl-surface p-4 shadow-sm ${
        draft.dirty ? 'border-[var(--brand-primary)]' : 'border-cdl-border'
      }`}
      data-hero-media-card={draft.id}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(16rem,20rem)_minmax(16rem,22rem)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-lg font-black tracking-wide text-cdl-title">
              {formatSequence(draft.sequence)}
            </strong>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                draft.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {draft.active ? tMedia(locale, 'statusActive') : tMedia(locale, 'statusInactive')}
            </span>
          </div>
          <div
            className="relative w-full cursor-crosshair overflow-hidden rounded-2xl bg-neutral-200"
            onPointerDown={applyPointerFocus}
            onPointerMove={(event) => {
              if (event.buttons === 1) applyPointerFocus(event)
            }}
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt={draft.copy.title_pt || draft.entityKey}
                className="aspect-[3/4] h-auto w-full object-cover"
                style={{ objectPosition: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%` }}
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-sm text-cdl-muted">
                {tMedia(locale, 'empty')}
              </div>
            )}
            {previewSrc ? (
              <span
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--brand-primary)] shadow"
                style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
                aria-hidden
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {previewSrc ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-xl border border-cdl-border px-3 text-sm font-semibold"
                onClick={() => onChange({ ...draft, lightbox: true })}
              >
                {tMedia(locale, 'enlarge')}
              </button>
            ) : null}
          {canManage ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-cdl-border px-3 text-sm font-semibold">
              {tMedia(locale, 'actionReplace')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void replaceFile(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-cdl-muted">
            {tMedia(locale, 'sequence')}
            <input
              type="number"
              min={1}
              className="mt-1 min-h-10 w-24 rounded-lg border border-cdl-border px-2 text-sm"
              value={draft.sequence}
              disabled={!canManage}
              onChange={(event) => patch({ sequence: Math.max(1, Number(event.target.value) || 1) })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canManage}
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => patch({ active: !draft.active })}
            >
              {draft.active ? tMedia(locale, 'actionDeactivate') : tMedia(locale, 'actionActivate')}
            </button>
            <button
              type="button"
              disabled={!canManage || isFirst}
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={!canManage || isLast}
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => onMove(1)}
            >
              ↓
            </button>
          </div>
          <p className="text-xs text-cdl-faint">
            {tMedia(locale, 'placement')}: hero · {tMedia(locale, 'variant')}: original
          </p>
          <fieldset className="space-y-2">
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
                  <div key={lang} className="space-y-1">
                    <input
                      className="min-h-10 w-full rounded-lg border border-cdl-border px-2 text-sm"
                      placeholder={`${lang.toUpperCase()} ${tMedia(locale, 'overlayTitle')}`}
                      value={draft.copy[`title_${lang}`]}
                      onChange={(event) => patchCopy({ [`title_${lang}`]: event.target.value })}
                    />
                    <input
                      className="min-h-10 w-full rounded-lg border border-cdl-border px-2 text-sm"
                      placeholder={`${lang.toUpperCase()} ${tMedia(locale, 'overlaySubtitle')}`}
                      value={draft.copy[`subtitle_${lang}`]}
                      onChange={(event) =>
                        patchCopy({ [`subtitle_${lang}`]: event.target.value })
                      }
                    />
                  </div>
                ))}
                <label className="sm:col-span-2 text-xs font-semibold text-cdl-muted">
                  {tMedia(locale, 'overlayPosition')}
                  <select
                    className="mt-1 min-h-10 w-full rounded-lg border border-cdl-border px-2 text-sm"
                    value={draft.editor.overlayPosition}
                    onChange={(event) =>
                      patchEditor({ overlayPosition: event.target.value as OverlayPosition })
                    }
                  >
                    {POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {posLabel(position, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </fieldset>
          <details
            className="text-xs text-cdl-muted"
            open={draft.showAdvanced}
            onToggle={(event) =>
              onChange({ ...draft, showAdvanced: event.currentTarget.open })
            }
          >
            <summary className="cursor-pointer font-semibold">
              {tMedia(locale, 'advancedDetails')}
            </summary>
            <p className="mt-2">
              {tMedia(locale, 'internalCode')}: {draft.entityKey || '—'}
            </p>
          </details>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                draft.editor.focusMode === 'auto' ? 'bg-neutral-900 text-white' : 'border border-cdl-border'
              }`}
              onClick={() => patchEditor({ focusMode: 'auto', applied: draft.editor.suggested })}
            >
              {tMedia(locale, 'focusAuto')}
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                draft.editor.focusMode === 'manual' ? 'bg-neutral-900 text-white' : 'border border-cdl-border'
              }`}
              onClick={() => patchEditor({ focusMode: 'manual' })}
            >
              {tMedia(locale, 'focusManual')}
            </button>
          </div>
          <p className="text-xs text-cdl-muted">{tMedia(locale, 'focusHelp')}</p>
          <div className="flex flex-wrap gap-1">
            {(['mobile', 'tablet', 'desktop'] as const).map((device) => (
              <button
                key={device}
                type="button"
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
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
          <div className="flex flex-wrap gap-1">
            {[
              ['left', 0],
              ['center', 0.5],
              ['right', 1],
            ].map(([key, value]) => (
              <button
                key={String(key)}
                type="button"
                className="rounded-lg border border-cdl-border px-2 py-1 text-[11px] font-semibold"
                onClick={() => setApplied({ x: Number(value) })}
              >
                {tMedia(
                  locale,
                  key === 'left' ? 'focusLeft' : key === 'right' ? 'focusRight' : 'focusCenter',
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              ['top', 0],
              ['middle', 0.5],
              ['bottom', 1],
            ].map(([key, value]) => (
              <button
                key={String(key)}
                type="button"
                className="rounded-lg border border-cdl-border px-2 py-1 text-[11px] font-semibold"
                onClick={() => setApplied({ y: Number(value) })}
              >
                {tMedia(
                  locale,
                  key === 'top' ? 'focusTop' : key === 'bottom' ? 'focusBottom' : 'focusMiddle',
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-cdl-muted">
            {tMedia(locale, 'suggested')}: X {suggested.x.toFixed(2)} / Y {suggested.y.toFixed(2)}
            <br />
            {tMedia(locale, 'applied')}: X {focus.x.toFixed(2)} / Y {focus.y.toFixed(2)}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => setApplied(suggested, draft.editor.focusMode)}
            >
              {tMedia(locale, 'actionUseSuggested')}
            </button>
            <button
              type="button"
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => patchEditor({ applied: draft.editor.suggested })}
            >
              {tMedia(locale, 'actionApplyAllSuggested')}
            </button>
            <button
              type="button"
              className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => void recalc()}
            >
              {tMedia(locale, 'actionRecalcFocus')}
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-cdl-faint">
            {tMedia(locale, 'autoFocusEngine')}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-cdl-muted">
            <label>
              FX
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="mt-1 min-h-9 w-full rounded-lg border border-cdl-border px-2"
                value={focus.x}
                onChange={(event) => setApplied({ x: Number(event.target.value) })}
              />
            </label>
            <label>
              FY
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="mt-1 min-h-9 w-full rounded-lg border border-cdl-border px-2"
                value={focus.y}
                onChange={(event) => setApplied({ y: Number(event.target.value) })}
              />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['mobile', 'tablet', 'desktop'] as const).map((device) => (
              <button
                key={device}
                type="button"
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
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
            data-media-preview={draft.preview}
            className="overflow-hidden rounded-3xl border border-cdl-border bg-neutral-950"
          >
            <button
              type="button"
              className={`relative w-full ${
                draft.preview === 'mobile'
                  ? 'aspect-[9/16]'
                  : draft.preview === 'tablet'
                    ? 'aspect-[3/4]'
                    : 'aspect-[16/9]'
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
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--brand-primary)] shadow"
                style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
                aria-hidden
              />
              {draft.editor.overlayEnabled && draft.copy.title_pt ? (
                <p className={overlayClass(draft.editor.overlayPosition)}>
                  <span className="public-hero-caption-rule" aria-hidden />
                  {draft.copy.title_pt}
                </p>
              ) : null}
            </button>
          </div>
        </section>
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={draft.saving || !draft.dirty}
              onClick={onSave}
              className="min-h-11 rounded-xl bg-[var(--brand-primary)] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {draft.saving ? tMedia(locale, 'actionSaving') : tMedia(locale, 'actionSave')}
            </button>
            {draft.dirty ? (
              <span className="text-xs font-semibold text-amber-700">{tMedia(locale, 'unsaved')}</span>
            ) : null}
            {draft.savedFlash ? (
              <span className="text-xs font-semibold text-emerald-700">
                {tMedia(locale, 'actionSaved')}
              </span>
            ) : null}
          </div>
          {canDelete ? (
            <button
              type="button"
              className="min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700"
              onClick={() => onChange({ ...draft, confirmDelete: true })}
            >
              {tMedia(locale, 'actionDelete')}
            </button>
          ) : null}
        </div>
      ) : null}

      {draft.confirmDelete ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">{tMedia(locale, 'deleteConfirmTitle')}</p>
          <p className="mt-1 text-sm text-red-800">{tMedia(locale, 'deleteConfirmBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-cdl-border bg-white px-3 py-2 text-sm font-semibold"
              onClick={() => onChange({ ...draft, confirmDelete: false })}
            >
              {tMedia(locale, 'actionCancel')}
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
              onClick={onDelete}
            >
              {tMedia(locale, 'actionDeleteForever')}
            </button>
          </div>
        </div>
      ) : null}

      {draft.lightbox && previewSrc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => onChange({ ...draft, lightbox: false })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
        </div>
      ) : null}
    </article>
  )
}
