'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { tMedia } from '@/Lib/i18n/media'
import { suggestFocusFromFile } from '@/Lib/media/autoFocus'
import {
  defaultEditorMeta,
  emptyMediaCopy,
  nextDisplayOrder,
  parseCssFocus,
  persistableEditorMeta,
} from '@/Lib/media/editorMeta'
import type { MediaCatalogImageItem, PublicMediaAsset } from '@/Lib/media/types'
import { getCompanyPublicHeroMedia } from '@/Lib/publicQuote/companyPublicHeroMedia'
import HeroBatchImporter from './HeroBatchImporter'
import HeroDeviceCompare from './HeroDeviceCompare'
import HeroFocusEditor from './HeroFocusEditor'
import HeroMediaCard, { type HeroDraft } from './HeroMediaCard'

type Tab = 'hero' | 'how_it_works' | 'video' | 'packages' | 'additionals'

const TABS: Tab[] = ['hero', 'how_it_works', 'video', 'packages', 'additionals']

function tabLabel(tab: Tab, locale: string) {
  if (tab === 'hero') return tMedia(locale, 'tabHero')
  if (tab === 'how_it_works') return tMedia(locale, 'tabHow')
  if (tab === 'video') return tMedia(locale, 'tabVideos')
  if (tab === 'packages') return tMedia(locale, 'tabPackages')
  return tMedia(locale, 'tabAdditionals')
}

function apiErrorMessage(locale: string, error?: string) {
  if (error === 'delete_referenced') return tMedia(locale, 'deleteReferenced')
  if (error === 'delete_forbidden') return tMedia(locale, 'deleteForbidden')
  if (error === 'file_too_large') return tMedia(locale, 'fileTooLarge')
  if (error === 'invalid_type' || error === 'invalidFile') return tMedia(locale, 'invalidFile')
  if (error === 'reorder_failed') return tMedia(locale, 'batchReorderFailed')
  return tMedia(locale, 'saveFailed')
}

function catalogHint(asset: PublicMediaAsset) {
  return getCompanyPublicHeroMedia('cdl').find(
    (item) => item.id === asset.entity_key || item.src === asset.media_url,
  )
}

function seedEditor(asset: PublicMediaAsset) {
  if (asset.editorStored) return persistableEditorMeta(asset.editor)
  const hint = catalogHint(asset)
  if (!hint) return defaultEditorMeta(asset.editor)
  const mobile = parseCssFocus(hint.mobilePosition)
  const desktop = parseCssFocus(hint.desktopPosition)
  return defaultEditorMeta({
    overlayDecided: asset.editor.overlayDecided,
    overlayEnabled: asset.editor.overlayEnabled,
    overlayPosition: hint.captionAlign ?? asset.editor.overlayPosition,
    suggested: { mobile, tablet: mobile, desktop },
    applied: { mobile, tablet: mobile, desktop },
  })
}

function seedCopy(asset: PublicMediaAsset) {
  const hint = catalogHint(asset)
  return emptyMediaCopy({
    title_pt: asset.title_pt || hint?.caption?.pt || '',
    title_en: asset.title_en || hint?.caption?.en || '',
    title_es: asset.title_es || hint?.caption?.es || '',
    subtitle_pt: asset.subtitle_pt || '',
    subtitle_en: asset.subtitle_en || '',
    subtitle_es: asset.subtitle_es || '',
  })
}

function toDraft(asset: PublicMediaAsset, importedIds: string[] = []): HeroDraft {
  return {
    id: asset.id,
    persisted: asset,
    sequence: asset.display_order,
    active: asset.active,
    entityKey: asset.entity_key || '',
    mediaUrl: asset.media_url,
    pendingFile: null,
    editor: seedEditor(asset),
    copy: seedCopy(asset),
    preview: 'mobile',
    dirty: false,
    saving: false,
    savedFlash: false,
    confirmDelete: false,
    showAdvanced: false,
    lightbox: false,
    selected: false,
    imported: importedIds.includes(asset.id),
  }
}

export default function MediaContentManager({
  locale,
  canManage,
  canDelete = false,
}: {
  locale: string
  canManage: boolean
  canDelete?: boolean
}) {
  const [tab, setTab] = useState<Tab>('hero')
  const [drafts, setDrafts] = useState<HeroDraft[]>([])
  const [catalog, setCatalog] = useState<MediaCatalogImageItem[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [orderDirty, setOrderDirty] = useState(false)
  const [adding, setAdding] = useState(false)
  const [batching, setBatching] = useState(false)
  const [addFile, setAddFile] = useState<File | null>(null)
  const [addPreview, setAddPreview] = useState<string | null>(null)
  const [addDraft, setAddDraft] = useState<HeroDraft | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<string[]>([])
  const [onlyImported, setOnlyImported] = useState(false)

  const loadAssets = useCallback(async (placement: Tab, keepImported = importedIds) => {
    if (placement === 'packages' || placement === 'additionals') return
    const response = await fetch(`/api/media/assets?placement=${placement}`, {
      cache: 'no-store',
    })
    const json = (await response.json()) as { assets?: PublicMediaAsset[]; error?: string }
    if (!response.ok) throw new Error(json.error || 'load_failed')
    setDrafts((json.assets ?? []).map((asset) => toDraft(asset, keepImported)))
    setOrderDirty(false)
  }, [importedIds])

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

  const visibleDrafts = useMemo(
    () =>
      drafts.filter((draft) => {
        if (onlyImported && !draft.imported) return false
        const hay = `${draft.entityKey} ${draft.copy.title_pt}`.toLowerCase()
        return hay.includes(query.trim().toLowerCase())
      }),
    [drafts, onlyImported, query],
  )
  const selectedIds = drafts.filter((draft) => draft.selected && draft.persisted).map((draft) => draft.persisted!.id)
  const focusDraft = drafts.find((draft) => draft.id === focusId) ?? addDraft
  const compareDraft = drafts.find((draft) => draft.id === compareId) ?? addDraft

  function updateDraft(id: string, next: HeroDraft) {
    setAddDraft((current) => (current?.id === id ? next : current))
    setDrafts((current) => current.map((draft) => (draft.id === id ? next : draft)))
  }

  function moveDraft(id: string, direction: -1 | 1) {
    setDrafts((current) => {
      const index = current.findIndex((draft) => draft.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      if (!item) return current
      copy.splice(nextIndex, 0, item)
      setOrderDirty(true)
      return copy.map((draft, order) => ({ ...draft, sequence: order + 1, dirty: true }))
    })
  }

  async function saveDraft(draft: HeroDraft) {
    if (!canManage || draft.saving) return false
    updateDraft(draft.id, { ...draft, saving: true })
    try {
      let working = draft
      let assetId = working.persisted?.id ?? null
      if (!assetId) {
        const created = await fetch('/api/media/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placement: 'hero',
            media_type: 'image',
            display_order: working.sequence,
            active: working.active,
            editor: working.editor,
            title_pt: working.copy.title_pt,
            title_en: working.copy.title_en,
            title_es: working.copy.title_es,
            subtitle_pt: working.copy.subtitle_pt,
            subtitle_en: working.copy.subtitle_en,
            subtitle_es: working.copy.subtitle_es,
          }),
        })
        const createdJson = (await created.json()) as { asset?: PublicMediaAsset; error?: string }
        if (!created.ok || !createdJson.asset) {
          throw new Error(createdJson.error || 'save_failed')
        }
        assetId = createdJson.asset.id
        working = { ...working, persisted: createdJson.asset }
        updateDraft(working.id, { ...working, saving: true })
      }

      if (working.pendingFile && assetId) {
        const form = new FormData()
        form.set('file', working.pendingFile)
        const uploaded = await fetch(`/api/media/assets/${assetId}/file`, {
          method: 'POST',
          body: form,
        })
        const uploadedJson = (await uploaded.json()) as { error?: string }
        if (!uploaded.ok) throw new Error(uploadedJson.error || 'save_failed')
      }

      const response = await fetch(`/api/media/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: working.active,
          editor: working.editor,
          title_pt: working.copy.title_pt,
          title_en: working.copy.title_en,
          title_es: working.copy.title_es,
          subtitle_pt: working.copy.subtitle_pt,
          subtitle_en: working.copy.subtitle_en,
          subtitle_es: working.copy.subtitle_es,
        }),
      })
      const json = (await response.json()) as { asset?: PublicMediaAsset; error?: string }
      if (!response.ok || !json.asset) throw new Error(json.error || 'save_failed')
      updateDraft(working.id, {
        ...toDraft(json.asset, importedIds),
        dirty: false,
        saving: false,
        savedFlash: true,
        preview: working.preview,
      })
      return true
    } catch (caught) {
      updateDraft(draft.id, { ...draft, saving: false })
      setError(apiErrorMessage(locale, caught instanceof Error ? caught.message : 'save_failed'))
      return false
    }
  }

  async function saveOrder() {
    if (!canManage) return
    setBusy(true)
    try {
      const ids = drafts.flatMap((draft) => (draft.persisted ? [draft.persisted.id] : []))
      const response = await fetch('/api/media/assets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: tab === 'hero' ? 'hero' : tab, ids }),
      })
      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || 'reorder_failed')
      await loadAssets(tab)
    } catch {
      setError(tMedia(locale, 'saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function normalizeOrder() {
    if (!canManage || tab !== 'hero') return
    setBusy(true)
    try {
      const response = await fetch('/api/media/assets/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: 'hero' }),
      })
      if (!response.ok) throw new Error('save_failed')
      await loadAssets('hero')
    } catch {
      setError(tMedia(locale, 'saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function bulkActive(active: boolean) {
    if (!canManage || selectedIds.length === 0) return
    setBusy(true)
    try {
      const response = await fetch('/api/media/assets/bulk-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, active }),
      })
      if (!response.ok) throw new Error('save_failed')
      await loadAssets(tab)
    } catch {
      setError(tMedia(locale, 'saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft(draft: HeroDraft) {
    if (!draft.persisted) {
      setDrafts((current) => current.filter((item) => item.id !== draft.id))
      return
    }
    const response = await fetch(`/api/media/assets/${draft.persisted.id}?hard=1`, {
      method: 'DELETE',
    })
    const json = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(apiErrorMessage(locale, json.error))
      updateDraft(draft.id, { ...draft, confirmDelete: false })
      return
    }
    setDrafts((current) => current.filter((item) => item.id !== draft.id))
  }

  async function openAdd(file?: File) {
    const sequence = nextDisplayOrder(drafts.map((draft) => draft.sequence))
    let preview = null
    let editor = defaultEditorMeta()
    if (file) {
      preview = URL.createObjectURL(file)
      const analysis = await suggestFocusFromFile(file)
      editor = defaultEditorMeta({
        focusMode: 'auto',
        overlayEnabled: false,
        overlayDecided: true,
        suggested: analysis.suggested,
        applied: analysis.suggested,
      })
    }
    setAddFile(file ?? null)
    setAddPreview(preview)
    setAddDraft({
      id: `draft-${Date.now()}`,
      persisted: null,
      sequence,
      active: false,
      entityKey: '',
      mediaUrl: preview,
      pendingFile: file ?? null,
      editor,
      copy: emptyMediaCopy(),
      preview: 'mobile',
      dirty: true,
      saving: false,
      savedFlash: false,
      confirmDelete: false,
      showAdvanced: false,
      lightbox: false,
      selected: false,
      imported: false,
    })
    setAdding(true)
  }

  async function saveNew() {
    if (!addDraft || !addFile) return
    const ok = await saveDraft({
      ...addDraft,
      pendingFile: addFile,
      mediaUrl: addPreview,
    })
    if (!ok) return
    setAdding(false)
    setAddDraft(null)
    setAddFile(null)
    setAddPreview(null)
    await loadAssets('hero')
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
      setError(apiErrorMessage(locale, json.error))
      return
    }
    setCatalog((current) =>
      current.map((item) =>
        item.id === id ? { ...item, imageUrl: json.imageUrl ?? item.imageUrl } : item,
      ),
    )
  }

  return (
    <div className="space-y-6" data-media-content-manager data-hero-ux="v3">
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
        {canManage && tab === 'hero' ? (
          <>
            <button
              type="button"
              className="min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white"
              onClick={() => void openAdd()}
            >
              {tMedia(locale, 'actionAdd')}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-bold"
              onClick={() => setBatching(true)}
            >
              {tMedia(locale, 'actionBatchAdd')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-bold"
              onClick={() => void normalizeOrder()}
            >
              {tMedia(locale, 'actionNormalize')}
            </button>
          </>
        ) : null}
        {canManage && orderDirty && tab === 'hero' ? (
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-bold"
            onClick={() => void saveOrder()}
          >
            {tMedia(locale, 'saveOrder')}
          </button>
        ) : null}
        {canManage && selectedIds.length > 0 ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-bold"
              onClick={() => void bulkActive(true)}
            >
              {tMedia(locale, 'actionActivateSelected')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-bold"
              onClick={() => void bulkActive(false)}
            >
              {tMedia(locale, 'actionDeactivateSelected')}
            </button>
          </>
        ) : null}
        {importedIds.length > 0 ? (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={onlyImported}
              onChange={(event) => setOnlyImported(event.target.checked)}
            />
            {tMedia(locale, 'batchImportedFilter')}
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {tab === 'hero' ? (
        <div className="space-y-4" data-media-playlist>
          {visibleDrafts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-cdl-border p-6 text-sm text-cdl-muted">
              {tMedia(locale, 'empty')}
            </p>
          ) : null}
          {visibleDrafts.map((draft, index) => (
            <HeroMediaCard
              key={draft.id}
              locale={locale}
              draft={draft}
              canManage={canManage}
              canDelete={canDelete}
              isFirst={index === 0}
              isLast={index === visibleDrafts.length - 1}
              onChange={(next) => updateDraft(draft.id, next)}
              onMove={(direction) => moveDraft(draft.id, direction)}
              onSave={() => void saveDraft(draft)}
              onDelete={() => void deleteDraft(draft)}
              onAdjustFocus={() => setFocusId(draft.id)}
            />
          ))}
        </div>
      ) : tab === 'packages' || tab === 'additionals' ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog
            .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
            .map((item) => (
              <li key={item.id} className="rounded-2xl border border-cdl-border bg-cdl-surface p-4">
                <div className="h-36 overflow-hidden rounded-xl bg-neutral-100">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
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
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-2xl border border-cdl-border bg-cdl-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong>{draft.copy.title_pt || draft.entityKey}</strong>
                <button
                  type="button"
                  disabled={!canManage || draft.saving}
                  className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-bold text-white"
                  onClick={() => void saveDraft(draft)}
                >
                  {tMedia(locale, 'actionSave')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && addDraft ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5">
            <h2 className="text-xl font-black">{tMedia(locale, 'addTitle')}</h2>
            <p className="mt-1 text-sm text-cdl-muted">{tMedia(locale, 'addHint')}</p>
            <p className="mt-1 text-xs font-semibold text-cdl-muted">
              {tMedia(locale, 'defaultInactiveHint')}
            </p>
            <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-cdl-border px-4 text-sm font-semibold">
              {tMedia(locale, 'actionReplace')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void openAdd(file)
                }}
              />
            </label>
            {addFile ? (
              <div className="mt-4">
                <HeroMediaCard
                  locale={locale}
                  draft={addDraft}
                  canManage={canManage}
                  canDelete={false}
                  isFirst
                  isLast
                  onChange={setAddDraft}
                  onMove={() => undefined}
                  onSave={() => void saveNew()}
                  onDelete={() => undefined}
                  onAdjustFocus={() => setFocusId(addDraft.id)}
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-cdl-border px-5 text-sm font-semibold"
                onClick={() => {
                  setAdding(false)
                  setAddDraft(null)
                  setAddFile(null)
                  setAddPreview(null)
                }}
              >
                {tMedia(locale, 'actionCancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {batching ? (
        <HeroBatchImporter
          locale={locale}
          existing={drafts}
          onClose={() => setBatching(false)}
          onDone={async (ids, reorderFailed) => {
            setImportedIds(ids)
            setOnlyImported(true)
            setBatching(false)
            if (reorderFailed) setError(tMedia(locale, 'batchReorderFailed'))
            await loadAssets('hero', ids)
          }}
        />
      ) : null}

      {focusDraft && focusId ? (
        <HeroFocusEditor
          locale={locale}
          draft={focusDraft}
          onChange={(next) => updateDraft(focusDraft.id, next)}
          onClose={() => setFocusId(null)}
          onCompare={() => setCompareId(focusDraft.id)}
        />
      ) : null}

      {compareDraft && compareId ? (
        <HeroDeviceCompare
          locale={locale}
          draft={compareDraft}
          onClose={() => setCompareId(null)}
        />
      ) : null}
    </div>
  )
}
