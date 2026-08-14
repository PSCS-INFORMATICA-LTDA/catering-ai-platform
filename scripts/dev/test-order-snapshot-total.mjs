/**
 * Teste — imutabilidade do snapshot comercial da Ordem de Serviço
 *
 * Confirma que o total gravado em `service_orders` / `quote_versions` NÃO
 * recalcula com o catálogo atual (ADR quote-order-data-model-decision §3):
 * mesmo que o preço do pacote mude depois da conversão, a OS já convertida
 * mantém o total original (fixture 2830).
 *
 * Pré-requisito: `node scripts/dev/test-quote-to-order-conversion.mjs` (cria a OS de teste).
 *
 * Uso:
 *   node scripts/dev/test-order-snapshot-total.mjs
 *
 * Project Ref obrigatório: yasprgtlqclwsjcshtls
 * PROD proibido: eapwtirhevxrqinytans
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATH = join(__dirname, 'fixtures', 'catering-functional-validation-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CONVERT_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000002'
const EXPECTED_TOTAL = 2830

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — CONFIGURACAO APONTA PARA PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — Project Ref inesperado: ${ref} (esperado ${DEV_REF})`)
    process.exit(2)
  }
  return ref
}

function fail(msg) {
  console.log(`TEST ORDER SNAPSHOT TOTAL: FAIL — ${msg}`)
  process.exit(1)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST ORDER SNAPSHOT TOTAL (imutabilidade) ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: quote, error: quoteError } = await client
    .from('quotes')
    .select('id, converted_service_order_id, quote_total')
    .eq('id', CONVERT_TEST_QUOTE_ID)
    .maybeSingle()
  if (quoteError) fail(`consultar cotação de teste: ${quoteError.message}`)
  if (!quote?.converted_service_order_id) {
    fail('cotação de teste ainda não convertida — rode `node scripts/dev/test-quote-to-order-conversion.mjs` primeiro')
  }

  const { data: order, error: orderError } = await client
    .from('service_orders')
    .select('id, service_order_total, package_total, commercial_snapshot')
    .eq('id', quote.converted_service_order_id)
    .single()
  if (orderError) fail(`consultar OS: ${orderError.message}`)

  console.log('--- 1) total gravado na OS bate com o fixture ---')
  if (Number(order.service_order_total) !== EXPECTED_TOTAL) {
    fail(`service_order_total=${order.service_order_total}, esperado ${EXPECTED_TOTAL}`)
  }
  const snapshotTotal = Number(order.commercial_snapshot?.quote_total)
  if (snapshotTotal !== EXPECTED_TOTAL) {
    fail(`commercial_snapshot.quote_total=${snapshotTotal}, esperado ${EXPECTED_TOTAL}`)
  }
  console.log(`  OK service_order_total=${order.service_order_total} snapshot.quote_total=${snapshotTotal}`)

  console.log('\n--- 2) alterar preço do pacote no catálogo não deve afetar a OS já convertida ---')
  const packageId = fx.ids.pkgEssential
  const { data: pkgBefore, error: pkgReadError } = await client
    .from('packages')
    .select('id, price_per_person')
    .eq('id', packageId)
    .maybeSingle()
  if (pkgReadError || !pkgBefore) {
    console.log('  SKIP — pacote fixture pkgEssential indisponível (rode npm run seed:dev:functional)')
  } else {
    const originalPrice = pkgBefore.price_per_person
    const bumpedPrice = roundMoney(Number(originalPrice || 0) + 999)
    try {
      const { error: bumpError } = await client
        .from('packages')
        .update({ price_per_person: bumpedPrice })
        .eq('id', packageId)
      if (bumpError) fail(`alterar preço do pacote (setup do teste): ${bumpError.message}`)

      const { data: orderAfter, error: orderAfterError } = await client
        .from('service_orders')
        .select('service_order_total, package_total, commercial_snapshot')
        .eq('id', order.id)
        .single()
      if (orderAfterError) fail(`reler OS após mudança de catálogo: ${orderAfterError.message}`)

      if (Number(orderAfter.service_order_total) !== EXPECTED_TOTAL) {
        fail(
          `OS recalculou com o catálogo atual! service_order_total=${orderAfter.service_order_total} (esperado imutável ${EXPECTED_TOTAL})`,
        )
      }
      console.log(
        `  OK OS permanece com service_order_total=${orderAfter.service_order_total} mesmo após pacote mudar para price_per_person=${bumpedPrice}`,
      )
    } finally {
      await client.from('packages').update({ price_per_person: originalPrice }).eq('id', packageId)
      console.log(`  OK preço do pacote restaurado (price_per_person=${originalPrice})`)
    }
  }

  console.log('\nTEST ORDER SNAPSHOT TOTAL: PASS')
  process.exit(0)
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
