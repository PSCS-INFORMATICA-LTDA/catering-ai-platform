/**
 * Configure and verify the public self-service quote kill switches in DEV.
 *
 * Usage:
 *   node scripts/dev/configure-public-self-service-quote.mjs
 *   node scripts/dev/configure-public-self-service-quote.mjs --enable --apply
 *   node scripts/dev/configure-public-self-service-quote.mjs --disable --apply
 *   node scripts/dev/configure-public-self-service-quote.mjs --verify
 *
 * The script refuses every Supabase project except the canonical DEV project.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const FEATURE_KEY = 'public_self_service_quote'

function parseEnvFile() {
  const contents = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (key) => {
    const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    anon: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = new URL(url).hostname.split('.')[0]
  if (ref === PROD_REF) throw new Error('BLOQUEADO: configuração aponta para PROD')
  if (ref !== DEV_REF) {
    throw new Error(`BLOQUEADO: project-ref ${ref || 'desconhecido'}; esperado ${DEV_REF}`)
  }
  return ref
}

function parseArguments(args) {
  const apply = args.includes('--apply')
  const verifyOnly = args.includes('--verify')
  const enable = args.includes('--enable')
  const disable = args.includes('--disable')
  if (enable && disable) throw new Error('Use apenas --enable ou --disable')
  if (apply && !enable && !disable) throw new Error('--apply exige --enable ou --disable')
  const slugArgument = args.find((arg) => arg.startsWith('--slug='))
  const slug = (slugArgument?.slice('--slug='.length) || 'cdl').trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Slug inválido')
  return { apply, verifyOnly, desired: enable ? true : disable ? false : null, slug }
}

async function expectAnonDenied(anonClient, table) {
  const { data, error } = await anonClient.from(table).select('*').limit(1)
  if (!error && (data?.length ?? 0) > 0) {
    throw new Error(`RLS_FAIL: anon leu dados de ${table}`)
  }
  console.log(`PASS anon_no_rows ${table}`)
}

async function loadState(serviceClient, slug) {
  const companyResult = await serviceClient
    .from('companies')
    .select('id, slug, active')
    .eq('slug', slug)
    .maybeSingle()
  if (companyResult.error) throw companyResult.error
  if (!companyResult.data) throw new Error(`Empresa não encontrada: ${slug}`)

  const companyId = companyResult.data.id
  const [settingsResult, featureResult, packageResult] = await Promise.all([
    serviceClient
      .from('company_public_quote_settings')
      .select('enabled, allowed_languages, allowed_countries, consent_version')
      .eq('company_id', companyId)
      .maybeSingle(),
    serviceClient
      .from('company_features')
      .select('enabled')
      .eq('company_id', companyId)
      .eq('feature_key', FEATURE_KEY)
      .maybeSingle(),
    serviceClient
      .from('packages')
      .select('id, card_theme_key')
      .eq('company_id', companyId)
      .eq('active', true),
  ])

  for (const result of [settingsResult, featureResult, packageResult]) {
    if (result.error) throw result.error
  }
  if (!settingsResult.data) throw new Error('Configuração pública não foi semeada')
  if (!featureResult.data) throw new Error('Feature flag pública não foi semeada')

  const allowedThemes = new Set([
    'gold',
    'bronze',
    'navy',
    'emerald',
    'burgundy',
    'slate',
  ])
  const invalidTheme = (packageResult.data ?? []).find(
    (pkg) => !pkg.card_theme_key || !allowedThemes.has(pkg.card_theme_key),
  )
  if (invalidTheme) throw new Error(`Tema inválido no pacote ${invalidTheme.id}`)

  return {
    company: companyResult.data,
    settings: settingsResult.data,
    feature: featureResult.data,
    activePackageCount: packageResult.data?.length ?? 0,
  }
}

async function verify(serviceClient, anonClient, slug) {
  const state = await loadState(serviceClient, slug)
  if (!state.company.active) throw new Error('Empresa está inativa')
  if (!state.settings.allowed_languages.includes('pt')) throw new Error('Locale pt ausente')
  if (state.settings.allowed_languages.some((locale) => !['pt', 'en', 'es'].includes(locale))) {
    throw new Error('Locale público fora da whitelist')
  }
  if (state.activePackageCount < 1) throw new Error('Nenhum pacote ativo para publicação')

  await Promise.all([
    expectAnonDenied(anonClient, 'company_public_quote_settings'),
    expectAnonDenied(anonClient, 'public_quote_intake_sessions'),
    expectAnonDenied(anonClient, 'public_quote_rate_limits'),
  ])

  console.log(`PASS project_ref ${DEV_REF}`)
  console.log(`PASS company ${state.company.slug}`)
  console.log(`PASS settings_enabled ${state.settings.enabled}`)
  console.log(`PASS feature_enabled ${state.feature.enabled}`)
  console.log(`PASS locales ${state.settings.allowed_languages.join(',')}`)
  console.log(`PASS countries ${state.settings.allowed_countries.join(',')}`)
  console.log(`PASS active_packages ${state.activePackageCount}`)
  console.log(`PASS consent_version ${state.settings.consent_version}`)
  return state
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const env = parseEnvFile()
  if (!env.url || !env.anon || !env.service) throw new Error('.env.local DEV incompleto')
  assertDev(env.url)

  const serviceClient = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anonClient = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const before = await verify(serviceClient, anonClient, options.slug)
  if (options.verifyOnly || options.desired === null) {
    console.log('RESULT=VERIFIED')
    return
  }
  if (!options.apply) {
    console.log(`PLAN settings.enabled=${options.desired}`)
    console.log(`PLAN ${FEATURE_KEY}.enabled=${options.desired}`)
    console.log('DRY_RUN=OK')
    return
  }

  const companyId = before.company.id
  const settingsUpdate = await serviceClient
    .from('company_public_quote_settings')
    .update({ enabled: options.desired })
    .eq('company_id', companyId)
    .select('company_id')
    .single()
  if (settingsUpdate.error) throw settingsUpdate.error

  const featureUpdate = await serviceClient
    .from('company_features')
    .update({ enabled: options.desired })
    .eq('company_id', companyId)
    .eq('feature_key', FEATURE_KEY)
    .select('company_id')
    .single()
  if (featureUpdate.error) {
    await serviceClient
      .from('company_public_quote_settings')
      .update({ enabled: before.settings.enabled })
      .eq('company_id', companyId)
    throw featureUpdate.error
  }

  const after = await verify(serviceClient, anonClient, options.slug)
  if (after.settings.enabled !== options.desired || after.feature.enabled !== options.desired) {
    throw new Error('Verificação pós-escrita não confirmou os dois kill switches')
  }
  console.log(`RESULT=${options.desired ? 'ENABLED' : 'DISABLED'}_IN_DEV`)
  console.log('PROD_ALTERADO=NAO')
}

main().catch((error) => {
  console.error(`PUBLIC_QUOTE_CONFIG_FAILED: ${error.message || error}`)
  process.exit(1)
})
