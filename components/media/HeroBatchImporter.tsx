'use client'

import { useMemo, useState } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import { suggestFocusFromFile } from '@/Lib/media/autoFocus'
import { hashFile, validateBatchImageFile } from '@/Lib/media/batchValidate'
import { persistableEditorMeta } from '@/Lib/media/editorMeta'
import {
  insertAtPosition,
  looksLikeExistingDuplicate,
  MEDIA_BATCH_LIMIT,
  MEDIA_UPLOAD_CONCURRENCY,
} from '@/Lib/media/playlist'
import type { PublicMediaAsset } from '@/Lib/media/types'
import type { HeroDraft } from './HeroMediaCard'

type BatchItem = {
  localId: string
  file: File
  preview: string
  size: number
  hash: string
  status: 'waiting' | 'sending' | 'done' | 'error' | 'ignored'
  error: string | null
  duplicate: boolean
  sendAnyway: boolean
}

async function runQueue<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const pending = [...items]
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (pending.length) {
      const item = pending.shift()
      if (item) await worker(item)
    }
  })
  await Promise.all(workers)
}

export default function HeroBatchImporter({
  locale,
  existing,
  onClose,
  onDone,
}: {
  locale: string
  existing: HeroDraft[]
  onClose: () => void
  onDone: (importedIds: string[], reorderFailed: boolean) => Promise<void>
}) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [insertAt, setInsertAt] = useState(existing.length + 1)
  const [activateAfter, setActivateAfter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const ready = useMemo(
    () => items.filter((item) => item.status !== 'ignored' && (item.sendAnyway || !item.duplicate)),
    [items],
  )

  async function addFiles(files: File[]) {
    const accepted: BatchItem[] = []
    const hashes = new Set(items.map((item) => item.hash))
    for (const file of files) {
      if (items.length + accepted.length >= MEDIA_BATCH_LIMIT) break
      const invalid = validateBatchImageFile(file)
      if (invalid) {
        setError(tMedia(locale, invalid === 'file_too_large' ? 'fileTooLarge' : 'invalidFile'))
        continue
      }
      const hash = await hashFile(file)
      const duplicate =
        hashes.has(hash) ||
        looksLikeExistingDuplicate({
          fileName: file.name,
          existing: existing.map((draft) => ({
            media_url: draft.mediaUrl,
            storage_path: draft.persisted?.storage_path,
            label_pt: draft.entityKey,
          })),
        })
      hashes.add(hash)
      accepted.push({
        localId: `batch-${hash}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        size: file.size,
        hash,
        status: 'waiting',
        error: null,
        duplicate,
        sendAnyway: false,
      })
    }
    setItems((current) => [...current, ...accepted].slice(0, MEDIA_BATCH_LIMIT))
  }

  function moveItem(localId: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.localId === localId)
      const next = index + direction
      if (index < 0 || next < 0 || next >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      if (!item) return current
      copy.splice(next, 0, item)
      return copy
    })
  }

  async function importReady(onlyFailed = false) {
    const queue = items.filter((item) =>
      onlyFailed
        ? item.status === 'error'
        : item.status !== 'ignored' && item.status !== 'done' && (item.sendAnyway || !item.duplicate),
    )
    if (queue.length === 0) return
    setBusy(true)
    setError(null)
    setProgress({ current: 0, total: queue.length })
    const createdIds: string[] = []
    let completed = 0

    await runQueue(queue, MEDIA_UPLOAD_CONCURRENCY, async (item) => {
      setItems((current) =>
        current.map((row) =>
          row.localId === item.localId ? { ...row, status: 'sending', error: null } : row,
        ),
      )
      try {
        const analysis = await suggestFocusFromFile(item.file)
        const created = await fetch('/api/media/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placement: 'hero',
            media_type: 'image',
            active: activateAfter,
            editor: persistableEditorMeta({
              focusMode: 'auto',
              overlayEnabled: false,
              overlayDecided: true,
              suggested: analysis.suggested,
              applied: analysis.suggested,
            }),
          }),
        })
        const createdJson = (await created.json()) as { asset?: PublicMediaAsset; error?: string }
        if (!created.ok || !createdJson.asset) throw new Error(createdJson.error || 'save_failed')
        const form = new FormData()
        form.set('file', item.file)
        const uploaded = await fetch(`/api/media/assets/${createdJson.asset.id}/file`, {
          method: 'POST',
          body: form,
        })
        if (!uploaded.ok) {
          await fetch(`/api/media/assets/${createdJson.asset.id}?hard=1`, { method: 'DELETE' })
          throw new Error('save_failed')
        }
        createdIds.push(createdJson.asset.id)
        setItems((current) =>
          current.map((row) =>
            row.localId === item.localId ? { ...row, status: 'done' } : row,
          ),
        )
      } catch (caught) {
        setItems((current) =>
          current.map((row) =>
            row.localId === item.localId
              ? {
                  ...row,
                  status: 'error',
                  error: caught instanceof Error ? caught.message : 'save_failed',
                }
              : row,
          ),
        )
      } finally {
        completed += 1
        setProgress({ current: completed, total: queue.length })
      }
    })

    let reorderFailed = false
    if (createdIds.length > 0) {
      const existingIds = existing.flatMap((draft) => (draft.persisted ? [draft.persisted.id] : []))
      const ordered = insertAtPosition(existingIds, createdIds, insertAt)
      const reorder = await fetch('/api/media/assets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: 'hero', ids: ordered }),
      })
      reorderFailed = !reorder.ok
    }
    setBusy(false)
    if (createdIds.length > 0) {
      await onDone(createdIds, reorderFailed)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5">
        <h2 className="text-xl font-black">{tMedia(locale, 'actionBatchAdd')}</h2>
        <p className="mt-1 text-sm text-cdl-muted">{tMedia(locale, 'batchHint')}</p>
        <p className="mt-1 text-xs font-semibold text-cdl-muted">
          {tMedia(locale, 'batchLimit', { count: MEDIA_BATCH_LIMIT })}
        </p>
        <label
          className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cdl-border px-4 text-sm font-semibold"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          {tMedia(locale, 'actionBatchAdd')}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []))
              event.currentTarget.value = ''
            }}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="text-sm font-semibold">
            {tMedia(locale, 'batchInsertAt')}
            <input
              type="number"
              min={1}
              className="ml-2 min-h-10 w-20 rounded-lg border border-cdl-border px-2"
              value={insertAt}
              onChange={(event) => setInsertAt(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activateAfter}
              onChange={(event) => setActivateAfter(event.target.checked)}
            />
            {tMedia(locale, 'batchActivateAfter')}
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.localId} className="rounded-2xl border border-cdl-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" className="h-36 w-full rounded-xl object-cover" />
              <p className="mt-2 text-xs font-bold">SEQ. {String(index + 1).padStart(2, '0')}</p>
              <p className="truncate text-xs text-cdl-muted">{item.file.name}</p>
              <p className="text-xs text-cdl-muted">{Math.round(item.size / 1024)} KB</p>
              <p className="text-xs font-semibold uppercase">
                {item.status === 'waiting'
                  ? tMedia(locale, 'batchWaiting')
                  : item.status === 'sending'
                    ? tMedia(locale, 'batchSending')
                    : item.status === 'done'
                      ? tMedia(locale, 'batchDone')
                      : item.status === 'ignored'
                        ? tMedia(locale, 'batchIgnore')
                        : tMedia(locale, 'batchError')}
              </p>
              {item.duplicate && item.status !== 'ignored' ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-amber-700">{tMedia(locale, 'batchDuplicate')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-cdl-border px-2 py-1 text-xs font-semibold"
                      onClick={() =>
                        setItems((current) =>
                          current.map((row) =>
                            row.localId === item.localId ? { ...row, status: 'ignored' } : row,
                          ),
                        )
                      }
                    >
                      {tMedia(locale, 'batchIgnore')}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-cdl-border px-2 py-1 text-xs font-semibold"
                      onClick={() =>
                        setItems((current) =>
                          current.map((row) =>
                            row.localId === item.localId ? { ...row, sendAnyway: true } : row,
                          ),
                        )
                      }
                    >
                      {tMedia(locale, 'batchSendAnyway')}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-cdl-border px-2 py-1 text-xs"
                  onClick={() => moveItem(item.localId, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-cdl-border px-2 py-1 text-xs"
                  onClick={() => moveItem(item.localId, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-cdl-border px-2 py-1 text-xs"
                  onClick={() =>
                    setItems((current) => current.filter((row) => row.localId !== item.localId))
                  }
                >
                  {tMedia(locale, 'actionRemoveFromBatch')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {busy ? (
          <p className="mt-4 text-sm font-semibold">
            {tMedia(locale, 'batchProgress', {
              current: progress.current,
              total: progress.total,
            })}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || ready.length === 0}
            className="min-h-11 rounded-xl bg-[var(--cdl-action)] px-5 text-sm font-black uppercase text-white disabled:opacity-50"
            onClick={() => void importReady(false)}
          >
            {tMedia(locale, 'actionImportBatch', { count: ready.length })}
          </button>
          <button
            type="button"
            disabled={busy || items.every((item) => item.status !== 'error')}
            className="min-h-11 rounded-xl border border-cdl-border px-5 text-sm font-semibold"
            onClick={() => void importReady(true)}
          >
            {tMedia(locale, 'actionRetryFailed', {
              count: items.filter((item) => item.status === 'error').length,
            })}
          </button>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-xl border border-cdl-border px-5 text-sm font-semibold"
            onClick={onClose}
          >
            {tMedia(locale, 'actionCancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
