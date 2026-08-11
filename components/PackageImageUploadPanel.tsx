'use client'

import CatalogImageFrame from '@/components/CatalogImageFrame'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type PackageRow = {
  id: string
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  image_url?: string | null
}

function getPackageLabel(pkg: PackageRow) {
  return (
    pkg.label_pt?.trim() ||
    pkg.package_name?.trim() ||
    pkg.package_key?.trim() ||
    pkg.id
  )
}

function getPackageImage(pkg: PackageRow) {
  return pkg.image_url ?? null
}

export default function PackageImageUploadPanel({
  packages,
}: {
  packages: PackageRow[]
}) {
  const locale = useAuthLocaleFromMe()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(packages[0]?.id ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = packages.find((pkg) => pkg.id === selectedId) ?? null
  const previewUrl = selected ? getPackageImage(selected) : null

  async function handleUpload(file: File | null) {
    if (!file || !selectedId) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/packages/${selectedId}/image`, {
        method: 'POST',
        body: formData,
      })
      const result = (await response.json()) as {
        image_url?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error ?? tCommon(locale, 'uploadFail'))
      }

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

  if (packages.length === 0) {
    return (
      <p className="text-sm text-cdl-muted">{tPackages(locale, 'noActivePackages')}</p>
    )
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="cdl-eyebrow">{tCommon(locale, 'package')}</span>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setError(null)
            setSuccess(null)
          }}
          className="mt-1 w-full rounded-xl border border-cdl-border bg-cdl-inset px-3 py-3 text-sm text-cdl-fg"
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {getPackageLabel(pkg)}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-inset">
        <CatalogImageFrame
          src={previewUrl}
          alt={selected ? getPackageLabel(selected) : tCommon(locale, 'package')}
          variant="package"
          rounded="none"
        />
      </div>

      <label className="block">
        <span className="cdl-eyebrow">{tCommon(locale, 'newImage')}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            void handleUpload(file)
          }}
          className="mt-1 w-full rounded-xl border border-cdl-border bg-cdl-surface px-3 py-3 text-sm text-cdl-fg file:mr-3 file:rounded-lg file:border-0 file:bg-cdl-accent file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:text-cdl-on-accent"
        />
      </label>

      <p className="text-xs text-cdl-muted">
        {tPackages(locale, 'packageBucketHint')}
      </p>

      {uploading ? (
        <p className="text-sm text-cdl-muted">{tPackages(locale, 'uploadingImage')}</p>
      ) : null}
      {error ? <p className="text-sm text-cdl-action">{error}</p> : null}
      {success ? <p className="text-sm text-cdl-success">{success}</p> : null}
    </div>
  )
}
