#!/usr/bin/env node
/**
 * DEV tenant isolation for public media. Never targets PROD.
 */
import { createClient } from '@supabase/supabase-js'

function decodePublicEntityKey(entityKey, placementColumn) {
  if (placementColumn) {
    return { placement: placementColumn, key: entityKey || null }
  }
  const raw = String(entityKey || '')
  const match = raw.match(/^(hero|how_it_works|video):/)
  if (!match) return { placement: null, key: raw || null }
  return { placement: match[1], key: raw.slice(match[0].length) || null }
}

function mapMediaAssetRow(row, extended) {
  const decoded = decodePublicEntityKey(row.entity_key, extended ? row.placement : null)
  return {
    ...row,
    company_id: row.company_id,
    media_url: row.media_url,
    placement: decoded.placement,
    entity_key: decoded.key,
  }
}

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const ENTITY = 'public_landing'
const ISO_URL = '/iso-isolation-probe.webp'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
if (url.includes(PROD_REF) || !url.includes(DEV_REF)) {
  console.error('REFUSING: not DEV supabase')
  process.exit(1)
}

let passed = 0
let failed = 0
function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const { error: placementProbe } = await admin.from('media_assets').select('placement').limit(1)
const extended = !placementProbe

const { data: cdlRows, error: cdlError } = await admin
  .from('media_assets')
  .select('id, company_id, entity_type, entity_key, media_url, active')
  .eq('company_id', CDL_ID)
  .eq('entity_type', ENTITY)
const { data: isoRows, error: isoError } = await admin
  .from('media_assets')
  .select('id, company_id, entity_type, entity_key, media_url, active')
  .eq('company_id', ISO_ID)
  .eq('entity_type', ENTITY)

const cdlAssets = (cdlRows ?? []).map((row) => mapMediaAssetRow(row, extended))
const isoAssets = (isoRows ?? []).map((row) => mapMediaAssetRow(row, extended))

report('ISO 01: CDL public_landing rows exist', !cdlError && cdlAssets.length > 0, String(cdlAssets.length))
report(
  'ISO 02: ISO isolation probe exists',
  !isoError && isoAssets.some((row) => row.media_url === ISO_URL),
)
report(
  'ISO 03: CDL query never returns ISO company_id',
  cdlAssets.every((row) => row.company_id === CDL_ID),
)
report(
  'ISO 04: ISO query never returns CDL company_id',
  isoAssets.every((row) => row.company_id === ISO_ID),
)
report(
  'ISO 05: CDL rows do not include ISO probe URL',
  cdlAssets.every((row) => row.media_url !== ISO_URL),
)

const { data: leaked } = await admin
  .from('media_assets')
  .update({ label_pt: 'should-not-write' })
  .eq('id', isoAssets[0]?.id || '00000000-0000-4000-8000-000000000000')
  .eq('company_id', CDL_ID)
  .select('id')
report('ISO 06: update ISO row with CDL company_id affects 0 rows', (leaked ?? []).length === 0)

const { data: grill } = await admin
  .from('media_assets')
  .select('id, entity_type')
  .eq('company_id', CDL_ID)
  .eq('entity_type', 'event')
  .eq('entity_key', 'grill_photo')
report('ISO 07: CDL grill photos remain event rows', (grill ?? []).length >= 1, String(grill?.length || 0))
report(
  'ISO 08: public_landing seed did not convert grill photos',
  (grill ?? []).every((row) => row.entity_type === 'event'),
)

const anonSelect = await anon.from('media_assets').select('id, media_url').limit(5)
const anonEmpty = !anonSelect.data || anonSelect.data.length === 0
report(
  'ISO 09: anon cannot read media_assets',
  Boolean(anonSelect.error) || anonEmpty,
  anonSelect.error?.message || `rows=${anonSelect.data?.length ?? 0}`,
)

const publicPt = await fetch('https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt', {
  redirect: 'manual',
})
const html = await publicPt.text()
report('ISO 10: public CDL page is 200', publicPt.status === 200)
report('ISO 11: public CDL HTML does not leak ISO probe', !html.includes('iso-isolation-probe'))
report(
  'ISO 12: public CDL HTML still has official hero or video',
  html.includes('/cdl/hero/') || html.includes('cdl-como-funciona'),
)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
