/**
 * Shared classifier for get_public_quote_proposal execute proofs.
 * A 42703 / column c.name error means the function still executed.
 * Permission / schema-cache misses mean the role cannot execute it.
 */

const EXECUTED = /42703|column c\.name does not exist|column .* does not exist/i
const NO_EXECUTE =
  /42501|permission denied|not granted|PGRST301|PGRST302|unauthorized|forbidden|42501/i
const NOT_IN_CACHE = /PGRST202|could not find the function|function .* not found/i

export function classifyProposalRpcCall(data, error) {
  const code = error?.code || null
  const text = [error?.message, error?.details, error?.hint, code]
    .filter(Boolean)
    .join(' ')
  if (!error && data != null) {
    return { executable: true, kind: 'executed_ok', code, text: '' }
  }
  if (EXECUTED.test(text) || code === '42703') {
    return { executable: true, kind: 'executed_broken_schema', code, text }
  }
  if (NOT_IN_CACHE.test(text)) {
    return { executable: false, kind: 'not_in_schema_cache', code, text }
  }
  if (NO_EXECUTE.test(text) || code === '42501') {
    return { executable: false, kind: 'no_execute', code, text }
  }
  if (error) {
    return { executable: null, kind: 'unknown_error', code, text }
  }
  return { executable: null, kind: 'empty', code, text }
}

export function isHardened(result) {
  return result?.executable === false
}
