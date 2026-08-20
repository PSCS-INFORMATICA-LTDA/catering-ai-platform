/**
 * Public quote namespace vs backoffice /quotes.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-routes.mjs
 */
import assert from 'node:assert/strict'
import {
  isBackofficeQuotesPathname,
  isPublicQuotePathname,
  isPublicRoutePathname,
} from '../../Lib/publicRoutes.ts'

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

test('/quote/cdl/pt is public', () => {
  assert.equal(isPublicRoutePathname('/quote/cdl/pt'), true)
  assert.equal(isPublicQuotePathname('/quote/cdl/pt'), true)
})

test('/quote/cdl/en is public', () => {
  assert.equal(isPublicRoutePathname('/quote/cdl/en'), true)
  assert.equal(isPublicQuotePathname('/quote/cdl/en'), true)
})

test('/quote/cdl/es is public', () => {
  assert.equal(isPublicRoutePathname('/quote/cdl/es'), true)
  assert.equal(isPublicQuotePathname('/quote/cdl/es'), true)
})

test('/quotes is not public', () => {
  assert.equal(isBackofficeQuotesPathname('/quotes'), true)
  assert.equal(isPublicRoutePathname('/quotes'), false)
  assert.equal(isPublicQuotePathname('/quotes'), false)
})

test('/quotes/new is not public', () => {
  assert.equal(isPublicRoutePathname('/quotes/new'), false)
  assert.equal(isPublicQuotePathname('/quotes/new'), false)
})

test('/quote-admin is not public', () => {
  assert.equal(isPublicRoutePathname('/quote-admin'), false)
  assert.equal(isPublicQuotePathname('/quote-admin'), false)
})

test('/cdl/video how-it-works file is public', () => {
  assert.equal(
    isPublicRoutePathname('/cdl/video/cdl-como-funciona.mp4'),
    true,
  )
  assert.equal(isPublicRoutePathname('/quotes'), false)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
