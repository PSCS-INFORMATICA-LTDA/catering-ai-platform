/**
 * Canonical application origin for Supabase auth redirects (invite, reset, etc.).
 * Prefers explicit NEXT_PUBLIC_APP_URL, then request origin, then Vercel host.
 */
export function getAppOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (configured) return configured

  if (request) {
    return new URL(request.url).origin
  }

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return vercel.startsWith('http')
      ? vercel.replace(/\/$/, '')
      : `https://${vercel.replace(/\/$/, '')}`
  }

  return 'http://localhost:3000'
}

/** Redirect target after invite email confirmation establishes a session. */
export function inviteAuthCallbackUrl(request?: Request): string {
  const origin = getAppOrigin(request)
  return `${origin}/auth/callback?next=/quotes`
}
