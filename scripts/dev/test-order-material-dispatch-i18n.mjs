/**
 * QA — i18n da conferência pública de saída (PT/EN/ES).
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = readFileSync(join(ROOT, 'Lib/i18n/quotesOrders.ts'), 'utf8')
const client = readFileSync(
  join(ROOT, 'app/conferencia-saida/[token]/PublicMaterialDispatchClient.tsx'),
  'utf8',
)
const page = readFileSync(
  join(ROOT, 'app/conferencia-saida/[token]/page.tsx'),
  'utf8',
)
const shell = readFileSync(
  join(ROOT, 'components/layout/AuthenticatedShell.tsx'),
  'utf8',
)

let failures = 0
function pass(label) {
  console.log('PASS  ' + label)
}
function fail(label, detail) {
  failures++
  console.log('FAIL  ' + label + (detail ? ' — ' + detail : ''))
}

console.log('=== TEST ORDER MATERIAL DISPATCH I18N / SHELL ===')

const keys = [
  'publicDispatchTitle',
  'publicDispatchConfirmPickup',
  'publicDispatchPickupConfirmed',
  'publicDispatchLinkInvalid',
  'publicDispatchLinkExpired',
  'publicDispatchLinkRevoked',
  'publicDispatchMaterials',
  'publicDispatchCheckedQty',
  'publicDispatchPickupQty',
  'publicDispatchEvent',
  'publicDispatchDate',
  'publicDispatchTime',
  'publicDispatchLocation',
  'publicDispatchTeam',
  'publicDispatchErrorGeneric',
  'publicDispatchRetry',
]

for (const key of keys) {
  const count = (src.match(new RegExp(`${key}:`, 'g')) || []).length
  if (count >= 3) pass(`i18n key ${key} ×${count}`)
  else fail(`i18n key ${key}`, `count=${count}`)
}

// Expected phrases in source dict
const checks = [
  ['PT confirm', /publicDispatchConfirmPickup: 'Confirmar retirada'/],
  ['EN confirm', /publicDispatchConfirmPickup: 'Confirm pickup'/],
  ['ES confirm', /publicDispatchConfirmPickup: 'Confirmar retiro'/],
  ['PT confirmed', /publicDispatchPickupConfirmed: 'Retirada confirmada'/],
  ['EN confirmed', /publicDispatchPickupConfirmed: 'Pickup confirmed'/],
  ['ES confirmed', /publicDispatchPickupConfirmed: 'Retiro confirmado'/],
  ['PT expired', /publicDispatchLinkExpired: 'Link expirado'/],
  ['EN expired', /publicDispatchLinkExpired: 'Expired link'/],
  ['ES expired', /publicDispatchLinkExpired: 'Enlace vencido'/],
  ['PT revoked', /publicDispatchLinkRevoked: 'Link revogado'/],
  ['EN revoked', /publicDispatchLinkRevoked: 'Revoked link'/],
  ['ES revoked', /publicDispatchLinkRevoked: 'Enlace revocado'/],
  ['PT invalid', /publicDispatchLinkInvalid: 'Link inválido'/],
  ['EN invalid', /publicDispatchLinkInvalid: 'Invalid link'/],
  ['ES invalid', /publicDispatchLinkInvalid: 'Enlace inválido'/],
]
for (const [label, re] of checks) {
  if (re.test(src)) pass(label)
  else fail(label)
}

if (/tQuotesOrders\(locale/.test(client) && /tQuotesOrders\(locale/.test(page)) {
  pass('page/client usam tQuotesOrders')
} else fail('page/client i18n wiring')

const hardcodedPt =
  /CONFIRMAR RETIRADA|Retirada confirmada|Link expirado|Link revogado|Conferência de saída/.test(
    client,
  ) ||
  /Link não encontrado|Link expirado|Solicite um novo link/.test(page)
if (!hardcodedPt) pass('sem copy PT hardcoded relevante')
else fail('copy PT hardcoded restante')

if (shell.includes("pathname.startsWith('/conferencia-saida/')")) {
  pass('T01–T03 shell: conferencia-saida em isPublicPath')
} else fail('shell public path')

for (const p of [
  '/confirmacao-equipe/',
  '/confirmacao-guarnicao/',
  '/designacao-equipe/',
]) {
  if (shell.includes(`pathname.startsWith('${p}')`)) pass(`shell public ${p}`)
  else fail(`shell public ${p}`)
}

if (shell.includes('AppShell') && shell.includes('isPublicPath')) {
  pass('T04 sessão: shell público não chama logout (só omite AppShell)')
} else fail('T04 shell pattern')

console.log(
  failures === 0
    ? 'ORDER MATERIAL DISPATCH I18N/SHELL: PASS — failures=0'
    : `ORDER MATERIAL DISPATCH I18N/SHELL: FAIL — failures=${failures}`,
)
process.exit(failures === 0 ? 0 : 1)
