/**
 * Validação de ambientes canônicos — Catering AI Platform
 * Não imprime secrets. Somente leitura.
 *
 * npm run verify:env:canonical
 * npm run verify:env:homologation
 * npm run verify:env:production
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CANONICAL_PROD_HOST = 'cateringai.app'
const CANONICAL_HML_HOST = 'h.cateringai.app'

const failures = []
const blocks = []

function fail(msg) {
  failures.push(msg)
}

function block(msg) {
  blocks.push(msg)
}

function readEnvLocal() {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return {}
  const map = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    map[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return map
}

const modeArg = process.argv.find((a) => a.startsWith('--mode='))
const envMode = (modeArg ? modeArg.slice(7) : null) || process.env.CANONICAL_ENV_MODE || 'local'

console.log(`verify-canonical-environments mode=${envMode}`)
console.log(
  `canonical_targets hml=https://${CANONICAL_HML_HOST} prod=https://${CANONICAL_PROD_HOST}`,
)
console.log('APP=Catering | HML=h.cateringai.app | PROD=cateringai.app (domínio definido)')

const local = envMode === 'local' ? readEnvLocal() : {}
const configuredAppUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.SITE_URL ||
  local.NEXT_PUBLIC_APP_URL ||
  local.APP_URL ||
  local.SITE_URL ||
  ''
).replace(/\/$/, '')

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL || ''

if (supabaseUrl.includes(PROD_REF) && envMode !== 'production') {
  fail('Supabase PROD detectado fora do modo production')
}
if (supabaseUrl.includes(DEV_REF) && envMode === 'production') {
  fail('Supabase DEV detectado no modo production')
}

if (envMode === 'homologation' || envMode === 'hml') {
  console.log(`ENV=Homologation DOMAIN=${CANONICAL_HML_HOST} SUPABASE=${DEV_REF}`)
  if (!configuredAppUrl) {
    block('BLOCKED_DOMAIN_NOT_CONFIGURED — NEXT_PUBLIC_APP_URL ausente para HML')
  } else if (configuredAppUrl !== `https://${CANONICAL_HML_HOST}`) {
    fail(
      `HML APP_URL deve ser https://${CANONICAL_HML_HOST} (recebido host não canônico)`,
    )
  }
  if (supabaseUrl && !supabaseUrl.includes(DEV_REF)) {
    fail('Homologação deve usar Supabase DEV')
  }
  if (supabaseUrl && supabaseUrl.includes(PROD_REF)) {
    fail('Homologação não pode apontar para Supabase PROD')
  }
  // Probe DNS/HTTPS do host canônico (somente leitura)
  try {
    const res = await fetch(`https://${CANONICAL_HML_HOST}/`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
    console.log(`hml_https_probe status=${res.status}`)
    if (res.status === 0) {
      block('BLOCKED_DOMAIN_NOT_CONFIGURED — HTTPS sem resposta em h.cateringai.app')
    }
  } catch (err) {
    block(
      `BLOCKED_DOMAIN_NOT_CONFIGURED — h.cateringai.app sem DNS/HTTPS Ready (${err?.cause?.code || err?.message || 'fetch failed'})`,
    )
  }
}

if (envMode === 'production') {
  if (!configuredAppUrl) {
    block('BLOCKED_DOMAIN_NOT_CONFIGURED — NEXT_PUBLIC_APP_URL ausente para PROD')
  } else if (configuredAppUrl !== `https://${CANONICAL_PROD_HOST}`) {
    fail(
      `PROD APP_URL deve ser https://${CANONICAL_PROD_HOST} (recebido host não canônico)`,
    )
  }
  if (supabaseUrl && !supabaseUrl.includes(PROD_REF)) {
    fail('Produção deve usar Supabase PROD')
  }
  block('BLOCKED_DOMAIN_NOT_CONFIGURED — cateringai.app não verificado na Vercel')
}

if (envMode === 'local') {
  if (configuredAppUrl && /\.vercel\.app$/i.test(configuredAppUrl)) {
    fail('APP_URL local não deve ser marcada como canônica com *.vercel.app')
  }
}

if (failures.length) {
  console.error('CANONICAL ENVIRONMENTS: FAIL')
  for (const f of failures) console.error(`- ${f}`)
  process.exit(1)
}

if (blocks.length) {
  console.error('CANONICAL ENVIRONMENTS: BLOCKED_DOMAIN_NOT_CONFIGURED')
  for (const b of blocks) console.error(`- ${b}`)
  process.exit(2)
}

console.log('CANONICAL ENVIRONMENTS: PASS')
