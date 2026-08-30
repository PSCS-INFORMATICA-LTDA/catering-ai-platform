/**
 * Editorial catalog display-label helper + idempotency.
 *
 * Run: npm run test:dev:catalog-display-label
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatCatalogDisplayLabel,
  formatCatalogDisplayName,
  isCatalogInternalKey,
  normalizeCatalogItemLabelFields,
} from '../../Lib/publicQuote/catalogDisplayName.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

test('PT_CONNECTORS_LOWERCASE', () => {
  assert.equal(formatCatalogDisplayLabel('PIMENTA DE BICO', 'pt'), 'Pimenta de Bico')
  assert.equal(formatCatalogDisplayLabel('COSTELA DE PORCO', 'pt'), 'Costela de Porco')
  assert.equal(formatCatalogDisplayLabel('VIEIRA COM BACON', 'pt'), 'Vieira com Bacon')
  assert.equal(formatCatalogDisplayLabel('ALHO E ERVAS', 'pt'), 'Alho e Ervas')
  assert.equal(formatCatalogDisplayLabel('GELEIA DE PIMENTA', 'pt'), 'Geleia de Pimenta')
  assert.equal(formatCatalogDisplayLabel('PÃO DE ALHO', 'pt'), 'Pão de Alho')
  assert.equal(formatCatalogDisplayLabel('ASSADO DE TIRAS', 'pt'), 'Assado de Tiras')
  assert.equal(formatCatalogDisplayLabel('FILÉ DE PEITO', 'pt'), 'Filé de Peito')
  assert.equal(formatCatalogDisplayLabel('FILÉ COM BACON', 'pt'), 'Filé com Bacon')
  assert.equal(formatCatalogDisplayLabel('SALPICÃO DE FRANGO', 'pt'), 'Salpicão de Frango')
  assert.equal(formatCatalogDisplayLabel('PURÊ DE BATATA', 'pt'), 'Purê de Batata')
  assert.equal(formatCatalogDisplayLabel('KIT DE DESCARTÁVEIS', 'pt'), 'Kit de Descartáveis')
  assert.equal(formatCatalogDisplayLabel('ALUGUEL DE CHURRASQUEIRA', 'pt'), 'Aluguel de Churrasqueira')
})

test('PT_SIGNIFICANT_SECOND_WORD_TITLE_CASE', () => {
  assert.equal(formatCatalogDisplayLabel('CARANGUEJO REI', 'pt'), 'Caranguejo Rei')
  assert.equal(formatCatalogDisplayLabel('COSTELA BOVINA', 'pt'), 'Costela Bovina')
  assert.equal(formatCatalogDisplayLabel('Costela bovina', 'pt'), 'Costela Bovina')
})

test('PREMIUM_QUALIFIERS_IN_PARENTHESES', () => {
  assert.equal(formatCatalogDisplayLabel('PICANHA ANGUS', 'pt'), 'Picanha (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('PICANHA WAGYU', 'pt'), 'Picanha (WAGYU)')
  assert.equal(formatCatalogDisplayLabel('FRALDINHA ANGUS', 'pt'), 'Fraldinha (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('FRALDINHA WAGYU', 'pt'), 'Fraldinha (WAGYU)')
  assert.equal(formatCatalogDisplayLabel('COSTELA ANGUS', 'pt'), 'Costela (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('ALCATRA ANGUS', 'pt'), 'Alcatra (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Costela bovina Angus', 'pt'), 'Costela Bovina (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Angus Picanha', 'en'), 'Picanha (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Angus beef ribs', 'en'), 'Beef Ribs (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('HAMBURGUER (ANGUS)', 'pt'), 'Hamburguer (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Hambúrguer (ANGUS)', 'pt'), 'Hambúrguer (ANGUS)')
})

test('T_BONE_CANONICAL', () => {
  assert.equal(formatCatalogDisplayLabel('T-BONE', 'pt'), 'T-Bone')
  assert.equal(formatCatalogDisplayLabel('T-bone', 'pt'), 'T-Bone')
  assert.equal(formatCatalogDisplayLabel('t-bone', 'pt'), 'T-Bone')
  assert.equal(formatCatalogDisplayLabel('T-BONE ANGUS', 'pt'), 'T-Bone (ANGUS)')
})

test('TOMAHAWK_PREMIUM_PLUS_DESCRIPTION', () => {
  assert.equal(
    formatCatalogDisplayLabel('TOMAHAWK ANGUS FOLHADO A OURO', 'pt'),
    'Tomahawk (ANGUS) Folhado a Ouro',
  )
  assert.equal(
    formatCatalogDisplayLabel('TOMAHAWK WAGYU FOLHADO A OURO', 'pt'),
    'Tomahawk (WAGYU) Folhado a Ouro',
  )
})

test('NON_PREMIUM_PARENTHESES_PRESERVED', () => {
  assert.equal(
    formatCatalogDisplayLabel('Linguiça Toscana (Tradicional)', 'pt'),
    'Linguiça Toscana (Tradicional)',
  )
  assert.equal(
    formatCatalogDisplayLabel('LINGUIÇA TOSCANA (TRADICIONAL)', 'pt'),
    'Linguiça Toscana (Tradicional)',
  )
})

test('NO_DUPLICATE_PARENTHESES', () => {
  assert.equal(formatCatalogDisplayLabel('Picanha (ANGUS)', 'pt'), 'Picanha (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Hambúrguer (ANGUS)', 'pt'), 'Hambúrguer (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Hambúrguer ((ANGUS))', 'pt'), 'Hambúrguer (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('Picanha (ANGUS) (ANGUS)', 'pt'), 'Picanha (ANGUS)')
})

test('EN_ES_CONNECTORS', () => {
  assert.equal(formatCatalogDisplayLabel('GARLIC BREAD', 'en'), 'Garlic Bread')
  assert.equal(formatCatalogDisplayLabel('SCALLOPS WITH BACON', 'en'), 'Scallops with Bacon')
  assert.equal(formatCatalogDisplayLabel('RACK OF LAMB', 'en'), 'Rack of Lamb')
  assert.equal(formatCatalogDisplayLabel('CHICKEN WITH CHEESE', 'en'), 'Chicken with Cheese')
  assert.equal(formatCatalogDisplayLabel('BEEF RIBS ANGUS', 'en'), 'Beef Ribs (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('T-BONE ANGUS', 'en'), 'T-Bone (ANGUS)')
  assert.equal(formatCatalogDisplayLabel('PICANHA WAGYU', 'en'), 'Picanha (WAGYU)')
  assert.equal(formatCatalogDisplayLabel('COSTILLA DE CERDO', 'es'), 'Costilla de Cerdo')
  assert.equal(formatCatalogDisplayLabel('PAN DE AJO', 'es'), 'Pan de Ajo')
  assert.equal(formatCatalogDisplayLabel('JALEA DE PIMIENTA', 'es'), 'Jalea de Pimienta')
  assert.equal(formatCatalogDisplayLabel('PICAÑA ANGUS', 'es'), 'Picaña (ANGUS)')
  assert.equal(
    formatCatalogDisplayLabel('Salchicha Tradicional De Cerdo', 'es'),
    'Salchicha Tradicional de Cerdo',
  )
})

test('INTERNAL_KEYS_UNCHANGED', () => {
  assert.equal(isCatalogInternalKey('ITEM_009'), true)
  assert.equal(isCatalogInternalKey('PICANHA_WAGYU'), true)
  assert.equal(isCatalogInternalKey('costela_bovina_angus'), true)
  assert.equal(formatCatalogDisplayLabel('ITEM_009', 'pt'), 'ITEM_009')
  assert.equal(formatCatalogDisplayLabel('PICANHA_WAGYU', 'pt'), 'PICANHA_WAGYU')
  assert.equal(formatCatalogDisplayLabel('costela_bovina_angus', 'pt'), 'costela_bovina_angus')
  assert.equal(formatCatalogDisplayLabel('KIT_DESCARTAVEIS', 'pt'), 'KIT_DESCARTAVEIS')
})

test('PROTECTED_TOKENS', () => {
  assert.equal(formatCatalogDisplayLabel('BBQ PRIME', 'pt'), 'BBQ Prime')
  assert.equal(formatCatalogDisplayLabel('CHURRASCO TRADICIONAL CDL', 'pt'), 'Churrasco Tradicional CDL')
})

test('IDEMPOTENT_ON_NORMALIZED_LABELS', () => {
  const samples = [
    ['Pimenta de Bico', 'pt'],
    ['Costela de Porco', 'pt'],
    ['Vieira com Bacon', 'pt'],
    ['Alho e Ervas', 'pt'],
    ['Caranguejo Rei', 'pt'],
    ['Picanha (ANGUS)', 'pt'],
    ['Picanha (WAGYU)', 'pt'],
    ['T-Bone', 'pt'],
    ['T-Bone (ANGUS)', 'pt'],
    ['Tomahawk (WAGYU) Folhado a Ouro', 'pt'],
    ['Costela Bovina (ANGUS)', 'pt'],
    ['Hambúrguer (ANGUS)', 'pt'],
    ['Garlic Bread', 'en'],
    ['Scallops with Bacon', 'en'],
    ['Costilla de Cerdo', 'es'],
  ]
  for (const [value, locale] of samples) {
    assert.equal(formatCatalogDisplayLabel(value, locale), value)
    assert.equal(formatCatalogDisplayLabel(formatCatalogDisplayLabel(value, locale), locale), value)
  }
})

test('LEGACY_ALIAS_USES_PT_RULES', () => {
  assert.equal(formatCatalogDisplayName('PIMENTA DE BICO'), 'Pimenta de Bico')
  assert.equal(formatCatalogDisplayName('PICANHA ANGUS'), 'Picanha (ANGUS)')
  assert.equal(formatCatalogDisplayName('  pimenta   de   bico  '), 'Pimenta de Bico')
})

test('SAVE_HELPER_NORMALIZES_LABEL_FIELDS', () => {
  const normalized = normalizeCatalogItemLabelFields({
    item_name: 'PICANHA ANGUS',
    label_pt: 'PICANHA ANGUS',
    label_en: 'PICANHA ANGUS',
    label_es: 'PICAÑA ANGUS',
    item_key: 'ITEM_001',
  })
  assert.equal(normalized.item_key, 'ITEM_001')
  assert.equal(normalized.item_name, 'Picanha (ANGUS)')
  assert.equal(normalized.label_pt, 'Picanha (ANGUS)')
  assert.equal(normalized.label_en, 'Picanha (ANGUS)')
  assert.equal(normalized.label_es, 'Picaña (ANGUS)')
})

test('HELPER_NOT_USED_AS_GLOBAL_CSS_MASK', () => {
  const css = source('app/globals.css')
  assert.doesNotMatch(css, /text-transform:\s*capitalize/)
  assert.match(
    css,
    /\.public-additional-category\.is-featured[\s\S]*?\.public-additional-card-name[\s\S]*?text-transform:\s*uppercase/,
  )
})

console.log(`\n${passed} catalog display-label tests passed`)
