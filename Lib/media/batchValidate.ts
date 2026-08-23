import {
  ALLOWED_PUBLIC_IMAGE_TYPES,
  MAX_PUBLIC_IMAGE_BYTES,
} from './constants'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export function extensionOf(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ext
}

export function validateBatchImageFile(file: { name: string; type: string; size: number }) {
  if (!file || file.size <= 0) return 'empty_file'
  const ext = extensionOf(file.name)
  if (!IMAGE_EXTENSIONS.has(ext)) return 'invalid_type'
  if (!ALLOWED_PUBLIC_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'invalid_type'
  }
  if (file.size > MAX_PUBLIC_IMAGE_BYTES) return 'file_too_large'
  return null
}

export async function hashFile(file: Blob) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function noStoreJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
