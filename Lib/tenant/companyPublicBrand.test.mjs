import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  expandRegionName,
  formatCompanyLocation,
  parseAssistantPersonaRule,
  resolveCompanyPublicBrand,
  resolveProposalCompanyLocation,
} from './companyPublicBrand.ts'

test('company location uses settings first, then city + expanded region', () => {
  assert.equal(
    formatCompanyLocation({ locationLabel: 'Orlando, Florida', city: 'Orlando', state: 'FL' }),
    'Orlando, Florida',
  )
  assert.equal(
    formatCompanyLocation({ city: 'Orlando', state: 'FL' }),
    'Orlando, Florida',
  )
  assert.equal(formatCompanyLocation({ city: 'Austin', state: 'TX' }), 'Austin, Texas')
  assert.equal(formatCompanyLocation({}), null)
})

test('brand helper never special-cases the CDL UUID', () => {
  const brand = resolveCompanyPublicBrand({
    companyName: 'QA MULTICOMPANY',
    city: 'Miami',
    state: 'FL',
  })
  assert.equal(brand.displayName, 'QA MULTICOMPANY')
  assert.equal(brand.location, 'Miami, Florida')
  assert.equal(brand.assistantName, 'Assistant')
  assert.match(brand.assistantRole, /QA MULTICOMPANY/)
  assert.equal(expandRegionName('FL'), 'Florida')
})

test('assistant persona rule accepts both raw and wrapped values', () => {
  const raw = parseAssistantPersonaRule({
    name: 'Brasinha',
    role: 'Assistente digital da CDL Services BBQ At Home.',
    location_label: 'Orlando, Florida',
    occasional_emoji: '🔥',
  })
  assert.equal(raw.name, 'Brasinha')
  assert.equal(raw.locationLabel, 'Orlando, Florida')
  const wrapped = parseAssistantPersonaRule({
    value: { name: 'Host', role: 'Concierge' },
  })
  assert.equal(wrapped.name, 'Host')
})

test('Company B does not inherit Orlando when settings are empty', () => {
  assert.equal(
    resolveProposalCompanyLocation({
      city: 'Miami',
      state: 'FL',
    }),
    'Miami, Florida',
  )
  assert.equal(resolveProposalCompanyLocation({}), null)
  assert.equal(
    resolveProposalCompanyLocation({ locationLabel: 'Orlando, Florida' }),
    'Orlando, Florida',
  )
})

test('engine files no longer switch on the CDL company UUID', () => {
  const persona = readFileSync(new URL('../brasinha/persona.ts', import.meta.url), 'utf8')
  const brand = readFileSync(new URL('./companyPublicBrand.ts', import.meta.url), 'utf8')
  const invoicePdf = readFileSync(
    new URL('../../components/payments/InvoicePdfDocument.tsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(persona, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
  assert.doesNotMatch(brand, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
  assert.doesNotMatch(invoicePdf, /CDL BBQ AT HOME/)
  assert.doesNotMatch(invoicePdf, /Orlando, Florida/)
})
