import type { createClient } from '@/Lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export type AuthIdentity = {
  id: string
  email: string | null
  fullName: string | null
}

export type AuthVerificationMeta = {
  strategy: 'getClaims' | 'getUser'
  getUserNetworkCallRequired: boolean
  jwksCacheAvailable: boolean
  asymmetricSigningKey: boolean | null
  durationMs: number
}

function readAlg(header: { alg?: string } | null | undefined): string | null {
  const alg = header?.alg?.trim()
  return alg || null
}

function isAsymmetricAlg(alg: string | null): boolean | null {
  if (!alg) return null
  return /^(RS|ES|PS|EdDSA)/i.test(alg)
}

/**
 * Prefer getClaims() (local JWT + JWKS when the signing key is asymmetric).
 * Fall back to getUser() without using getSession().user as authorization.
 */
export async function resolveAuthIdentity(
  supabase: SupabaseServer,
): Promise<{
  identity: AuthIdentity | null
  meta: AuthVerificationMeta
}> {
  const claimsFn = supabase.auth.getClaims
  if (typeof claimsFn === 'function') {
    const started = Date.now()
    try {
      const { data, error } = await supabase.auth.getClaims()
      const durationMs = Date.now() - started
      const claims = data?.claims as
        | {
            sub?: string
            email?: string
            user_metadata?: { full_name?: string }
          }
        | undefined
      const alg = readAlg(data?.header as { alg?: string } | undefined)
      if (!error && claims?.sub) {
        const meta: AuthVerificationMeta = {
          strategy: 'getClaims',
          getUserNetworkCallRequired: false,
          jwksCacheAvailable: true,
          asymmetricSigningKey: isAsymmetricAlg(alg),
          durationMs,
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[auth-timing]', {
            step: 'getClaims',
            ms: durationMs,
            alg,
            asymmetric: meta.asymmetricSigningKey,
          })
        }
        return {
          identity: {
            id: claims.sub,
            email: claims.email ?? null,
            fullName: claims.user_metadata?.full_name ?? null,
          },
          meta,
        }
      }
    } catch {
      /* fall through to getUser */
    }
  }

  const started = Date.now()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const durationMs = Date.now() - started
  const meta: AuthVerificationMeta = {
    strategy: 'getUser',
    getUserNetworkCallRequired: true,
    jwksCacheAvailable: false,
    asymmetricSigningKey: null,
    durationMs,
  }
  if (process.env.NODE_ENV !== 'production') {
    console.info('[auth-timing]', { step: 'getUser', ms: durationMs })
  }
  if (!user) return { identity: null, meta }
  return {
    identity: {
      id: user.id,
      email: user.email ?? null,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        null,
    },
    meta,
  }
}
