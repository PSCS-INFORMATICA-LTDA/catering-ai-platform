import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const resolveSrc = readFileSync(new URL('./resolveTenant.ts', import.meta.url), 'utf8')
const cdlSrc = readFileSync(new URL('../cdlCompany.ts', import.meta.url), 'utf8')
const requireSrc = readFileSync(new URL('../auth/requireApi.ts', import.meta.url), 'utf8')
const layoutSrc = readFileSync(
  new URL('../../components/quote-review/QuoteReviewLayout.tsx', import.meta.url),
  'utf8',
)
const pdfSrc = readFileSync(
  new URL('../../app/quotes/[id]/QuotePdfDocument.tsx', import.meta.url),
  'utf8',
)

test('getActiveCompanyId has no hardcoded CDL UUID fallback', () => {
  assert.doesNotMatch(resolveSrc, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
  assert.match(resolveSrc, /company_context_required/)
  assert.match(cdlSrc, /TEST_FIXTURE/)
})

test('authorized company id is session-only and fail-closed', () => {
  assert.doesNotMatch(requireSrc, /getCdlCompanyId/)
  assert.match(requireSrc, /resolveSessionCompanyId/)
})

test('quote proposal no longer hardcodes Orlando, Florida', () => {
  assert.doesNotMatch(layoutSrc, /Orlando, Florida/)
  assert.doesNotMatch(pdfSrc, /Orlando, Florida/)
  assert.match(layoutSrc, /resolveProposalCompanyLocation/)
})
