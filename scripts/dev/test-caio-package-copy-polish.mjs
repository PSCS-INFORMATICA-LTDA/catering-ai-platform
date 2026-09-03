/**
 * Caio package copy polish: ribs labels, Luxury before Prime, sides disposables copy.
 *
 * Run: npm run test:dev:caio-package-copy-polish
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const TIER_ORDER = ['TRAD', 'SEL', 'CHO', 'PRI', 'LUX', 'PERS']

function sortByTier(keys) {
  return [...keys].sort((a, b) => {
    const rank = (key) => {
      const base = String(key).toUpperCase().replace(/\+$/, '')
      return TIER_ORDER.findIndex((tier) => base.includes(tier))
    }
    return rank(a) - rank(b) || String(a).localeCompare(String(b))
  })
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

let passed = 0
let failed = 0

function test(name, callback) {
  try {
    callback()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const display = source('Lib/packageDisplay.ts')
const translations = source('Lib/quoteTranslations.ts')
const editorial = source('components/quotes/PackageSidesEditorial.tsx')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const extras = source('Lib/publicQuote/extrasEligibility.ts')
const phone = source('components/quotes/PublicPhoneField.tsx')

test('TIER_ORDER_PRICE_ASCENDING_PERSONALIZED_LAST', () => {
  assert.match(
    display,
    /const PACKAGE_TIER_ORDER = \['TRAD', 'SEL', 'CHO', 'PRI', 'LUX', 'PERS'\]/,
  )
  const without = sortByTier([
    'BBQPRI',
    'BBQPERS',
    'BBQTRAD',
    'BBQLUX',
    'BBQCHO',
    'BBQSEL',
  ])
  const withSides = sortByTier([
    'BBQPRI+',
    'BBQPERS+',
    'BBQTRAD+',
    'BBQLUX+',
    'BBQCHO+',
    'BBQSEL+',
  ])
  assert.deepEqual(without, [
    'BBQTRAD',
    'BBQSEL',
    'BBQCHO',
    'BBQPRI',
    'BBQLUX',
    'BBQPERS',
  ])
  assert.deepEqual(withSides, [
    'BBQTRAD+',
    'BBQSEL+',
    'BBQCHO+',
    'BBQPRI+',
    'BBQLUX+',
    'BBQPERS+',
  ])
})

test('COSTELA_COPY_PT_EN_ES', () => {
  const luxury = source('scripts/dev/apply-cdl-bbq-luxury.mjs')
  const sync = source('scripts/dev/apply-cdl-2026-real-catalog-sync.mjs')
  for (const file of [luxury, sync]) {
    assert.match(file, /Costela de Boi/)
    assert.match(file, /Costela de Porco/)
    assert.match(file, /Beef Ribs/)
    assert.match(file, /Pork Ribs/)
    assert.match(file, /Costilla de Res/)
    assert.match(file, /Costilla de Cerdo/)
  }
  assert.doesNotMatch(luxury, /Costela bovina Angus/)
  assert.doesNotMatch(sync, /COSTELA ANGUS/)
})

test('DISPOSABLES_COPY_TIED_TO_SIDES', () => {
  assert.match(
    translations,
    /Com guarnições: descartáveis incluídos — pratos, talheres e guardanapos\./,
  )
  assert.match(
    translations,
    /With side dishes: disposables included — plates, utensils and napkins\./,
  )
  assert.match(
    translations,
    /Con guarniciones: desechables incluidos — platos, cubiertos y servilletas\./,
  )
  assert.match(editorial, /includedServiceDisposablesWithSides/)
  assert.match(editorial, /data-included-service-disposables-with-sides/)
  assert.match(
    translations,
    /includedServiceBody:\s*\n\s*'Estrutura de mesas do buffet com rechauds\.'/,
  )
  assert.doesNotMatch(translations, /Descartáveis incluídos no serviço/)
  assert.doesNotMatch(editorial, /rechauds e descartáveis/)
})

test('NO_SCOPE_CREEP', () => {
  assert.match(phone, /data-phone-country/)
  assert.match(wizard, /PublicPhoneField/)
  assert.match(extras, /filterPublicExtraItemsForPackage/)
  assert.match(source('components/quotes/NoSidesDisposableKitOffer.tsx'), /data-disposable-kit-inline/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: items, error: itemErr } = await sb
  .from('catalog_items')
  .select('id,item_key,item_name,label_pt,label_en,label_es,category_key,price')
  .eq('company_id', COMPANY_ID)
  .in('item_key', ['ITEM_003', 'ITEM_014'])
if (itemErr) throw itemErr
const bovine = items.find((row) => row.item_key === 'ITEM_003')
const pork = items.find((row) => row.item_key === 'ITEM_014')

const { data: options, error: optErr } = await sb
  .from('package_option_group_items')
  .select('id,additional_item_id,label_pt,label_en,label_es,price_delta')
  .eq('company_id', COMPANY_ID)
  .in('additional_item_id', [bovine.id, pork.id])
if (optErr) throw optErr

const { data: packages, error: pkgErr } = await sb
  .from('packages')
  .select('id,package_key,price_per_person,display_order,active')
  .eq('company_id', COMPANY_ID)
if (pkgErr) throw pkgErr

test('LIVE_COSTELA_IDENTITY_AND_LABELS', () => {
  assert.equal(bovine.id, 'e36701f4-2fff-4941-b20e-c5e1a357a37b')
  assert.equal(pork.id, 'e24e111b-8db6-4d4d-8ab0-788c85274d27')
  assert.equal(bovine.category_key, 'BOVINO_TRADICIONAL')
  assert.equal(pork.category_key, 'PORCO')
  assert.equal(Number(bovine.price), 12)
  assert.equal(Number(pork.price), 12)
  assert.equal(bovine.label_pt, 'Costela de Boi')
  assert.equal(bovine.label_en, 'Beef Ribs')
  assert.equal(bovine.label_es, 'Costilla de Res')
  assert.equal(pork.label_pt, 'Costela de Porco')
  assert.equal(pork.label_en, 'Pork Ribs')
  assert.equal(pork.label_es, 'Costilla de Cerdo')
  assert.doesNotMatch(bovine.label_pt, /ANGUS/)
  assert.equal(options.length, 16)
  assert.ok(options.every((row) => Number(row.price_delta) === 0))
  const bovineOpts = options.filter((row) => row.additional_item_id === bovine.id)
  const porkOpts = options.filter((row) => row.additional_item_id === pork.id)
  assert.equal(bovineOpts.length, 8)
  assert.equal(porkOpts.length, 8)
  assert.ok(bovineOpts.every((row) => row.label_pt === 'Costela de Boi'))
  assert.ok(porkOpts.every((row) => row.label_pt === 'Costela de Porco'))
})

test('LIVE_PACKAGE_ORDER_AND_PRICES', () => {
  const byKey = Object.fromEntries(packages.map((row) => [row.package_key, row]))
  const expected = {
    BBQTRAD: [1, 45],
    BBQSEL: [2, 55],
    BBQCHO: [3, 65],
    BBQPRI: [4, 75],
    BBQLUX: [5, 150],
    BBQPERS: [6, 0],
    'BBQTRAD+': [7, 58],
    'BBQSEL+': [8, 68],
    'BBQCHO+': [9, 78],
    'BBQPRI+': [10, 88],
    'BBQLUX+': [11, 163],
    'BBQPERS+': [12, 0],
  }
  assert.equal(Object.keys(expected).length, 12)
  for (const [key, [order, price]] of Object.entries(expected)) {
    assert.ok(byKey[key], key)
    assert.equal(Number(byKey[key].display_order), order, key)
    assert.equal(Number(byKey[key].price_per_person), price, key)
    assert.equal(byKey[key].active, true, key)
  }
  assert.ok(Number(byKey.BBQPRI.display_order) < Number(byKey.BBQLUX.display_order))
  assert.ok(Number(byKey['BBQPRI+'].display_order) < Number(byKey['BBQLUX+'].display_order))
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
