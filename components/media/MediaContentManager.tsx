'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import type { PublicMediaAsset } from '@/Lib/media/types'
import type { MediaCatalogImageItem } from '@/Lib/media/types'

type Tab = 'hero' | 'how_it_works' | 'video' | 'packages' | 'additionals'
type PreviewMode = 'mobile' | 'tablet' | 'desktop'

const TABS: Tab[] = ['hero', 'how_it_works', 'video', 'packages', 'additionals']

function tabLabel(tab: Tab, locale: string) {
  if (tab === 'hero') return tMedia(locale, 'tabHero')
  if (tab === 'how_it_works') return tMedia(locale, 'tabHow')
  if (tab === 'video') return tMedia(locale, 'tabVideos')
  if (tab === 'packages') return tMedia(locale, 'tabPackages')
  return tMedia(locale, 'tabAdditionals')
}

function statusLabel(status: string, locale: string) {
  if (status === 'inactive') return tMedia(locale, 'statusInactive')
  if (status === 'draft') return tMedia(locale, 'statusDraft')
  return tMedia(locale, 'statusActive')
}

export default function MediaContentManager({
  locale,
  canManage,
}: {
  locale: string
  canManage: boolean
}) {
  const [tab, setTab] = useState<Tab>('hero')
  const [preview, setPreview] = useState<PreviewMode>('mobile')
  const [assets, setAssets] = useState<PublicMediaAsset[]>([])
  const [catalog, setCatalog] = useState<MediaCatalogImageItem[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadAssets = useCallback(async (placement: Tab) => {
    if (placement === 'packages' || placement === 'additionals') return
    const response = await fetch(`/api/media/assets?placement=${placement}`)
    const json = (await response.json()) as { assets?: PublicMediaAsset[]; error?: string }
    if (!response.ok) throw new Error(json.error || 'load_failed')
    setAssets(json.assets ?? [])
  }, [])

  const loadCatalog = useCallback(async (kind: 'packages' | 'additionals') => {
    const response = await fetch(`/api/media/catalog?kind=${kind}`)
    const json = (await response.json()) as { items?: MediaCatalogImageItem[]; error?: string }
    if (!response.ok) throw new Error(json.error || 'load_failed')
    setCatalog(json.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (tab === 'packages' || tab === 'additionals') {
          await loadCatalog(tab)
        } else {
          await loadAssets(tab)
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAssets, loadCatalog, tab])

  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const hay = `${asset.entity_key} ${asset.label_pt} ${asset.title_pt}`.toLowerCase()
        return hay.includes(query.trim().toLowerCase())
      }),
    [assets, query],
  )
  const visibleCatalog = useMemo(
    () =>
      catalog.filter((item) =>
        item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [catalog, query],
  )

  async function patchAsset(id: string, body: Record<string, unknown>) {
    setBusy(true)
    try {
      const response = await fetch(`/api/media/assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await response.json()) as { asset?: PublicMediaAsset; error?: string }
      if (!response.ok) throw new Error(json.error || 'update_failed')
      setAssets((current) =>
        current.map((asset) => (asset.id === id ? (json.asset as PublicMediaAsset) : asset)),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'error')
    } finally {
      setBusy(false)
    }
  }

  async function addAsset() {
    if (!canManage) return
    setBusy(true)
    try {
      const response = await fetch('/api/media/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placement: tab,
          media_type: tab === 'video' ? 'video' : 'image',
          entity_key: tab === 'video' ? 'pt' : `item-${Date.now()}`,
          status: 'draft',
          display_order: assets.length + 1,
        }),
      })
      const json = (await response.json()) as { asset?: PublicMediaAsset; error?: string }
      if (!response.ok) throw new Error(json.error || 'insert_failed')
      if (json.asset) setAssets((current) => [...current, json.asset as PublicMediaAsset])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'error')
    } finally {
      setBusy(false)
    }
  }

  async function uploadAsset(id: string, file: File, kind: 'media' | 'poster' = 'media') {
    const form = new FormData()
    form.set('file', file)
    form.set('kind', kind)
    const response = await fetch(`/api/media/assets/${id}/file`, {
      method: 'POST',
      body: form,
    })
    const json = (await response.json()) as { asset?: PublicMediaAsset; error?: string }
    if (!response.ok) {
      setError(
        json.error === 'file_too_large'
          ? tMedia(locale, 'fileTooLarge')
          : tMedia(locale, 'invalidFile'),
      )
      return
    }
    if (json.asset) {
      setAssets((current) =>
        current.map((asset) => (asset.id === id ? (json.asset as PublicMediaAsset) : asset)),
      )
    }
  }

  async function moveAsset(id: string, direction: -1 | 1) {
    const index = assets.findIndex((asset) => asset.id === id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= assets.length) return
    const ids = [...assets]
    const [item] = ids.splice(index, 1)
    if (!item) return
    ids.splice(next, 0, item)
    setAssets(ids)
    await fetch('/api/media/assets/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.map((asset) => asset.id) }),
    })
  }

  async function uploadCatalog(kind: 'packages' | 'additionals', id: string, file: File) {
    const form = new FormData()
    form.set('file', file)
    const response = await fetch(`/api/media/catalog/${kind}/${id}/image`, {
      method: 'POST',
      body: form,
    })
    const json = (await response.json()) as { imageUrl?: string; error?: string }
    if (!response.ok) {
      setError(json.error || tMedia(locale, 'invalidFile'))
      return
    }
    setCatalog((current) =>
      current.map((item) =>
        item.id === id ? { ...item, imageUrl: json.imageUrl ?? item.imageUrl } : item,
      ),
    )
  }

  const previewWidth =
    preview === 'mobile' ? 'w-[360px]' : preview === 'tablet' ? 'w-[768px]' : 'w-full max-w-5xl'
  const selectedPreview = visibleAssets.find((asset) => asset.media_url) ?? visibleAssets[0]

  return (
    <div className="space-y-6" data-media-content-manager>
      <header className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-cdl-title">
          {tMedia(locale, 'title')}
        </h1>
        <p className="text-sm text-cdl-muted">{tMedia(locale, 'subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => {
              setTab(item)
              setQuery('')
              setError(null)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === item
                ? 'bg-[var(--brand-primary)] text-white'
                : 'border border-cdl-border bg-cdl-surface text-cdl-title'
            }`}
          >
            {tabLabel(item, locale)}
          </button>
        ))}
      </div>

      {tab === 'how_it_works' ? (
        <p className="rounded-2xl border border-cdl-border bg-cdl-surface px-4 py-3 text-sm text-cdl-muted">
          {tMedia(locale, 'howPhaseNote')}
        </p>
      ) : null}
      {tab === 'packages' || tab === 'additionals' ? (
        <p className="rounded-2xl border border-cdl-border bg-cdl-surface px-4 py-3 text-sm text-cdl-muted">
          {tMedia(locale, 'catalogMediaOnly')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="media-search">
          {tMedia(locale, 'search')}
        </label>
        <input
          id="media-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tMedia(locale, 'search')}
          className="min-h-11 w-full max-w-sm rounded-xl border border-cdl-border bg-white px-3 text-sm"
        />
        {canManage && tab !== 'packages' && tab !== 'additionals' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void addAsset()}
            className="min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white"
          >
            {tMedia(locale, 'actionAdd')}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {tab !== 'packages' && tab !== 'additionals' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <ul className="space-y-3">
            {visibleAssets.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-cdl-border p-6 text-sm text-cdl-muted">
                {tMedia(locale, 'empty')}
              </li>
            ) : null}
            {visibleAssets.map((asset, index) => (
              <li
                key={asset.id}
                className="rounded-2xl border border-cdl-border bg-cdl-surface p-4 shadow-sm"
                draggable={canManage}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', asset.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const fromId = event.dataTransfer.getData('text/plain')
                  if (!fromId || fromId === asset.id) return
                  const from = assets.findIndex((row) => row.id === fromId)
                  const to = assets.findIndex((row) => row.id === asset.id)
                  if (from < 0 || to < 0) return
                  const next = [...assets]
                  const [moved] = next.splice(from, 1)
                  if (!moved) return
                  next.splice(to, 0, moved)
                  setAssets(next)
                  void fetch('/api/media/assets/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: next.map((row) => row.id) }),
                  })
                }}
              >
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {asset.media_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.poster_url || asset.media_url}
                        alt={asset.alt_pt || asset.label_pt || ''}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-cdl-title">
                        {asset.entity_key || asset.label_pt || asset.id.slice(0, 8)}
                      </strong>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                        {statusLabel(asset.status, locale)}
                      </span>
                      <span className="text-[11px] text-cdl-faint">
                        {asset.placement} · {asset.variant || 'original'}
                      </span>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold"
                          onClick={() =>
                            void patchAsset(asset.id, {
                              status: asset.status === 'active' ? 'inactive' : 'active',
                            })
                          }
                        >
                          {asset.status === 'active'
                            ? tMedia(locale, 'actionDeactivate')
                            : tMedia(locale, 'actionActivate')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold"
                          disabled={index === 0}
                          onClick={() => void moveAsset(asset.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold"
                          disabled={index === visibleAssets.length - 1}
                          onClick={() => void moveAsset(asset.id, 1)}
                        >
                          ↓
                        </button>
                        <label className="rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold">
                          {tMedia(locale, 'actionReplace')}
                          <input
                            type="file"
                            className="sr-only"
                            accept={tab === 'video' ? 'video/mp4,video/webm' : 'image/*'}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) void uploadAsset(asset.id, file)
                              event.currentTarget.value = ''
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                    {canManage ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className="min-h-10 rounded-lg border border-cdl-border px-2 text-sm"
                          defaultValue={asset.entity_key ?? ''}
                          placeholder={tMedia(locale, 'internalName')}
                          onBlur={(event) =>
                            void patchAsset(asset.id, { entity_key: event.target.value })
                          }
                        />
                        <input
                          className="min-h-10 rounded-lg border border-cdl-border px-2 text-sm"
                          defaultValue={asset.title_pt ?? ''}
                          placeholder="PT"
                          onBlur={(event) =>
                            void patchAsset(asset.id, { title_pt: event.target.value })
                          }
                        />
                        <input
                          className="min-h-10 rounded-lg border border-cdl-border px-2 text-sm"
                          defaultValue={asset.title_en ?? ''}
                          placeholder="EN"
                          onBlur={(event) =>
                            void patchAsset(asset.id, { title_en: event.target.value })
                          }
                        />
                        <input
                          className="min-h-10 rounded-lg border border-cdl-border px-2 text-sm"
                          defaultValue={asset.title_es ?? ''}
                          placeholder="ES"
                          onBlur={(event) =>
                            void patchAsset(asset.id, { title_es: event.target.value })
                          }
                        />
                        <label className="flex items-center gap-2 text-xs text-cdl-muted">
                          <span>FX</span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            className="min-h-10 w-full rounded-lg border border-cdl-border px-2"
                            defaultValue={asset.focal_x ?? 0.5}
                            onBlur={(event) =>
                              void patchAsset(asset.id, { focal_x: Number(event.target.value) })
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-cdl-muted">
                          <span>FY</span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            className="min-h-10 w-full rounded-lg border border-cdl-border px-2"
                            defaultValue={asset.focal_y ?? 0.5}
                            onBlur={(event) =>
                              void patchAsset(asset.id, { focal_y: Number(event.target.value) })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['mobile', 'tablet', 'desktop'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreview(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                    preview === mode
                      ? 'bg-neutral-900 text-white'
                      : 'border border-cdl-border text-cdl-title'
                  }`}
                >
                  {tMedia(locale, mode === 'mobile' ? 'previewMobile' : mode === 'tablet' ? 'previewTablet' : 'previewDesktop')}
                </button>
              ))}
            </div>
            <div
              data-media-preview={preview}
              className={`overflow-hidden rounded-3xl border border-cdl-border bg-neutral-950 ${previewWidth}`}
            >
              <div className="relative aspect-[9/16] max-h-[28rem] w-full">
                {selectedPreview?.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPreview.media_url}
                    alt={selectedPreview.alt_pt || ''}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${Math.round((selectedPreview.focal_x ?? 0.5) * 100)}% ${Math.round((selectedPreview.focal_y ?? 0.5) * 100)}%`,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/60">
                    {tMedia(locale, 'empty')}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCatalog.map((item) => (
            <li key={item.id} className="rounded-2xl border border-cdl-border bg-cdl-surface p-4">
              <div className="h-36 overflow-hidden rounded-xl bg-neutral-100">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-cdl-title">{item.name}</p>
              {canManage ? (
                <label className="mt-2 inline-flex rounded-lg border border-cdl-border px-3 py-1 text-xs font-semibold">
                  {tMedia(locale, 'actionReplace')}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void uploadCatalog(tab, item.id, file)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
