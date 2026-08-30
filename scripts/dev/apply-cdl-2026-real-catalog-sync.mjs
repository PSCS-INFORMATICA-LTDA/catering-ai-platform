/**
 * DEV-only CDL 2026 commercial catalog sync.
 *
 * Source of truth: the PO-transcribed CDL 2026 menu in the task prompt.
 * Never touches PROD. Does not invent event items or placeholders.
 *
 *   node scripts/dev/apply-cdl-2026-real-catalog-sync.mjs
 *   node scripts/dev/apply-cdl-2026-real-catalog-sync.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatCatalogDisplayLabel } from '../../Lib/publicQuote/catalogDisplayName.ts'
import { assertDevUrl, loadDevEnv, DEV_REF } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const NOW = new Date().toISOString()
const PRICE_NOTE = 'CDL 2026 official menu sync'

const CAT = {
  BOVINO_TRADICIONAL: {
    pt: 'Bovino Tradicional',
    en: 'Traditional Beef',
    es: 'Carne Tradicional',
  },
  BOVINO_NOBRE: {
    pt: 'Bovino Nobre',
    en: 'Premium Beef',
    es: 'Carne Premium',
  },
  PORCO: { pt: 'Porco', en: 'Pork', es: 'Cerdo' },
  CORDEIRO: { pt: 'Cordeiro', en: 'Lamb', es: 'Cordero' },
  FRANGO: { pt: 'Frango', en: 'Chicken', es: 'Pollo' },
  LINGUICAS: { pt: 'Linguiças', en: 'Sausages', es: 'Embutidos' },
  FRUTOS_DO_MAR: { pt: 'Frutos do Mar', en: 'Seafood', es: 'Mariscos' },
  LEGUMES_E_VEGETAIS: {
    pt: 'Legumes e Vegetais',
    en: 'Vegetables',
    es: 'Verduras',
  },
  FRUTAS: { pt: 'Frutas', en: 'Fruit', es: 'Frutas' },
  ACOMPANHAMENTOS: {
    pt: 'Acompanhamentos',
    en: 'Accompaniments',
    es: 'Acompañamientos',
  },
  GUARNICOES: { pt: 'Guarnições', en: 'Sides', es: 'Guarniciones' },
  EQUIPAMENTOS: { pt: 'Equipamentos', en: 'Equipment', es: 'Equipos' },
}

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
if (env.companyId !== COMPANY_ID) {
  console.error('COMPANY mismatch', env.companyId)
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function sameText(a, b) {
  return String(a ?? '') === String(b ?? '')
}

function catFields(key) {
  const labels = CAT[key]
  if (!labels) return { category_key: key }
  return {
    category_key: key,
    category_pt: labels.pt,
    category_en: labels.en,
    category_es: labels.es,
  }
}

function personPatch(extra = {}) {
  return {
    pricing_type: 'PER_PERSON',
    charge_type: 'PERSON',
    active: true,
    customer_visible: true,
    can_be_additional: true,
    operational_item: false,
    ...extra,
  }
}

function unitPatch(extra = {}) {
  return {
    pricing_type: 'PER_UNIT',
    charge_type: 'UNIT',
    active: true,
    customer_visible: true,
    can_be_additional: true,
    operational_item: false,
    ...extra,
  }
}

/** Explicit CDL 2026 patches keyed by current item_key. */
const UPDATES = {
  ITEM_002: {
    ...personPatch(),
    ...catFields('BOVINO_TRADICIONAL'),
    price: 10,
    item_name: 'ALCATRA ANGUS',
    label_pt: 'ALCATRA ANGUS',
    label_en: 'ALCATRA ANGUS',
    label_es: 'ALCATRA ANGUS',
  },
  ITEM_006: {
    ...personPatch(),
    ...catFields('BOVINO_TRADICIONAL'),
    price: 12,
    item_name: 'ASSADO DE TIRAS',
    label_pt: 'ASSADO DE TIRAS',
  },
  ITEM_003: {
    ...personPatch(),
    ...catFields('BOVINO_TRADICIONAL'),
    price: 12,
    item_name: 'COSTELA ANGUS',
    label_pt: 'COSTELA ANGUS',
    label_en: 'COSTELA ANGUS',
    label_es: 'COSTELA ANGUS',
  },
  ITEM_004: {
    ...personPatch(),
    ...catFields('BOVINO_TRADICIONAL'),
    price: 15,
    item_name: 'FRALDINHA ANGUS',
    label_pt: 'FRALDINHA ANGUS',
    label_en: 'FRALDINHA ANGUS',
    label_es: 'FRALDINHA ANGUS',
  },
  ITEM_001: {
    ...personPatch(),
    ...catFields('BOVINO_TRADICIONAL'),
    price: 15,
    item_name: 'PICANHA ANGUS',
    label_pt: 'PICANHA ANGUS',
    label_en: 'PICANHA ANGUS',
    label_es: 'PICAÑA ANGUS',
  },
  ITEM_010: {
    ...personPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 35,
    item_name: 'FRALDINHA WAGYU',
    label_pt: 'FRALDINHA WAGYU',
    label_en: 'FRALDINHA WAGYU',
    label_es: 'FRALDINHA WAGYU',
  },
  ITEM_007: {
    ...personPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 13,
    item_name: 'NEW YORK',
    label_pt: 'NEW YORK',
  },
  ITEM_009: {
    ...personPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 30,
    item_name: 'PICANHA WAGYU',
    label_pt: 'PICANHA WAGYU',
    label_en: 'PICANHA WAGYU',
    label_es: 'PICAÑA WAGYU',
  },
  ITEM_008: {
    ...personPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 15,
    item_name: 'RIBEYE',
    label_pt: 'RIBEYE',
  },
  ITEM_011: {
    ...unitPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 100,
    item_name: 'T-BONE ANGUS',
    label_pt: 'T-BONE ANGUS',
    label_en: 'T-BONE ANGUS',
    label_es: 'T-BONE ANGUS',
    quantity_2: 3,
    uom_2: 'LB',
  },
  ITEM_012: {
    ...unitPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 200,
    item_name: 'TOMAHAWK ANGUS FOLHADO A OURO',
    label_pt: 'TOMAHAWK ANGUS FOLHADO A OURO',
    label_en: 'TOMAHAWK ANGUS GOLD LEAF',
    label_es: 'TOMAHAWK ANGUS HOJEADO A ORO',
    quantity_2: 3,
    uom_2: 'LB',
  },
  ITEM_013: {
    ...unitPatch(),
    ...catFields('BOVINO_NOBRE'),
    price: 400,
    item_name: 'TOMAHAWK WAGYU FOLHADO A OURO',
    label_pt: 'TOMAHAWK WAGYU FOLHADO A OURO',
    label_en: 'TOMAHAWK WAGYU GOLD LEAF',
    label_es: 'TOMAHAWK WAGYU HOJEADO A ORO',
    quantity_2: 4,
    uom_2: 'LB',
  },
  ITEM_014: {
    ...personPatch(),
    ...catFields('PORCO'),
    price: 12,
    item_name: 'COSTELA',
    label_pt: 'COSTELA',
  },
  ITEM_015: {
    ...personPatch(),
    ...catFields('PORCO'),
    price: 12,
    item_name: 'CARRÉ',
    label_pt: 'CARRÉ',
  },
  ITEM_016: {
    ...unitPatch(),
    ...catFields('PORCO'),
    price: 120,
    item_name: 'TORRESMO PURURUCA',
    label_pt: 'TORRESMO PURURUCA',
    label_en: 'TORRESMO PURURUCA',
    label_es: 'TORRESMO PURURUCA',
    quantity_2: 4,
    uom_2: 'LB',
  },
  ITEM_047: {
    ...personPatch(),
    ...catFields('CORDEIRO'),
    price: 20,
    item_name: 'CARRÉ',
    label_pt: 'CARRÉ',
  },
  ITEM_044: {
    ...personPatch(),
    ...catFields('CORDEIRO'),
    price: 10,
    item_name: 'PERNIL',
    label_pt: 'PERNIL',
  },
  ITEM_045: {
    ...personPatch(),
    ...catFields('CORDEIRO'),
    price: 10,
    item_name: 'T-BONE',
    label_pt: 'T-BONE',
  },
  ITEM_017: { ...personPatch(), ...catFields('FRANGO'), price: 5, item_name: 'ASA', label_pt: 'ASA' },
  ITEM_018: { ...personPatch(), ...catFields('FRANGO'), price: 5, item_name: 'COXA', label_pt: 'COXA' },
  ITEM_019: {
    ...personPatch(),
    ...catFields('FRANGO'),
    price: 4,
    item_name: 'CORAÇÃO',
    label_pt: 'CORAÇÃO',
  },
  ITEM_020: {
    ...personPatch(),
    ...catFields('FRANGO'),
    price: 5,
    item_name: 'FILÉ DE PEITO',
    label_pt: 'FILÉ DE PEITO',
    label_en: 'CHICKEN BREAST',
    label_es: 'FILETE DE PECHUGA',
  },
  ITEM_021: {
    ...personPatch(),
    ...catFields('FRANGO'),
    price: 6,
    item_name: 'FILÉ COM BACON',
    label_pt: 'FILÉ COM BACON',
  },
  ITEM_FRANGO_SOBRECOXA: {
    ...personPatch(),
    ...catFields('FRANGO'),
    price: 5,
    item_name: 'SOBRECOXA SEM OSSO',
    label_pt: 'SOBRECOXA SEM OSSO',
    label_en: 'BONELESS CHICKEN THIGH',
    label_es: 'CONTRAMUSLO SIN HUESO',
  },
  ITEM_026: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 7,
    item_name: 'APIMENTADA',
    label_pt: 'APIMENTADA',
  },
  ITEM_027: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 7,
    item_name: 'ALHO E ERVAS',
    label_pt: 'ALHO E ERVAS',
  },
  ITEM_025: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 7,
    item_name: 'CALABRESA',
    label_pt: 'CALABRESA',
  },
  ITEM_024: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 5,
    item_name: 'TRADICIONAL FRANGO',
    label_pt: 'TRADICIONAL FRANGO',
  },
  ITEM_LINGUICA_TOSCANA_TRADICIONAL: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 5,
    item_name: 'TOSCANA TRADICIONAL',
    label_pt: 'TOSCANA TRADICIONAL',
    label_en: 'TOSCANA TRADICIONAL',
    label_es: 'TOSCANA TRADICIONAL',
  },
  ITEM_028: {
    ...personPatch(),
    ...catFields('LINGUICAS'),
    price: 8,
    item_name: 'COM QUEIJO',
    label_pt: 'COM QUEIJO',
    label_en: 'WITH CHEESE',
    label_es: 'CON QUESO',
  },
  ITEM_049: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 15,
    item_name: 'ATUM',
    label_pt: 'ATUM',
  },
  ITEM_050: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 12,
    item_name: 'CAMARÃO',
    label_pt: 'CAMARÃO',
  },
  ITEM_051: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 30,
    item_name: 'LAGOSTA',
    label_pt: 'LAGOSTA',
  },
  ITEM_052: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 25,
    item_name: 'POLVO',
    label_pt: 'POLVO',
  },
  ITEM_048: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 12,
    item_name: 'SALMÃO',
    label_pt: 'SALMÃO',
    label_en: 'SALMON',
    label_es: 'SALMÓN',
  },
  ITEM_053: {
    ...personPatch(),
    ...catFields('FRUTOS_DO_MAR'),
    price: 30,
    item_name: 'VIEIRA',
    label_pt: 'VIEIRA',
  },
  ITEM_043: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'ABOBRINHA',
    label_pt: 'ABOBRINHA',
  },
  ITEM_032: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'ALHO',
    label_pt: 'ALHO',
  },
  ITEM_042: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'ASPARAGUS',
    label_pt: 'ASPARAGUS',
    label_en: 'ASPARAGUS',
    label_es: 'ESPÁRRAGOS',
  },
  ITEM_035: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'BATATA',
    label_pt: 'BATATA',
  },
  ITEM_036: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'BATATA DOCE',
    label_pt: 'BATATA DOCE',
  },
  ITEM_038: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'BERINGELA',
    label_pt: 'BERINGELA',
  },
  ITEM_033: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'BROCCOLI',
    label_pt: 'BROCCOLI',
  },
  ITEM_031: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'CEBOLA',
    label_pt: 'CEBOLA',
  },
  ITEM_040: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'CENOURA',
    label_pt: 'CENOURA',
  },
  ITEM_041: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'COGUMELO',
    label_pt: 'COGUMELO',
  },
  ITEM_034: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'COUVE FLOR',
    label_pt: 'COUVE FLOR',
  },
  ITEM_037: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'MILHO',
    label_pt: 'MILHO',
  },
  ITEM_039: {
    ...personPatch(),
    ...catFields('LEGUMES_E_VEGETAIS'),
    price: 3,
    item_name: 'PIMENTÃO',
    label_pt: 'PIMENTÃO',
  },
  ITEM_055: {
    ...personPatch(),
    ...catFields('FRUTAS'),
    price: 4,
    item_name: 'ABACAXI',
    label_pt: 'ABACAXI',
  },
  ITEM_057_BANANA: {
    ...personPatch(),
    ...catFields('FRUTAS'),
    price: 4,
    item_name: 'BANANA',
    label_pt: 'BANANA',
  },
  ITEM_058: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 5,
    item_name: 'PÃO DE ALHO',
    label_pt: 'PÃO DE ALHO',
  },
  ITEM_068: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 5,
    item_name: 'CHEESEBURGER',
    label_pt: 'CHEESEBURGER',
    label_en: 'CHEESEBURGER',
    label_es: 'CHEESEBURGER',
  },
  ITEM_063: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 4,
    item_name: 'HOT DOG',
    label_pt: 'HOT DOG',
  },
  ITEM_069: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 5,
    item_name: 'BATATA FRITA',
    label_pt: 'BATATA FRITA',
  },
  ITEM_059: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'FAROFA',
    label_pt: 'FAROFA',
  },
  ITEM_065: {
    ...personPatch(),
    ...catFields('ACOMPANHAMENTOS'),
    price: 5,
    item_name: 'QUEIJO COALHO',
    label_pt: 'QUEIJO COALHO',
  },
  ITEM_066: {
    ...personPatch({ item_type: 'PRODUCT', can_be_package_item: true }),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'PIMENTA DE BICO',
    label_pt: 'PIMENTA DE BICO',
  },
  ITEM_067: {
    ...personPatch({ item_type: 'PRODUCT', can_be_package_item: true }),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'GELEIA DE PIMENTA',
    label_pt: 'GELEIA DE PIMENTA',
    label_en: 'PEPPER JELLY',
    label_es: 'JALEA DE PIMIENTA',
  },
  ITEM_061: {
    ...personPatch({ item_type: 'PRODUCT', can_be_package_item: true }),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'GOIABADA',
    label_pt: 'GOIABADA',
  },
  ITEM_060: {
    ...personPatch({ item_type: 'PRODUCT', can_be_package_item: true }),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'MEL',
    label_pt: 'MEL',
  },
  ITEM_075: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 4,
    item_name: 'ARROZ BRANCO',
    label_pt: 'ARROZ BRANCO',
    label_en: 'WHITE RICE',
    label_es: 'ARROZ BLANCO',
  },
  ITEM_FEIJAO_PRETO: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 5,
    item_name: 'FEIJÃO PRETO',
    label_pt: 'FEIJÃO PRETO',
    label_en: 'BLACK BEANS',
    label_es: 'FRIJOLES NEGROS',
  },
  ITEM_078: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 7,
    item_name: 'SALPICÃO DE FRANGO',
    label_pt: 'SALPICÃO DE FRANGO',
    label_en: 'CHICKEN SALAD',
    label_es: 'ENSALADA DE POLLO',
  },
  ITEM_082: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 5,
    item_name: 'VINAGRETE',
    label_pt: 'VINAGRETE',
    label_en: 'VINAIGRETTE',
    label_es: 'VINAGRETA',
  },
  ITEM_076: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 5,
    item_name: 'MAIONESE',
    label_pt: 'MAIONESE',
    label_en: 'POTATO SALAD',
    label_es: 'ENSALADA DE PAPA',
  },
  ITEM_077: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 3,
    item_name: 'SALADA CÉSAR',
    label_pt: 'SALADA CÉSAR',
    label_en: 'CAESAR SALAD',
    label_es: 'ENSALADA CÉSAR',
  },
  ITEM_079: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 3,
    item_name: 'FAROFA TEMPERADA',
    label_pt: 'FAROFA TEMPERADA',
    label_en: 'SEASONED CRUMBS',
    label_es: 'FAROFA CONDIMENTADA',
  },
  ITEM_080: {
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 3,
    item_name: 'MANDIOCA COZIDA',
    label_pt: 'MANDIOCA COZIDA',
    label_en: 'YUCA',
    label_es: 'YUCA COCIDA',
  },
  ITEM_084: {
    ...unitPatch({ item_type: 'EQUIPMENT', can_be_package_item: false }),
    ...catFields('EQUIPAMENTOS'),
    price: 100,
    item_name: 'ALUGUEL DE CHURRASQUEIRA',
    label_pt: 'ALUGUEL DE CHURRASQUEIRA',
    label_en: 'GRILL RENTAL',
    label_es: 'ALQUILER DE PARRILLA',
  },
}

const CREATES = [
  {
    item_key: 'ITEM_CHIMICHURRI',
    ...personPatch({ item_type: 'PRODUCT', can_be_package_item: true }),
    ...catFields('ACOMPANHAMENTOS'),
    price: 1,
    item_name: 'CHIMICHURRI',
    label_pt: 'CHIMICHURRI',
    label_en: 'CHIMICHURRI',
    label_es: 'CHIMICHURRI',
    currency_code: 'USD',
  },
  {
    item_key: 'ITEM_FILE_MIGNON_BOVINO',
    ...personPatch({ item_type: 'PRODUCT', can_be_option_choice: true }),
    ...catFields('BOVINO_NOBRE'),
    price: 15,
    item_name: 'FILÉ MIGNON',
    label_pt: 'FILÉ MIGNON',
    label_en: 'FILET MIGNON',
    label_es: 'FILETE MIGNON',
    currency_code: 'USD',
  },
  {
    item_key: 'ITEM_FILE_MIGNON_PORCO',
    ...personPatch({ item_type: 'PRODUCT', can_be_option_choice: true }),
    ...catFields('PORCO'),
    price: 12,
    item_name: 'FILÉ MIGNON',
    label_pt: 'FILÉ MIGNON',
    label_en: 'PORK FILET MIGNON',
    label_es: 'FILETE MIGNON DE CERDO',
    currency_code: 'USD',
  },
  {
    item_key: 'ITEM_CARANGUEJO_REI',
    ...personPatch({ item_type: 'PRODUCT', can_be_option_choice: true }),
    ...catFields('FRUTOS_DO_MAR'),
    price: 50,
    item_name: 'CARANGUEJO REI',
    label_pt: 'CARANGUEJO REI',
    label_en: 'KING CRAB',
    label_es: 'CANGREJO REY',
    currency_code: 'USD',
  },
  {
    item_key: 'ITEM_PURE_DE_BATATA',
    ...personPatch({ item_type: 'SIDE', can_be_side_item: true }),
    ...catFields('GUARNICOES'),
    price: 3,
    item_name: 'PURÊ DE BATATA',
    label_pt: 'PURÊ DE BATATA',
    label_en: 'MASHED POTATOES',
    label_es: 'PURÉ DE PAPA',
    currency_code: 'USD',
  },
]

const DELETE_KEYS = [
  'ITEM_062',
  'ITEM_046',
  'ITEM_056',
  'ITEM_057',
  'ITEM_083',
  'ITEM_022',
  'ITEM_030',
  'ITEM_085',
  'ITEM_071',
  'ITEM_064',
  'ITEM_LINGUICA_TRADICIONAL_DUPLICATE_OLD',
]

const PRESERVE_KEYS = [
  'ITEM_FRALDINHA',
  'ITEM_005',
  'ITEM_029',
  'ITEM_081',
]

function editorialCatalogPatch(patch) {
  const next = { ...patch }
  if (next.item_name) next.item_name = formatCatalogDisplayLabel(next.item_name, 'pt')
  if (next.label_pt) next.label_pt = formatCatalogDisplayLabel(next.label_pt, 'pt')
  if (next.label_en) next.label_en = formatCatalogDisplayLabel(next.label_en, 'en')
  if (next.label_es) next.label_es = formatCatalogDisplayLabel(next.label_es, 'es')
  return next
}

for (const key of Object.keys(UPDATES)) {
  UPDATES[key] = editorialCatalogPatch(UPDATES[key])
}
for (let i = 0; i < CREATES.length; i += 1) {
  CREATES[i] = editorialCatalogPatch(CREATES[i])
}

const SOURCE_PUBLIC_KEYS = new Set([
  ...Object.keys(UPDATES),
  ...CREATES.map((row) => row.item_key),
  'KIT_DESCARTAVEIS',
  'CDL_WAITER_SERVICE',
])

const CRITICAL_PRICES = [
  ['ITEM_013', 400, 'PER_UNIT'],
  ['ITEM_012', 200, 'PER_UNIT'],
  ['ITEM_011', 100, 'PER_UNIT'],
  ['ITEM_016', 120, 'PER_UNIT'],
  ['ITEM_084', 100, 'PER_UNIT'],
  ['ITEM_010', 35, 'PER_PERSON'],
  ['ITEM_009', 30, 'PER_PERSON'],
  ['ITEM_FILE_MIGNON_BOVINO', 15, 'PER_PERSON'],
  ['ITEM_008', 15, 'PER_PERSON'],
  ['ITEM_007', 13, 'PER_PERSON'],
  ['ITEM_004', 15, 'PER_PERSON'],
  ['ITEM_001', 15, 'PER_PERSON'],
  ['ITEM_006', 12, 'PER_PERSON'],
  ['ITEM_003', 12, 'PER_PERSON'],
  ['ITEM_002', 10, 'PER_PERSON'],
  ['ITEM_CARANGUEJO_REI', 50, 'PER_PERSON'],
  ['ITEM_051', 30, 'PER_PERSON'],
  ['ITEM_053', 30, 'PER_PERSON'],
  ['ITEM_052', 25, 'PER_PERSON'],
  ['ITEM_049', 15, 'PER_PERSON'],
  ['ITEM_050', 12, 'PER_PERSON'],
  ['ITEM_048', 12, 'PER_PERSON'],
  ['ITEM_075', 4, 'PER_PERSON'],
  ['ITEM_FEIJAO_PRETO', 5, 'PER_PERSON'],
  ['ITEM_078', 7, 'PER_PERSON'],
  ['ITEM_082', 5, 'PER_PERSON'],
  ['ITEM_076', 5, 'PER_PERSON'],
  ['ITEM_077', 3, 'PER_PERSON'],
  ['ITEM_079', 3, 'PER_PERSON'],
  ['ITEM_080', 3, 'PER_PERSON'],
  ['ITEM_PURE_DE_BATATA', 3, 'PER_PERSON'],
]

function isPublic(item) {
  return (
    item.active !== false &&
    item.customer_visible !== false &&
    item.can_be_additional === true
  )
}

function isFixture(item) {
  const key = String(item.item_key || '').toUpperCase()
  const name = `${item.item_name ?? ''} ${item.label_pt ?? ''}`.toUpperCase()
  const cat = String(item.category_key || '').toLowerCase()
  return (
    key.startsWith('DEV_') ||
    key.startsWith('TEST-') ||
    key.startsWith('TEST_') ||
    cat === 'qa_inventory' ||
    cat === 'qa_inventory_jde' ||
    name.includes('TEST-DEV') ||
    name.includes('TESTE DEV') ||
    name.startsWith('QA INV') ||
    name.startsWith('JDE QA') ||
    name.startsWith('QA JDE')
  )
}

function isOperationalNonCommercial(item) {
  const key = String(item.item_key || '').toUpperCase()
  return ['ITEM_070', 'ITEM_072', 'ITEM_073', 'ITEM_074', 'ITEM_086'].includes(key)
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function loadCatalog() {
  const items = await must(
    'catalog_items',
    sb.from('catalog_items').select('*').eq('company_id', COMPANY_ID),
  )
  const prices = await must(
    'catalog_item_prices',
    sb.from('catalog_item_prices').select('*').eq('company_id', COMPANY_ID),
  )
  return { items: items ?? [], prices: prices ?? [] }
}

function activeSalePrices(prices, itemId) {
  return prices.filter(
    (row) =>
      row.catalog_item_id === itemId &&
      row.active === true &&
      String(row.price_type || 'SALE').toUpperCase() === 'SALE',
  )
}

function diffFields(item, patch) {
  const next = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'price') {
      if (num(item.price) !== num(value) || num(item.sale_price) !== num(value)) {
        next.price = value
        next.sale_price = value
      }
      continue
    }
    if (item[key] !== value) next[key] = value
  }
  return next
}

function buildPlan(items, prices, quotedIds) {
  const byKey = new Map(items.map((item) => [item.item_key, item]))
  const rows = []

  for (const [itemKey, patch] of Object.entries(UPDATES)) {
    const item = byKey.get(itemKey)
    if (!item) {
      rows.push({
        item_key: itemKey,
        name: patch.label_pt,
        category: patch.category_key,
        old_price: null,
        new_price: patch.price,
        pricing_type: patch.pricing_type,
        action: 'CREATE_REAL',
        reason: 'expected existing SKU missing — will create from patch',
        id: null,
        patch,
      })
      continue
    }
    const changes = diffFields(item, patch)
    const action = Object.keys(changes).length === 0 ? 'KEEP_REAL' : 'UPDATE_REAL'
    rows.push({
      item_key: itemKey,
      name: item.label_pt || item.item_name,
      category: patch.category_key,
      old_price: num(item.sale_price ?? item.price),
      new_price: patch.price,
      pricing_type: patch.pricing_type,
      action,
      changes,
      id: item.id,
    })
  }

  for (const spec of CREATES) {
    const existing = byKey.get(spec.item_key)
    if (existing) {
      const changes = diffFields(existing, spec)
      rows.push({
        item_key: spec.item_key,
        name: spec.label_pt,
        category: spec.category_key,
        old_price: num(existing.sale_price ?? existing.price),
        new_price: spec.price,
        pricing_type: spec.pricing_type,
        action: Object.keys(changes).length === 0 ? 'KEEP_REAL' : 'UPDATE_REAL',
        changes,
        id: existing.id,
      })
      continue
    }
    rows.push({
      item_key: spec.item_key,
      name: spec.label_pt,
      category: spec.category_key,
      old_price: null,
      new_price: spec.price,
      pricing_type: spec.pricing_type,
      action: 'CREATE_REAL',
      spec,
      id: null,
    })
  }

  for (const itemKey of DELETE_KEYS) {
    const item = byKey.get(itemKey)
    if (!item) continue
    const quoted = quotedIds.has(item.id)
    rows.push({
      item_key: itemKey,
      name: item.label_pt || item.item_name,
      category: item.category_key,
      old_price: num(item.sale_price ?? item.price),
      new_price: null,
      pricing_type: item.pricing_type,
      action: quoted
        ? 'REMOVE_FROM_CURRENT_CATALOG_KEEP_HISTORY'
        : 'DELETE_SYNTHETIC',
      id: item.id,
      quoted,
    })
  }

  for (const itemKey of PRESERVE_KEYS) {
    const item = byKey.get(itemKey)
    if (!item) continue
    rows.push({
      item_key: itemKey,
      name: item.label_pt || item.item_name,
      category: item.category_key,
      old_price: num(item.sale_price ?? item.price),
      new_price: null,
      pricing_type: item.pricing_type,
      action: 'REMOVE_FROM_CURRENT_CATALOG_KEEP_HISTORY',
      id: item.id,
      quoted: quotedIds.has(item.id),
    })
  }

  for (const item of items) {
    if (SOURCE_PUBLIC_KEYS.has(item.item_key)) continue
    if (DELETE_KEYS.includes(item.item_key)) continue
    if (PRESERVE_KEYS.includes(item.item_key)) continue
    if (!isPublic(item)) continue
    if (isFixture(item) || isOperationalNonCommercial(item)) continue
    rows.push({
      item_key: item.item_key,
      name: item.label_pt || item.item_name,
      category: item.category_key,
      old_price: num(item.sale_price ?? item.price),
      new_price: null,
      pricing_type: item.pricing_type,
      action: quotedIds.has(item.id)
        ? 'REMOVE_FROM_CURRENT_CATALOG_KEEP_HISTORY'
        : 'DELETE_SYNTHETIC',
      id: item.id,
      unexpected: true,
    })
  }

  return { rows, byKey, prices }
}

async function loadQuotedItemIds() {
  const rows = await must(
    'quote_additional_items',
    sb
      .from('quote_additional_items')
      .select('additional_item_id')
      .eq('company_id', COMPANY_ID)
      .not('additional_item_id', 'is', null),
  )
  return new Set((rows ?? []).map((row) => row.additional_item_id))
}

async function setPrice(itemId, amount, pricingType, chargeType) {
  const current = await must(
    'prices.select',
    sb
      .from('catalog_item_prices')
      .select('id, amount, pricing_type, charge_type, active, price_type')
      .eq('company_id', COMPANY_ID)
      .eq('catalog_item_id', itemId)
      .eq('active', true)
      .eq('price_type', 'SALE'),
  )
  const active = current ?? []
  const already = active.find(
    (row) =>
      num(row.amount) === num(amount) &&
      row.pricing_type === pricingType &&
      row.charge_type === chargeType,
  )
  const stale = active.filter((row) => row.id !== already?.id)
  if (stale.length > 0) {
    const { error } = await sb
      .from('catalog_item_prices')
      .update({ active: false, valid_until: NOW, updated_at: NOW })
      .eq('company_id', COMPANY_ID)
      .in(
        'id',
        stale.map((row) => row.id),
      )
    if (error) throw new Error(`deactivate prices: ${error.message}`)
  }
  if (already) return
  const { error } = await sb.from('catalog_item_prices').insert({
    company_id: COMPANY_ID,
    catalog_item_id: itemId,
    price_type: 'SALE',
    currency_code: 'USD',
    amount,
    pricing_type: pricingType,
    charge_type: chargeType,
    valid_from: NOW,
    valid_until: null,
    active: true,
    notes: PRICE_NOTE,
  })
  if (error) throw new Error(`insert price: ${error.message}`)
}

async function hideFromCatalog(itemId) {
  const { error } = await sb
    .from('catalog_items')
    .update({
      customer_visible: false,
      can_be_additional: false,
      updated_at: NOW,
    })
    .eq('company_id', COMPANY_ID)
    .eq('id', itemId)
  if (error) throw new Error(`hide ${itemId}: ${error.message}`)
}

async function deleteItem(itemId) {
  const { error: priceError } = await sb
    .from('catalog_item_prices')
    .delete()
    .eq('company_id', COMPANY_ID)
    .eq('catalog_item_id', itemId)
  if (priceError) throw new Error(`delete prices ${itemId}: ${priceError.message}`)
  const { error } = await sb
    .from('catalog_items')
    .delete()
    .eq('company_id', COMPANY_ID)
    .eq('id', itemId)
  if (error) throw new Error(`delete item ${itemId}: ${error.message}`)
}

function publicItemType(item) {
  const type = String(item.item_type || '').toUpperCase()
  return ['PRODUCT', 'PACKAGE_ITEM', 'SIDE', 'EQUIPMENT'].includes(type)
}

export function evaluateGates(items, prices) {
  const publicItems = items.filter(
    (item) => isPublic(item) && publicItemType(item) && !isFixture(item),
  )
  const failures = []
  const publicKeys = new Set(publicItems.map((item) => item.item_key))

  for (const item of publicItems) {
    if (!SOURCE_PUBLIC_KEYS.has(item.item_key)) {
      failures.push(`PUBLIC_NON_SOURCE ${item.item_key} ${item.label_pt}`)
    }
  }
  if (publicKeys.has('ITEM_081')) failures.push('FEIJAO_TROPEIRO_PUBLIC')
  if (publicItems.some((item) => item.category_key === 'PEIXES')) {
    failures.push('PUBLIC_PEIXES_CATEGORY')
  }
  if (publicItems.some((item) => item.category_key === 'CONDIMENTOS')) {
    failures.push('PUBLIC_CONDIMENTOS_CATEGORY')
  }

  const guarnicoes = publicItems.filter((item) => item.category_key === 'GUARNICOES')
  const wantSides = [
    'Arroz Branco',
    'Feijão Preto',
    'Salpicão de Frango',
    'Vinagrete',
    'Maionese',
    'Salada César',
    'Farofa Temperada',
    'Mandioca Cozida',
    'Purê de Batata',
  ]
  const gotSides = (guarnicoes ?? []).map((item) => item.label_pt).sort()
  if (gotSides.join('|') !== [...wantSides].sort().join('|')) {
    failures.push(`GUARNICOES_SET ${gotSides.join(',')}`)
  }

  const byKey = new Map(items.map((item) => [item.item_key, item]))
  for (const [key, amount, type] of CRITICAL_PRICES) {
    const item = byKey.get(key)
    if (!item || !isPublic(item)) {
      failures.push(`CRITICAL_MISSING ${key}`)
      continue
    }
    if (num(item.sale_price) !== amount || num(item.price) !== amount) {
      failures.push(`CRITICAL_PRICE ${key} ${item.sale_price}`)
    }
    if (item.pricing_type !== type) {
      failures.push(`CRITICAL_TYPE ${key} ${item.pricing_type}`)
    }
    const active = activeSalePrices(prices, item.id)
    if (active.length !== 1) failures.push(`ACTIVE_PRICE_COUNT ${key} ${active.length}`)
    else if (num(active[0].amount) !== amount) {
      failures.push(`ACTIVE_PRICE_AMOUNT ${key} ${active[0].amount}`)
    }
  }

  const emptyCats = [...new Set(publicItems.map((item) => item.category_key))].filter(
    (key) => !publicItems.some((item) => item.category_key === key),
  )
  if (emptyCats.length) failures.push(`EMPTY_PUBLIC ${emptyCats.join(',')}`)

  return {
    failures,
    publicCount: publicItems.length,
    publicNonSource: publicItems.filter((item) => !SOURCE_PUBLIC_KEYS.has(item.item_key))
      .length,
    placeholderEvent: publicItems.filter((item) =>
      /EVENTO|PLACEHOLDER|FUTURO/i.test(`${item.item_key} ${item.label_pt}`),
    ).length,
    guarnicoes: guarnicoes.map((item) => item.label_pt),
  }
}

async function applyPlan(plan) {
  const created = []
  const updated = []
  const deleted = []
  const preserved = []

  for (const row of plan.rows) {
    if (row.action === 'CREATE_REAL') {
      const spec = row.spec || row.patch
      const payload = {
        company_id: COMPANY_ID,
        item_key: spec.item_key || row.item_key,
        item_name: spec.item_name,
        label_pt: spec.label_pt,
        label_en: spec.label_en ?? spec.label_pt,
        label_es: spec.label_es ?? spec.label_pt,
        category_key: spec.category_key,
        category_pt: spec.category_pt,
        category_en: spec.category_en,
        category_es: spec.category_es,
        price: spec.price,
        sale_price: spec.price,
        pricing_type: spec.pricing_type,
        charge_type: spec.charge_type,
        currency_code: spec.currency_code || 'USD',
        active: true,
        customer_visible: true,
        can_be_additional: true,
        can_be_package_item: spec.can_be_package_item ?? true,
        can_be_side_item: spec.can_be_side_item ?? false,
        can_be_option_choice: spec.can_be_option_choice ?? false,
        item_type: spec.item_type || 'PRODUCT',
        operational_item: false,
        updated_at: NOW,
      }
      const inserted = await must(
        `insert ${payload.item_key}`,
        sb.from('catalog_items').insert(payload).select('id,item_key').single(),
      )
      await setPrice(
        inserted.id,
        spec.price,
        spec.pricing_type,
        spec.charge_type,
      )
      created.push(inserted)
      continue
    }

    if (row.action === 'UPDATE_REAL' || row.action === 'KEEP_REAL') {
      if (row.action === 'UPDATE_REAL' && row.id && row.changes) {
        const payload = { ...row.changes, updated_at: NOW }
        const { error } = await sb
          .from('catalog_items')
          .update(payload)
          .eq('company_id', COMPANY_ID)
          .eq('id', row.id)
        if (error) throw new Error(`update ${row.item_key}: ${error.message}`)
        updated.push(row.item_key)
      }
      if (row.id && row.new_price != null) {
        await setPrice(row.id, row.new_price, row.pricing_type, row.pricing_type === 'PER_UNIT' ? 'UNIT' : 'PERSON')
      }
      continue
    }

    if (row.action === 'REMOVE_FROM_CURRENT_CATALOG_KEEP_HISTORY') {
      await hideFromCatalog(row.id)
      preserved.push(row.item_key)
      continue
    }

    if (row.action === 'DELETE_SYNTHETIC') {
      await deleteItem(row.id)
      deleted.push(row.item_key)
    }
  }

  return { created, updated, deleted, preserved }
}

const snapshot = {
  at: NOW,
  env: { host: new URL(env.url).host, ref: DEV_REF, companyId: COMPANY_ID },
  apply: APPLY,
}
const { items, prices } = await loadCatalog()
const quotedIds = await loadQuotedItemIds()
const plan = buildPlan(items, prices, quotedIds)
const publicBefore = items.filter((item) => isPublic(item) && !isFixture(item))

snapshot.countsBefore = {
  items: items.length,
  prices: prices.length,
  public: publicBefore.length,
}
snapshot.plan = plan.rows.map((row) => ({
  item: row.name,
  item_key: row.item_key,
  category: row.category,
  old_price: row.old_price,
  new_price: row.new_price,
  pricing_type: row.pricing_type,
  action: row.action,
}))

const outDir = join(ROOT, 'docs/qa/snapshots')
mkdirSync(outDir, { recursive: true })
const stamp = NOW.replace(/[:.]/g, '-')
const snapshotPath = join(outDir, `cdl-2026-real-catalog-${stamp}.json`)

console.log(`ENVIRONMENT = DEV (${DEV_REF})`)
console.log(`COMPANY = ${COMPANY_ID}`)
console.log(`PROD_WRITE = FORBIDDEN`)
console.log(`PUBLIC BEFORE = ${publicBefore.length}`)
console.log('')
console.log('ITEM | CATEGORY | OLD | NEW | TYPE | ACTION')
for (const row of snapshot.plan) {
  console.log(
    [
      row.item_key || row.item,
      row.category,
      row.old_price,
      row.new_price,
      row.pricing_type,
      row.action,
    ].join(' | '),
  )
}

if (!APPLY) {
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
  console.log(`\ndry-run snapshot ${snapshotPath}`)
  process.exit(0)
}

const applied = await applyPlan(plan)
const after = await loadCatalog()
const gates = evaluateGates(after.items, after.prices)
snapshot.applied = applied
snapshot.countsAfter = {
  items: after.items.length,
  prices: after.prices.length,
  public: after.items.filter((item) => isPublic(item) && !isFixture(item)).length,
}
snapshot.gates = gates
writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))

console.log('\nAPPLIED')
console.log(`created ${applied.created.length}`)
console.log(`updated ${applied.updated.length}`)
console.log(`deleted ${applied.deleted.length}`)
console.log(`preserved ${applied.preserved.length}`)
console.log(`PUBLIC AFTER = ${snapshot.countsAfter.public}`)
console.log(`PUBLIC_NON_SOURCE_ITEM_COUNT = ${gates.publicNonSource}`)

if (gates.failures.length > 0) {
  console.error('\nGATE FAILURES')
  for (const failure of gates.failures) console.error(` - ${failure}`)
  console.error(`snapshot ${snapshotPath}`)
  process.exit(1)
}

console.log('\nGATES PASS')
console.log(`snapshot ${snapshotPath}`)
process.exit(0)
