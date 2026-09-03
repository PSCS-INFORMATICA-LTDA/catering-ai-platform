import type { SupabaseClient } from '@supabase/supabase-js'
import { PACKAGE_IMAGES_BUCKET } from '../packageImageStorage'
import { validateBatchImageFile } from './batchValidate'
import {
  PACKAGE_FOLDER_DRAFT_PREFIX,
  parseSlotKey,
  type PackageFolderLocale,
} from './packageFolderSlots'

export type PackageFolderDraft = {
  slotKey: string
  packageKey: string
  locale: PackageFolderLocale
  fileName: string
  path: string
  url: string
  updatedAt: string | null
  size: number | null
}

function publicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${PACKAGE_IMAGES_BUCKET}/${path}`
}

export function validatePackageFolderDraftFile(file: {
  name: string
  type: string
  size: number
}) {
  return validateBatchImageFile(file)
}

export function draftObjectPath(
  packageKey: string,
  locale: PackageFolderLocale,
  fileName: string,
) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  return `${PACKAGE_FOLDER_DRAFT_PREFIX}/${packageKey}__${locale}__${Date.now()}__${safe}`
}

export async function listPackageFolderDrafts(client: SupabaseClient) {
  const { data, error } = await client.storage
    .from(PACKAGE_IMAGES_BUCKET)
    .list(PACKAGE_FOLDER_DRAFT_PREFIX, {
      limit: 200,
      sortBy: { column: 'updated_at', order: 'desc' },
    })
  if (error) return { drafts: [] as PackageFolderDraft[], error: error.message }
  const drafts: PackageFolderDraft[] = []
  for (const item of data ?? []) {
    if (!item.name || item.name.endsWith('/')) continue
    const parts = item.name.split('__')
    if (parts.length < 3) continue
    const parsed = parseSlotKey(`${parts[0]}__${parts[1]}`)
    if (!parsed) continue
    const path = `${PACKAGE_FOLDER_DRAFT_PREFIX}/${item.name}`
    drafts.push({
      slotKey: `${parsed.packageKey}__${parsed.locale}`,
      packageKey: parsed.packageKey,
      locale: parsed.locale,
      fileName: item.name,
      path,
      url: publicUrl(path),
      updatedAt: item.updated_at ?? item.created_at ?? null,
      size: item.metadata?.size ?? null,
    })
  }
  return { drafts, error: null }
}

export async function listPublishedFolderObjects(client: SupabaseClient) {
  const { data, error } = await client.storage
    .from(PACKAGE_IMAGES_BUCKET)
    .list('cdl-folders-v3', { limit: 200 })
  if (error) return { files: [] as string[], error: error.message }
  return {
    files: (data ?? []).map((item) => item.name).filter(Boolean),
    error: null,
  }
}

export async function uploadPackageFolderDraft(
  client: SupabaseClient,
  input: {
    packageKey: string
    locale: PackageFolderLocale
    file: File
  },
) {
  const invalid = validatePackageFolderDraftFile(input.file)
  if (invalid) return { draft: null, error: invalid }
  const path = draftObjectPath(input.packageKey, input.locale, input.file.name)
  const { error } = await client.storage.from(PACKAGE_IMAGES_BUCKET).upload(path, input.file, {
    cacheControl: '60',
    upsert: false,
    contentType: input.file.type,
  })
  if (error) return { draft: null, error: error.message }
  return {
    draft: {
      slotKey: `${input.packageKey}__${input.locale}`,
      packageKey: input.packageKey,
      locale: input.locale,
      fileName: path.split('/').pop() || path,
      path,
      url: publicUrl(path),
      updatedAt: new Date().toISOString(),
      size: input.file.size,
    } satisfies PackageFolderDraft,
    error: null,
  }
}
