import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveServiceOrderPackageId } from './resolveServiceOrderPackageId.ts'

test('snapshot package wins, then selection, then the quote', () => {
  assert.equal(
    resolveServiceOrderPackageId({
      snapshotPackageId: 'snap',
      selectionPackageId: 'sel',
      quotePackageId: 'quote',
    }),
    'snap',
  )
  assert.equal(
    resolveServiceOrderPackageId({
      snapshotPackageId: '  ',
      selectionPackageId: 'sel',
      quotePackageId: 'quote',
    }),
    'sel',
  )
  assert.equal(
    resolveServiceOrderPackageId({
      selectionPackageId: null,
      quotePackageId: 'quote',
    }),
    'quote',
  )
  assert.equal(resolveServiceOrderPackageId({}), null)
})
