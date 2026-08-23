'use client'

import CdlFireSignature from '@/components/quotes/CdlFireSignature'

/**
 * Success closing mark. Official fire MP4 is treated; never raw rectangular video.
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
