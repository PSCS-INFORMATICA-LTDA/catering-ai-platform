'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import type { PackageFolderLocale } from '@/Lib/media/packageFolderSlots'

type Draft = {
  slotKey: string
  url: string
  fileName: string
  updatedAt: string | null
}

type Slot = {
  slotKey: string
  familyKey: string
  packageKey: string
  packageName: string
  locale: PackageFolderLocale
  variant: 'with_sides' | 'without_sides'
  variantLabel: string
  fileName: string | null
  publishedUrl: string | null
  usedIn: string
  status: 'published' | 'missing'
  drafts: Draft[]
}

export default function PackageFolderMatrix({
  locale,
  canManage,
}: {
  locale: string
  canManage: boolean
}) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [orphans, setOrphans] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    title: string
    usedIn: string
    liveUrl: string | null
    draftUrl: string | null
  } | null>(null)
  const [busySlot, setBusySlot] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/media/package-folders', { cache: 'no-store' })
    const json = (await response.json()) as {
      slots?: Slot[]
      orphans?: string[]
      error?: string
    }
    if (!response.ok) throw new Error(json.error || 'load_failed')
    setSlots(json.slots ?? [])
    setOrphans(json.orphans ?? [])
  }, [])

  useEffect(() => {
    void load().catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'error')
    })
  }, [load])

  const families = useMemo(() => {
    const order: string[] = []
    const grouped = new Map<string, Slot[]>()
    for (const slot of slots) {
      if (!grouped.has(slot.familyKey)) {
        order.push(slot.familyKey)
        grouped.set(slot.familyKey, [])
      }
      grouped.get(slot.familyKey)?.push(slot)
    }
    return order.map((familyKey) => ({
      familyKey,
      name: slots.find((slot) => slot.familyKey === familyKey)?.packageName || familyKey,
      slots: grouped.get(familyKey) ?? [],
    }))
  }, [slots])

  async function uploadDraft(slot: Slot, file: File) {
    setBusySlot(slot.slotKey)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('slotKey', slot.slotKey)
      const response = await fetch('/api/media/package-folders/draft', {
        method: 'POST',
        body: form,
      })
      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || 'upload_failed')
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === 'invalid_type'
          ? tMedia(locale, 'invalidFile')
          : caught instanceof Error && caught.message === 'file_too_large'
            ? tMedia(locale, 'fileTooLarge')
            : tMedia(locale, 'saveFailed'),
      )
    } finally {
      setBusySlot(null)
    }
  }

  return (
    <section className="space-y-5" data-media-package-folders>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {tMedia(locale, 'packageLiveFrozen')}
      </div>
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {families.map((family) => (
        <article key={family.familyKey} className="rounded-2xl border border-cdl-border bg-cdl-surface p-4">
          <h3 className="text-lg font-black text-cdl-title">{family.name}</h3>
          <p className="text-xs font-semibold text-cdl-muted">{family.familyKey}</p>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {family.slots.map((slot) => {
              const latestDraft = slot.drafts[0] ?? null
              return (
                <li
                  key={slot.slotKey}
                  className="rounded-xl border border-cdl-border bg-white p-3"
                  data-package-slot={slot.slotKey}
                >
                  <div className="flex gap-3">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {slot.publishedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slot.publishedUrl}
                          alt={slot.usedIn}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-bold text-cdl-title">
                        {slot.locale.toUpperCase()} · {slot.variantLabel}
                      </p>
                      <p className="text-xs text-cdl-muted">
                        {tMedia(locale, 'packageKey')}: {slot.packageKey}
                      </p>
                      <p className="text-xs text-cdl-muted">
                        {tMedia(locale, 'usedIn')}: {slot.usedIn}
                      </p>
                      <p className="text-xs text-cdl-muted">
                        {tMedia(locale, 'status')}: {tMedia(locale, 'statusPublishedLive')}
                      </p>
                      <p className="truncate text-xs text-cdl-muted">{slot.fileName}</p>
                      {latestDraft ? (
                        <p className="text-xs font-semibold text-amber-800">
                          {tMedia(locale, 'draftReady')} · {latestDraft.fileName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold"
                      onClick={() =>
                        setPreview({
                          title: `${slot.packageName} · ${slot.locale.toUpperCase()}`,
                          usedIn: slot.usedIn,
                          liveUrl: slot.publishedUrl,
                          draftUrl: latestDraft?.url ?? null,
                        })
                      }
                    >
                      {tMedia(locale, 'actionPreview')}
                    </button>
                    {canManage ? (
                      <label className="inline-flex cursor-pointer rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold">
                        {busySlot === slot.slotKey
                          ? tMedia(locale, 'actionSaving')
                          : tMedia(locale, 'actionPrepareVersion')}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) void uploadDraft(slot, file)
                            event.currentTarget.value = ''
                          }}
                        />
                      </label>
                    ) : null}
                    <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold text-cdl-muted">
                      {tMedia(locale, 'actionSubmitReview')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </article>
      ))}

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-4" data-media-orphans>
        <h3 className="text-base font-black text-cdl-title">{tMedia(locale, 'unusedAssets')}</h3>
        <p className="mt-1 text-sm text-cdl-muted">{tMedia(locale, 'unusedAssetsHint')}</p>
        {orphans.length === 0 ? (
          <p className="mt-3 text-sm text-cdl-muted">{tMedia(locale, 'unusedAssetsEmpty')}</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {orphans.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </section>

      {preview ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5">
            <h3 className="text-lg font-black">{preview.title}</h3>
            <p className="text-sm text-cdl-muted">{preview.usedIn}</p>
            <p className="mt-2 text-xs font-semibold text-cdl-muted">
              {tMedia(locale, 'isolatedPreviewHint')}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-6">
              <figure className="w-[390px] max-w-full">
                <figcaption className="mb-2 text-xs font-bold uppercase tracking-wide">
                  {tMedia(locale, 'statusPublishedLive')}
                </figcaption>
                <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
                  {preview.liveUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.liveUrl} alt="" className="w-full object-contain" />
                  ) : null}
                </div>
              </figure>
              {preview.draftUrl ? (
                <figure className="w-[390px] max-w-full">
                  <figcaption className="mb-2 text-xs font-bold uppercase tracking-wide">
                    {tMedia(locale, 'draftReady')}
                  </figcaption>
                  <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.draftUrl} alt="" className="w-full object-contain" />
                  </div>
                </figure>
              ) : null}
            </div>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-xl border border-cdl-border px-5 text-sm font-semibold"
              onClick={() => setPreview(null)}
            >
              {tMedia(locale, 'actionCancel')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
