/**
 * Portable DEV env loader for Cloud + local.
 * Reads process.env first, then .env.local. Never prints secret values.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const DEV_REF = 'yasprgtlqclwsjcshtls'
export const PROD_REF = 'eapwtirhevxrqinytans'

function parseEnvFile(filePath) {
  const map = new Map()
  if (!existsSync(filePath)) return map
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return map
}

export function loadDevEnv(root) {
  const file = parseEnvFile(join(root, '.env.local'))
  const get = (key) => {
    const fromProc = process.env[key]
    if (fromProc?.trim()) return fromProc.trim()
    const fromFile = file.get(key)
    if (!fromFile) return ''
    return fromFile.trim().replace(/^["']|["']$/g, '')
  }

  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    anon: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
    googleMaps: get('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
    companyId:
      get('NEXT_PUBLIC_CDL_COMPANY_ID') ||
      get('CDL_COMPANY_ID') ||
      '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
    source: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? 'process.env'
      : existsSync(join(root, '.env.local'))
        ? '.env.local'
        : 'missing',
  }
}

export function assertDevUrl(url) {
  const ref =
    (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref === 'none' ? 'missing' : 'unknown'}`)
    process.exit(2)
  }
  return ref
}
