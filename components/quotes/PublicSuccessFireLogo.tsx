'use client'

import CdlFireSignature from '@/components/quotes/CdlFireSignature'

/**
 * Success closing mark. Fire is the web-native signature — never the archived MP4.
 */
export default function PublicSuccessFireLogo({
  src,
  alt,
}: {
  src?: string | null
  alt: string
}) {
  return <CdlFireSignature src={src} alt={alt} />
}
