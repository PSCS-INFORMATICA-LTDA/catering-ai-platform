import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PaypalSandboxRequestError,
  issueFromUnknownCaptureError,
  parsePaypalSandboxError,
  readPaypalDebugIdHeader,
} from './sandboxError.ts'
import { sanitizePaypalSandboxLog } from './sandboxLog.ts'

test('parses PayPal name, debug_id, issue and HTTP status', () => {
  const issue = parsePaypalSandboxError({
    httpStatus: 422,
    debugIdHeader: 'HDR-DEBUG',
    fallbackCode: 'PAYPAL_CAPTURE_FAILED',
    orderId: '9D355331DA1112410',
    body: {
      name: 'UNPROCESSABLE_ENTITY',
      debug_id: 'PP-DEBUG-1',
      details: [{ issue: 'ORDER_NOT_APPROVED' }],
      access_token: 'should-not-be-copied',
      client_secret: 'should-not-be-copied',
    },
  })
  assert.equal(issue.code, 'PAYPAL_CAPTURE_FAILED')
  assert.equal(issue.httpStatus, 422)
  assert.equal(issue.paypalName, 'UNPROCESSABLE_ENTITY')
  assert.equal(issue.debugId, 'PP-DEBUG-1')
  assert.equal(issue.issue, 'ORDER_NOT_APPROVED')
  assert.equal(issue.orderId, '9D355331DA1112410')
  assert.equal(issue.alreadyCaptured, false)
  assert.equal('access_token' in issue, false)
  assert.equal('client_secret' in issue, false)
})

test('ORDER_ALREADY_CAPTURED is flagged for idempotent reconcile', () => {
  const issue = parsePaypalSandboxError({
    httpStatus: 422,
    fallbackCode: 'PAYPAL_CAPTURE_FAILED',
    body: {
      name: 'UNPROCESSABLE_ENTITY',
      debug_id: 'DUP-1',
      details: [{ issue: 'ORDER_ALREADY_CAPTURED' }],
    },
  })
  assert.equal(issue.alreadyCaptured, true)
  assert.equal(issue.code, 'PAYPAL_ORDER_ALREADY_CAPTURED')
})

test('auth failures keep the error name and never retain tokens', () => {
  const issue = parsePaypalSandboxError({
    httpStatus: 401,
    fallbackCode: 'PAYPAL_AUTH_FAILED',
    body: { error: 'invalid_client', access_token: 'secret-token' },
  })
  assert.equal(issue.paypalName, 'invalid_client')
  assert.equal(issue.code, 'PAYPAL_AUTH_FAILED')
  assert.deepEqual(Object.keys(issue).sort(), [
    'alreadyCaptured',
    'captureStatus',
    'code',
    'debugId',
    'httpStatus',
    'issue',
    'orderId',
    'paypalName',
  ])
})

test('debug id header is used when the body omits debug_id', () => {
  const headers = new Map([['paypal-debug-id', 'FROM-HEADER']])
  assert.equal(
    readPaypalDebugIdHeader({ get: (name) => headers.get(name.toLowerCase()) || null }),
    'FROM-HEADER',
  )
})

test('sanitized logs keep diagnosis fields and drop secrets', () => {
  const sanitized = sanitizePaypalSandboxLog({
    action: 'capture',
    requestId: 'abc123',
    invoiceId: 'inv-1',
    purpose: 'deposit',
    orderId: 'ORDER-1',
    environment: 'live',
    httpStatus: 422,
    paypalName: 'UNPROCESSABLE_ENTITY',
    debugId: 'DBG',
    captureStatus: 'PENDING',
    issue: 'ORDER_NOT_APPROVED',
    result: 'failed',
    clientSecret: 'super-secret',
    access_token: 'token-value',
    password: 'buyer-pass',
    card: '4111111111111111',
    buyerEmail: 'buyer@example.com',
  })
  assert.equal(sanitized.environment, 'sandbox')
  assert.equal(sanitized.action, 'capture')
  assert.equal(sanitized.invoiceId, 'inv-1')
  assert.equal(sanitized.purpose, 'deposit')
  assert.equal(sanitized.orderId, 'ORDER-1')
  assert.equal(sanitized.httpStatus, 422)
  assert.equal(sanitized.paypalName, 'UNPROCESSABLE_ENTITY')
  assert.equal(sanitized.debugId, 'DBG')
  assert.equal(sanitized.captureStatus, 'PENDING')
  assert.equal(sanitized.requestId, 'abc123')
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'clientSecret'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'access_token'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'password'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'card'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'buyerEmail'), false)
})

test('unknown capture errors stay generic and typed', () => {
  const issue = issueFromUnknownCaptureError(new Error('boom'), 'ORDER-9')
  assert.equal(issue.code, 'PAYPAL_CAPTURE_FAILED')
  assert.equal(issue.orderId, 'ORDER-9')
  const typed = issueFromUnknownCaptureError(
    new PaypalSandboxRequestError(
      parsePaypalSandboxError({
        httpStatus: 500,
        fallbackCode: 'PAYPAL_CAPTURE_FAILED',
        body: { name: 'INTERNAL_SERVICE_ERROR', debug_id: 'X' },
      }),
    ),
    'ORDER-9',
  )
  assert.equal(typed.debugId, 'X')
  assert.equal(typed.paypalName, 'INTERNAL_SERVICE_ERROR')
})
