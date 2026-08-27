/**
 * Garante que WhatsApp/SMS/e-mail discriminam o resumo financeiro completo.
 * Run: node --experimental-strip-types scripts/dev/test-share-commercial-lines.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const src = readFileSync(
  join(ROOT, 'Lib/whatsappMessageTemplates.ts'),
  'utf8',
)
const panel = readFileSync(
  join(ROOT, 'components/quotes/QuoteProposalSharePanel.tsx'),
  'utf8',
)
const detail = readFileSync(
  join(ROOT, 'app/quotes/[id]/QuoteDetailView.tsx'),
  'utf8',
)

let failed = 0
function check(name, fn) {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (e) {
    failed += 1
    console.error(`FAIL  ${name}: ${e.message}`)
  }
}

check('template has mileage line PT', () => {
  assert.match(src, /\*Milhagem\* \(\$\{charged\} mi cobradas/)
})

check('template has grill rental line PT', () => {
  assert.match(src, /\*Aluguel de churrasqueira:\*/)
})

check('template has discount line PT', () => {
  assert.match(src, /\*Desconto:\* \$\{m\}/)
})

check('template has holiday surcharge line PT', () => {
  assert.match(src, /Adicional de feriado \/ data comemorativa \(100%\)/)
})

check('template has garnish rules PT', () => {
  assert.match(src, /pacote com guarnições/)
  assert.match(src, /pacote sem guarnições/)
  assert.match(src, /Pacote CDL/)
  assert.match(src, /Itens adicionais/)
})

check('builder uses full finance inputs', () => {
  assert.match(src, /packageTotal/)
  assert.match(src, /mileageFee/)
  assert.match(src, /grillRentalTotal/)
  assert.match(src, /discountAmount/)
  assert.match(src, /holidaySurchargeAmount/)
})

check('share panel wires finance fields', () => {
  assert.match(panel, /packageTotal/)
  assert.match(panel, /mileageFee/)
  assert.match(panel, /grillRentalTotal/)
  assert.match(panel, /discountAmount/)
})

check('detail view passes finance to share panel', () => {
  assert.match(detail, /packageTotal=\{snapshot\.packageTotal\}/)
  assert.match(detail, /mileageFee=\{snapshot\.mileageFee\}/)
  assert.match(detail, /grillRentalTotal=\{grillRentalTotal\}/)
  assert.match(detail, /discountAmount=\{discount\}/)
  assert.match(detail, /holidaySurchargeAmount=\{holidaySurcharge\}/)
  assert.match(detail, /garnishDescription=\{/)
})

try {
  const mod = await import(
    pathToFileURL(join(ROOT, 'Lib/whatsappMessageTemplates.ts')).href
  )
  const msg = mod.buildClientQuoteWhatsAppText({
    quoteNumber: 'TEST-SHARE',
    customerName: 'Ricardo',
    eventDate: '2026-12-24',
    proposalUrl: 'https://example.com/p',
    language: 'pt',
    packageTotal: 1350,
    mileageFee: 128,
    chargedMiles: 64,
    mileageFreeLimit: 20,
    grillRentalTotal: 100,
    grillRentalQty: 1,
    holidaySurchargeAmount: 1350,
    discountAmount: 50,
    quoteTotal: 2700,
    reservationAmount: 810,
    commercialReason: 'cdl_holiday',
  })
  assert.match(msg, /\*Pacote:\*/)
  assert.match(msg, /\*Milhagem\*/)
  assert.match(msg, /64 mi/)
  assert.match(msg, /\*Aluguel de churrasqueira:\*/)
  assert.match(msg, /Adicional de feriado/)
  assert.match(msg, /\*Desconto:\*/)
  assert.match(msg, /\*Total:/)
  assert.match(msg, /acréscimo de 100%/)
  assert.match(msg, /20 mi de cortesia/)
  assert.match(msg, /aluguel de \$100/)
  assert.match(msg, /────────/)
  assert.doesNotMatch(msg, /pedido mínimo de \$800/)
  console.log('PASS  runtime builder itemizes holiday + grill + mileage')

  const ctrl = mod.buildClientQuoteWhatsAppText({
    quoteNumber: 'TEST-CTRL',
    proposalUrl: 'https://example.com/p',
    language: 'pt',
    packageTotal: 1350,
    quoteTotal: 1350,
    reservationAmount: 405,
    commercialReason: 'weekday',
  })
  assert.doesNotMatch(ctrl, /Milhagem/)
  assert.doesNotMatch(ctrl, /cortesia/)
  assert.doesNotMatch(ctrl, /churrasqueira/)
  assert.doesNotMatch(ctrl, /feriado/)
  assert.doesNotMatch(ctrl, /pedido mínimo de \$800/)
  console.log('PASS  control quote has no unrelated rule notes')

  const withG = mod.buildClientQuoteWhatsAppText({
    quoteNumber: 'GAR-WITH',
    proposalUrl: 'https://example.com/p',
    language: 'pt',
    eventDate: '2026-10-07',
    packageLabel: 'BBQ Prime com guarnições',
    packageUnitPrice: 75,
    packageTotal: 1350,
    packageHasGarnish: true,
    garnishIncludedTotal: 390,
    packageItemsDescription:
      'Picanha Angus / Fraldinha / Linguiça Toscana / Frango',
    garnishDescription:
      'Arroz branco, Feijão preto, Vinagrete, Farofa, Maionese',
    packageSelectionLines: [
      { groupTitle: 'Escolha de Proteína', itemLabel: 'Picanha Angus' },
    ],
    quoteTotal: 1740,
    reservationAmount: 522,
  })
  const withTitleIdx = withG.indexOf('*Proposta GAR-WITH*')
  const withPkgIdx = withG.indexOf('*Pacote CDL*')
  const withDateIdx = withG.indexOf('*Data do evento:*')
  assert.ok(withPkgIdx > withTitleIdx, 'Pacote CDL after title')
  assert.ok(withDateIdx > withPkgIdx, 'event date after package block')
  assert.match(withG, /Pacote escolhido/)
  assert.match(withG, /Valor do pacote/)
  assert.match(withG, /Escolhas inclusas/)
  assert.match(withG, /Itens do pacote/)
  assert.match(withG, /\*Guarnições:\*/)
  assert.match(withG, /• Feijão preto/)
  assert.match(withG, /Valor guarnições:/)
  assert.match(withG, /já inclusas/)
  assert.doesNotMatch(withG, /disponíveis como adicional/)

  const withoutG = mod.buildClientQuoteWhatsAppText({
    quoteNumber: 'GAR-WITHOUT',
    proposalUrl: 'https://example.com/p',
    language: 'pt',
    packageLabel: 'BBQ Prime',
    packageUnitPrice: 75,
    packageTotal: 1350,
    packageHasGarnish: false,
    packageItemsDescription: 'Picanha Angus / Frango / Pão de Alho',
    additionalTotal: 390,
    additionalLines: [
      { label: 'Arroz branco', amount: 195, isGarnish: true },
      { label: 'Vinagrete', amount: 195, isGarnish: true },
    ],
    quoteTotal: 1740,
    reservationAmount: 522,
  })
  assert.match(withoutG, /\*Pacote CDL\*/)
  assert.match(withoutG, /Pacote escolhido:\* BBQ Prime/)
  assert.match(withoutG, /Itens adicionais/)
  assert.match(withoutG, /Arroz branco/)
  assert.match(withoutG, /Não inclusas/)
  assert.match(withoutG, /Adicionais:/)
  assert.match(withoutG, /disponíveis como adicional/)
  assert.doesNotMatch(withoutG, /já inclusas/)
  console.log('PASS  garnish with/without package rules in share text')
} catch (e) {
  failed += 1
  console.error(`FAIL  runtime builder: ${e.message}`)
}

console.log(failed === 0 ? '\nShare commercial lines OK.' : `\n${failed} failed.`)
process.exit(failed === 0 ? 0 : 1)
