'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import {
  BackofficeBtnOutline,
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeEmptyState,
  BackofficeFormCard,
} from '@/components/backoffice/BackofficeCardPrimitives'
import {
  EMPTY_PACKAGE_ROW,
  PackageAdminFormFields,
  packageDraftFromListItem,
} from '@/components/backoffice/PackageAdminFormFields'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import PackageCascadeExplorer from '@/components/packages/PackageCascadeExplorer'
import PackageConfigEditor from '@/components/packages/PackageConfigEditor'
import type { AdditionalItemOption } from '@/components/packages/AdditionalItemPicker'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { PackageListItem } from '@/Lib/fetchPackages'
import type {
  PackageItem,
  PackageSideItem,
} from '@/Lib/packageConfiguration'
import {
  getPackageDescription,
  getPackageImageUrl,
  getPackageKey,
  getPackageLabel,
  mapPackageDraftToDeployed,
} from '@/Lib/packageFieldAccess'
import type { PackagesInsertPayload } from '@/Lib/packagesTableSchema'
import type { AuthLocale } from '@/Lib/i18n/authUsers'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type ActiveFilter = 'active' | 'all'

async function fetchPackagesFromApi(
  query: string,
  activeFilter: ActiveFilter,
  locale: AuthLocale,
): Promise<PackageListItem[]> {
  const params = new URLSearchParams({ _: String(Date.now()) })
  if (query.trim()) params.set('q', query.trim())
  params.set('active', activeFilter === 'all' ? 'all' : 'true')

  const response = await fetch(`/api/packages?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  const result = (await response.json()) as {
    data?: PackageListItem[]
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error ?? tPackages(locale, 'fetchError'))
  }
  return result.data ?? []
}

export default function PackagesDashboard({
  initialPackages,
  packageItems = [],
  packageSideItems = [],
  packageOptionGroups = [],
  packageOptionGroupItems = [],
  itemCatalog,
  additionalItems = [],
}: {
  initialPackages: PackageListItem[]
  packageItems?: PackageItem[]
  packageSideItems?: PackageSideItem[]
  packageOptionGroups?: PackageOptionGroupRecord[]
  packageOptionGroupItems?: PackageOptionGroupItem[]
  itemCatalog?: AdditionalItemOption[]
  /** @deprecated Use itemCatalog */
  additionalItems?: AdditionalItemOption[]
}) {
  const locale = useAuthLocaleFromMe()
  const catalogItems = itemCatalog ?? additionalItems
  const router = useRouter()
  const [packages, setPackages] = useState<PackageListItem[]>(initialPackages)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<PackagesInsertPayload>(EMPTY_PACKAGE_ROW)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [configVersion, setConfigVersion] = useState(0)
  const [livePackageItems, setLivePackageItems] = useState(packageItems)
  const [livePackageSideItems, setLivePackageSideItems] =
    useState(packageSideItems)
  const [liveOptionGroups, setLiveOptionGroups] =
    useState(packageOptionGroups)

  useEffect(() => {
    setLivePackageItems(packageItems)
    setLivePackageSideItems(packageSideItems)
    setLiveOptionGroups(packageOptionGroups)
  }, [packageItems, packageSideItems, packageOptionGroups, configVersion])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetIdRef = useRef<string | null>(null)

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return packages
    return packages.filter((pkg) =>
      [
        pkg.package_key,
        pkg.package_name,
        pkg.label_pt,
        pkg.label_en,
        pkg.label_es,
        getPackageDescription(pkg),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [packages, search])

  const refreshPackages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPackages(await fetchPackagesFromApi(search, activeFilter, locale))
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : tPackages(locale, 'refreshError'),
      )
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, locale])

  useEffect(() => {
    void refreshPackages()
  }, [activeFilter])

  function startNew() {
    setEditingId('new')
    setDraft({ ...EMPTY_PACKAGE_ROW })
  }

  function startEdit(pkg: PackageListItem) {
    setEditingId(pkg.id)
    setDraft(packageDraftFromListItem(pkg))
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({ ...EMPTY_PACKAGE_ROW })
  }

  async function saveRow() {
    setSaving(true)
    setError(null)
    try {
      const payload = mapPackageDraftToDeployed(draft)
      const url =
        editingId && editingId !== 'new' ? `/api/packages/${editingId}` : '/api/packages'
      const method = editingId && editingId !== 'new' ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? tPackages(locale, 'saveError'))
      }
      cancelEdit()
      await refreshPackages()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : tPackages(locale, 'saveErrorGeneric'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(pkg: PackageListItem) {
    const label = getPackageLabel(pkg)
    if (!window.confirm(tPackages(locale, 'deactivateConfirm', { label }))) return

    setError(null)
    const response = await fetch(`/api/packages/${pkg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(result.error ?? tPackages(locale, 'deactivateError'))
      return
    }
    setPackages((current) => current.filter((row) => row.id !== pkg.id))
  }

  function triggerUpload(pkg: PackageListItem) {
    uploadTargetIdRef.current = pkg.id
    fileInputRef.current?.click()
  }

  async function handleFileSelected(file: File | undefined) {
    const pkgId = uploadTargetIdRef.current
    if (!file || !pkgId) return

    setUploadingId(pkgId)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/packages/${pkgId}/image`, {
        method: 'POST',
        body: formData,
      })
      const result = (await response.json()) as {
        image_url?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error ?? tPackages(locale, 'uploadError'))
      }
      if (editingId === pkgId && result.image_url) {
        setDraft((current) => ({ ...current, image_url: result.image_url }))
      }
      await refreshPackages()
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : tPackages(locale, 'uploadErrorGeneric'),
      )
    } finally {
      setUploadingId(null)
      uploadTargetIdRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const editingPackage =
    editingId && editingId !== 'new'
      ? packages.find((pkg) => pkg.id === editingId) ?? null
      : null

  return (
    <BackofficeTableShell
      title={tPackages(locale, 'title')}
      subtitle={tPackages(locale, 'subtitle')}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={tPackages(locale, 'searchPlaceholder')}
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      onRefresh={() => void refreshPackages()}
      loading={loading}
      error={error}
      actions={
        <>
          <button
            type="button"
            onClick={startNew}
            className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            {tPackages(locale, 'newPackage')}
          </button>
          <Link
            href="/packages/images#pacotes"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-800 shadow-sm"
          >
            {tCommon(locale, 'images')}
          </Link>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />

      <div className="space-y-8">
        {editingId === 'new' || editingPackage ? (
          <BackofficeFormCard
            title={
              editingId === 'new'
                ? tPackages(locale, 'newPackage')
                : tPackages(locale, 'editPackage', {
                    key: getPackageKey(editingPackage ?? {}) || '—',
                  })
            }
            actions={
              <>
                <BackofficeBtnPrimary
                  onClick={() => void saveRow()}
                  disabled={saving}
                >
                  {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  {tCommon(locale, 'cancel')}
                </BackofficeBtnSecondary>
                {editingPackage ? (
                  <BackofficeBtnOutline
                    accent
                    onClick={() => triggerUpload(editingPackage)}
                    disabled={uploadingId === editingPackage.id}
                  >
                    {uploadingId === editingPackage.id
                      ? tCommon(locale, 'uploading')
                      : tCommon(locale, 'upload')}
                  </BackofficeBtnOutline>
                ) : null}
              </>
            }
          >
            {editingPackage ? (
              <div className="col-span-full mb-4 max-w-sm">
                <CatalogImageFrame
                  src={
                    String(draft.image_url ?? '').trim() ||
                    getPackageImageUrl(editingPackage)
                  }
                  alt={getPackageLabel(editingPackage)}
                  variant="package"
                  fallbackLabel={tCommon(locale, 'noImageRegistered')}
                  rounded="all"
                  className="!aspect-[4/3] !min-h-0 !max-h-none"
                />
              </div>
            ) : null}
            <PackageAdminFormFields draft={draft} setDraft={setDraft} />
            {editingPackage ? (
              <div className="col-span-full mt-6 border-t border-neutral-200 pt-6">
                <PackageConfigEditor
                  key={`${editingPackage.id}-${configVersion}`}
                  packageId={editingPackage.id}
                  itemCatalog={catalogItems}
                  onChanged={() => {
                    setConfigVersion((v) => v + 1)
                    router.refresh()
                  }}
                />
              </div>
            ) : null}
          </BackofficeFormCard>
        ) : null}

        {filteredPackages.length === 0 && editingId !== 'new' ? (
          <BackofficeEmptyState
            loading={loading}
            message={tPackages(locale, 'empty')}
          />
        ) : (
          <PackageCascadeExplorer
            packages={filteredPackages}
            packageItems={livePackageItems}
            packageSideItems={livePackageSideItems}
            packageOptionGroups={liveOptionGroups}
            packageOptionGroupItems={packageOptionGroupItems}
            onEdit={startEdit}
            onPhoto={triggerUpload}
            onDeactivate={(pkg) => void deactivate(pkg)}
            uploadingId={uploadingId}
          />
        )}
      </div>
    </BackofficeTableShell>
  )
}
