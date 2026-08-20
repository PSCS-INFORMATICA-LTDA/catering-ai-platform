/**
 * Fetch a remote package image as a data URI for @react-pdf/renderer.
 * Failures are swallowed so a missing/blocked asset never breaks the PDF.
 */
export async function resolveRemoteImageForPdf(
  url?: string | null,
): Promise<string | null> {
  const src = url?.trim()
  if (!src || !/^https?:\/\//i.test(src)) return null
  try {
    const response = await fetch(src, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim()
    if (mime && !mime.startsWith('image/')) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < 32 || buffer.length > 6_000_000) return null
    const safeMime = mime.startsWith('image/') ? mime : 'image/jpeg'
    return `data:${safeMime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}
