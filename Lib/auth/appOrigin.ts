/**
 * Canonical application origin for Supabase auth redirects (invite, reset, etc.).
 *
 * Deployed environments (Vercel): NEXT_PUBLIC_APP_URL is mandatory — request Host
 * is never trusted for invite callbacks.
 *
 * Local development: localhost / request origin fallbacks are allowed.
 */

export class AppOriginConfigError extends Error {
  readonly code = 'missing_configured_origin' as const

  constructor(message: string) {
    super(message)
    this.name = 'AppOriginConfigError'
  }
}

export type AppOriginResolveInput = {
  nextPublicAppUrl?: string | null
  requestOrigin?: string | null
  vercelUrl?: string | null
  isDeployed: boolean
}

export type AppOriginResolveResult =
  | { ok: true; origin: string }
  | { ok: false; code: 'missing_configured_origin'; message: string }

export function isDeployedEnvironment(
  env: {
    VERCEL?: string
    VERCEL_ENV?: string
    NODE_ENV?: string
  } = process.env,
): boolean {
  if (env.VERCEL === '1' || env.VERCEL_ENV) return true
  return env.NODE_ENV === 'production'
}

/** Pure resolver for tests and runtime. */
export function resolveAppOrigin(input: AppOriginResolveInput): AppOriginResolveResult {
  const configured = input.nextPublicAppUrl?.trim().replace(/\/$/, '')
  if (configured) return { ok: true, origin: configured }

  if (input.isDeployed) {
    return {
      ok: false,
      code: 'missing_configured_origin',
      message:
        'NEXT_PUBLIC_APP_URL is required in deployed environments for auth redirects',
    }
  }

  if (input.requestOrigin) return { ok: true, origin: input.requestOrigin }

  const vercel = input.vercelUrl?.trim()
  if (vercel) {
    return {
      ok: true,
      origin: vercel.startsWith('http')
        ? vercel.replace(/\/$/, '')
        : `https://${vercel.replace(/\/$/, '')}`,
    }
  }

  return { ok: true, origin: 'http://localhost:3000' }
}

export function getAppOrigin(request?: Request): string {
  const resolved = resolveAppOrigin({
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin: request ? new URL(request.url).origin : null,
    vercelUrl: process.env.VERCEL_URL,
    isDeployed: isDeployedEnvironment(),
  })

  if (!resolved.ok) {
    throw new AppOriginConfigError(resolved.message)
  }

  return resolved.origin
}

/** Redirect target after invite email confirmation establishes a session. */
export function inviteAuthCallbackUrl(request?: Request): string {
  const origin = getAppOrigin(request)
  return `${origin}/auth/callback?next=/quotes`
}
