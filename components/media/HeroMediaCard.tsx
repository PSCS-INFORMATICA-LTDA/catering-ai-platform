'use client'

import { tMedia } from '@/Lib/i18n/media'
import { suggestFocusFromFile } from '@/Lib/media/autoFocus'
import { defaultEditorMeta, formatSequence, type MediaCopyFields, type MediaEditorMeta } from '@/Lib/media/editorMeta'
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
  selected: boolean
  imported: boolean
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
  onAdjustFocus,
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
  onAdjustFocus: () => void
}) {
  const previewSrc = draft.mediaUrl
  const focus = draft.editor.applied.mobile

  function patch(partial: Partial<HeroDraft>) {
    onChange({ ...draft, ...partial, dirty: true, savedFlash: false })
  }

  return (
    <article
      className={`rounded-3xl border bg-cdl-surface p-4 shadow-sm ${
        draft.imported
          ? 'border-[var(--cdl-action)]'
          : draft.dirty
            ? 'border-[var(--brand-primary)]'
            : 'border-cdl-border'
      }`}
      data-hero-media-card={draft.id}
      data-hero-ux="v3"
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {canManage ? (
          <label className="flex items-start pt-1">
            <input
              type="checkbox"
              checked={draft.selected}
              onChange={(event) => onChange({ ...draft, selected: event.target.checked })}
              className="mt-1 h-5 w-5"
              aria-label={formatSequence(draft.sequence)}
            />
          </label>
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            className="relative overflow-hidden rounded-2xl bg-neutral-200"
            data-media-single-canvas
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt={draft.copy.title_pt || draft.entityKey}
                className="aspect-[16/9] h-auto w-full object-cover"
                style={{ objectPosition: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%` }}
              />
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center text-sm text-cdl-muted">
                {tMedia(locale, 'empty')}
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full max-w-sm flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase">
              {draft.editor.overlayEnabled
                ? tMedia(locale, 'overlayShortYes')
                : tMedia(locale, 'overlayShortNo')}
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase">
              {draft.editor.focusMode === 'manual'
                ? tMedia(locale, 'focusManualShort')
                : tMedia(locale, 'focusAutoShort')}
            </span>
            {draft.imported ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-800">
                {tMedia(locale, 'batchImportedFilter')}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-cdl-muted">
            {tMedia(locale, 'autoFocusEngine')}
          </p>
          <details className="text-xs text-cdl-muted">
            <summary className="cursor-pointer font-semibold">
              {tMedia(locale, 'advancedDetails')}
            </summary>
            <p className="mt-2">
              {tMedia(locale, 'internalCode')}: {draft.entityKey || '—'}
            </p>
          </details>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isFirst}
                className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
                onClick={() => onMove(-1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={isLast}
                className="rounded-lg border border-cdl-border px-3 py-1.5 text-xs font-semibold"
                onClick={() => onMove(1)}
              >
                ↓
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div
          data-media-card-actions
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cdl-border pt-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-semibold"
              onClick={onAdjustFocus}
            >
              {tMedia(locale, 'actionAdjustFocus')}
            </button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-cdl-border px-4 text-sm font-semibold">
              {tMedia(locale, 'actionReplace')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void suggestFocusFromFile(file).then((analysis) => {
                      onChange({
                        ...draft,
                        pendingFile: file,
                        mediaUrl: URL.createObjectURL(file),
                        dirty: true,
                        savedFlash: false,
                        editor: defaultEditorMeta({
                          ...draft.editor,
                          focusMode: 'auto',
                          suggested: analysis.suggested,
                          applied: analysis.suggested,
                        }),
                      })
                    })
                  }
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <button
              type="button"
              disabled={draft.saving}
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-semibold"
              onClick={() => patch({ active: !draft.active })}
            >
              {draft.active ? tMedia(locale, 'actionDeactivate') : tMedia(locale, 'actionActivate')}
            </button>
            {canDelete ? (
              <button
                type="button"
                disabled={draft.saving}
                className="min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700"
                onClick={() => onChange({ ...draft, confirmDelete: true })}
              >
                {tMedia(locale, 'actionDelete')}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {draft.dirty ? (
              <span className="text-xs font-semibold text-amber-700">{tMedia(locale, 'unsaved')}</span>
            ) : null}
            {draft.savedFlash ? (
              <span className="text-xs font-semibold text-emerald-700">
                {tMedia(locale, 'actionSaved')}
              </span>
            ) : null}
            <button
              type="button"
              data-media-save
              disabled={draft.saving}
              onClick={onSave}
              className="min-h-11 min-w-[8.5rem] rounded-xl bg-[var(--cdl-action)] px-6 text-sm font-black uppercase tracking-wide text-white shadow-sm disabled:cursor-wait"
            >
              {draft.saving ? tMedia(locale, 'actionSaving') : tMedia(locale, 'actionSave')}
            </button>
          </div>
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
    </article>
  )
}
