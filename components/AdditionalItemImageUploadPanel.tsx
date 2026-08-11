'use client'

import CatalogImageFrame from '@/components/CatalogImageFrame'
import type { CatalogItemListItem } from '@/Lib/fetchCatalogItems'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function getItemLabel(item: CatalogItemListItem) {
  return (
    item.label_pt?.trim() ||
    item.item_name?.trim() ||
    item.item_key?.trim() ||
    item.id
  )
}

export default function AdditionalItemImageUploadPanel({
  items,
}: {
  items: CatalogItemListItem[]
}) {
  const locale = useAuthLocaleFromMe()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    items[0]?.image_url?.trim() || null,
  )
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = items.find((item) => item.id === selectedId) ?? null

  async function handleUpload(file: File | null) {
    if (!file || !selectedId) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/additional-items/${selectedId}/image`, {
        method: 'POST',
        body: formData,
      })
      const result = (await response.json()) as {
        success?: boolean
        image_url?: string
        item?: CatalogItemListItem
        error?: string
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? tCommon(locale, 'uploadFail'))
      }

      setPreviewUrl(
        result.item?.image_url?.trim() || result.image_url?.trim() || null,
      )
      setSuccess(tCommon(locale, 'uploadSuccess'))
      router.refresh()
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : tCommon(locale, 'uploadFail'),
      )
    } finally {
      setUploading(false)
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-cdl-muted">{tPackages(locale, 'noActiveItems')}</p>
    )
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="cdl-eyebrow">{tPackages(locale, 'additionalItem')}</span>
        <select
          value={selectedId}
          onChange={(e) => {
            const nextId = e.target.value
            setSelectedId(nextId)
            const nextItem = items.find((item) => item.id === nextId)
            setPreviewUrl(nextItem?.image_url?.trim() || null)
            setError(null)
            setSuccess(null)
          }}
          className="mt-1 w-full rounded-xl border border-cdl-border bg-cdl-inset px-3 py-3 text-sm text-cdl-fg"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {getItemLabel(item)}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-inset">
        <CatalogImageFrame
          src={previewUrl}
          alt={selected ? getItemLabel(selected) : tPackages(locale, 'additionalItem')}
          variant="catalogItem"
          itemType={selected?.item_type}
          categoryPt={selected?.category_pt}
          rounded="none"
        />
      </div>

      <label className="block">
        <span className="cdl-eyebrow">{tCommon(locale, 'newImage')}</span>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            void handleUpload(file)
          }}
          className="mt-1 w-full rounded-xl border border-cdl-border bg-cdl-surface px-3 py-3 text-sm text-cdl-fg file:mr-3 file:rounded-lg file:border-0 file:bg-cdl-accent file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:text-cdl-on-accent"
        />
      </label>

      <p className="text-xs text-cdl-muted">
        {tPackages(locale, 'additionalBucketHint')}
      </p>

      {uploading ? (
        <p className="text-sm text-cdl-muted">{tPackages(locale, 'uploadingImage')}</p>
      ) : null}
      {error ? <p className="text-sm text-cdl-action">{error}</p> : null}
      {success ? <p className="text-sm text-cdl-success">{success}</p> : null}
    </div>
  )
}
