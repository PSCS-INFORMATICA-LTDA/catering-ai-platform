/**
 * URL canônica do aplicativo por ambiente.
 *
 * Homologação oficial: https://h.cateringai.app
 * Produção oficial:    https://cateringai.app
 *   (domínio definido — promoção funcional de Production NÃO executada nesta fase)
 *
 * Não hardcodar o domínio nos consumidores — usar este helper + NEXT_PUBLIC_APP_URL.
 */

export type CanonicalAppUrlStatus =
  | 'configured'
  | 'development_localhost'
  | 'technical_preview'
  | 'blocked_domain_not_configured'

export type CanonicalAppUrlResult = {
  /** Origem absoluta sem barra final, ou null se bloqueado. */
  origin: string | null
  status: CanonicalAppUrlStatus
  /** true somente quando origin é o canônico configurado (não Preview aleatório). */
  isCanonical: boolean
}

function trimOrigin(value: string | null | undefined): string | null {
  const v = value?.trim().replace(/\/$/, '')
  return v ? v : null
}

function isLocalhost(origin: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(origin)
}

function isVercelDeploymentHost(origin: string): boolean {
  return /\.vercel\.app$/i.test(origin)
}

/**
 * Resolve a URL pública do app.
 *
 * Prioridade:
 * 1. NEXT_PUBLIC_APP_URL (canônico por ambiente — obrigatório em HML/PROD)
 * 2. localhost em Development
 * 3. VERCEL_URL / window.location apenas como Preview técnico interno
 *
 * Em HML/PROD sem NEXT_PUBLIC_APP_URL → blocked (não inventa fallback oficial).
 */
export function resolveCanonicalAppUrl(options?: {
  /** Força modo (testes). */
  nodeEnv?: string
  vercelEnv?: string | null
  configuredAppUrl?: string | null
  vercelUrl?: string | null
  windowOrigin?: string | null
}): CanonicalAppUrlResult {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development'
  const vercelEnv =
    options?.vercelEnv ?? process.env.VERCEL_ENV ?? null
  const configured = trimOrigin(
    options?.configuredAppUrl ?? process.env.NEXT_PUBLIC_APP_URL,
  )
  const vercelUrl = trimOrigin(
    options?.vercelUrl ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null),
  )
  const windowOrigin =
    options?.windowOrigin !== undefined
      ? trimOrigin(options.windowOrigin)
      : typeof window !== 'undefined'
        ? trimOrigin(window.location.origin)
        : null

  if (configured) {
    return {
      origin: configured,
      status: 'configured',
      isCanonical: !isVercelDeploymentHost(configured),
    }
  }

  if (nodeEnv === 'development' || vercelEnv === 'development') {
    if (windowOrigin && isLocalhost(windowOrigin)) {
      return {
        origin: windowOrigin,
        status: 'development_localhost',
        isCanonical: false,
      }
    }
    return {
      origin: 'http://localhost:3000',
      status: 'development_localhost',
      isCanonical: false,
    }
  }

  // Preview / Production sem APP_URL configurado: não inventar domínio canônico.
  if (vercelEnv === 'production' || vercelEnv === 'preview') {
    if (vercelUrl || (windowOrigin && !isLocalhost(windowOrigin))) {
      return {
        origin: vercelUrl ?? windowOrigin,
        status: 'technical_preview',
        isCanonical: false,
      }
    }
    return {
      origin: null,
      status: 'blocked_domain_not_configured',
      isCanonical: false,
    }
  }

  if (windowOrigin && !isLocalhost(windowOrigin)) {
    return {
      origin: windowOrigin,
      status: isVercelDeploymentHost(windowOrigin)
        ? 'technical_preview'
        : 'configured',
      isCanonical: !isVercelDeploymentHost(windowOrigin),
    }
  }

  return {
    origin: null,
    status: 'blocked_domain_not_configured',
    isCanonical: false,
  }
}

/** Atalho: origem absoluta ou null. */
export function getCanonicalAppUrl(): string | null {
  return resolveCanonicalAppUrl().origin
}

/**
 * Compatível com geradores de link (proposta, guarnição, equipe).
 * Preferir getCanonicalAppUrl() em código novo.
 * Em blocked, lança erro explícito (não usa *.vercel.app como oficial).
 */
export function requireCanonicalAppUrl(): string {
  const result = resolveCanonicalAppUrl()
  if (result.origin) return result.origin
  throw new Error('CANONICAL ENVIRONMENTS: BLOCKED_DOMAIN_NOT_CONFIGURED')
}
