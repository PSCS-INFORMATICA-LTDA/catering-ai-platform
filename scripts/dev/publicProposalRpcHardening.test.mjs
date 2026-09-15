import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyProposalRpcCall, isHardened } from './publicProposalRpcHardening.mjs'

test('42703 means the RPC still executed', () => {
  const result = classifyProposalRpcCall(null, {
    code: '42703',
    message: 'column c.name does not exist',
  })
  assert.equal(result.executable, true)
  assert.equal(result.kind, 'executed_broken_schema')
  assert.equal(isHardened(result), false)
})

test('permission denied is no execute', () => {
  const result = classifyProposalRpcCall(null, {
    code: '42501',
    message: 'permission denied for function get_public_quote_proposal',
  })
  assert.equal(result.executable, false)
  assert.equal(result.kind, 'no_execute')
  assert.equal(isHardened(result), true)
})

test('schema cache miss is no execute', () => {
  const result = classifyProposalRpcCall(null, {
    code: 'PGRST202',
    message: 'Could not find the function public.get_public_quote_proposal in the schema cache',
  })
  assert.equal(result.executable, false)
  assert.equal(isHardened(result), true)
})

test('successful payload means still executable', () => {
  const result = classifyProposalRpcCall({ found: false }, null)
  assert.equal(result.executable, true)
  assert.equal(isHardened(result), false)
})
