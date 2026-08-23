/**
 * Mensagem de confirmação de escala — saudação + espaçamento + slots.
 * Uso: node scripts/dev/test-team-confirmation-message.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const msgSrc = readFileSync(join(ROOT, 'Lib/teamMemberConfirmation.ts'), 'utf8')
const scaleSrc = readFileSync(join(ROOT, 'Lib/agenda/teamScale.ts'), 'utf8')
const panelSrc = readFileSync(
  join(ROOT, 'components/orders/OrderTeamConfirmationsPanel.tsx'),
  'utf8',
)
const routeSrc = readFileSync(
  join(ROOT, 'app/api/orders/[id]/team-confirmations/route.ts'),
  'utf8',
)

assert.match(msgSrc, /personName\?:/)
assert.match(msgSrc, /Olá, \$\{hello\},/)
assert.match(msgSrc, /Tudo bem\?/)
assert.match(msgSrc, /''/) // blank lines in join arrays
assert.match(msgSrc, /SECTION/)

assert.match(scaleSrc, /export function buildTeamScaleSlots/)
assert.match(scaleSrc, /Ajudante/)

assert.match(panelSrc, /tCommon\(locale, 'select'\)/)
assert.match(panelSrc, /optionsForSlot/)
assert.match(panelSrc, /role_keys\.includes\(slot\.role_key\)/)
assert.match(panelSrc, /updateSlotPerson/)
assert.match(panelSrc, /whitespace-pre-wrap/)
assert.match(panelSrc, /members: selectedMembers/)

assert.match(routeSrc, /body\.members/)
assert.match(routeSrc, /personName/)
assert.match(routeSrc, /candidates/)
assert.match(routeSrc, /loadOrderScaleCandidates/)
assert.match(routeSrc, /ensureAgendaEventForOrder/)
assert.match(routeSrc, /Substituído na escala do evento/)

console.log('PASS  greeting + personName in template')
console.log('PASS  scale slots helper present')
console.log('PASS  panel has role list selectors')
console.log('PASS  API accepts selected members')
console.log('TEAM CONFIRMATION MESSAGE: PASS')
