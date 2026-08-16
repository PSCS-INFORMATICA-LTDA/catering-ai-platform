/**
 * Pedido de guarnição — template WhatsApp + kits CDL HC–HK
 * Run: node --experimental-strip-types scripts/dev/test-supplier-garnish-message.mjs
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const mod = await import(
  pathToFileURL(join(ROOT, 'Lib/whatsappMessageTemplates.ts')).href
)
const kitRule = await import(
  pathToFileURL(join(ROOT, 'Lib/supplierGarnishKitRule.ts')).href
)
const CFG = kitRule.CDL_SUPPLIER_GARNISH_KIT_CONFIG

function packing(totalPeople, adultCount = totalPeople) {
  const result = kitRule.computeGarnishKitsFromConfig(CFG, {
    hasGarnish: true,
    totalPeople,
    adultCount,
  })
  return kitRule.toSupplierGarnishCdlKitsInput(result, 'pt')
}

function compute(totalPeople, adultCount = totalPeople) {
  return kitRule.computeGarnishKitsFromConfig(CFG, {
    hasGarnish: true,
    totalPeople,
    adultCount,
  })
}

// Sem regra da empresa → sem kits (multiempresa)
assert.equal(
  kitRule.computeGarnishKitsFromConfig(null, {
    hasGarnish: true,
    totalPeople: 40,
  }).items.length,
  0,
)
assert.equal(
  kitRule.computeGarnishKitsFromConfig(
    { ...CFG, enabled: false },
    { hasGarnish: true, totalPeople: 40 },
  ).items.length,
  0,
)

// Faixas HC/HD (ET = totalPeople) — via config CDL
const small = compute(25, 25)
assert.equal(small.largeKits, 0)
assert.equal(small.smallKits, 1)
assert.equal(small.items.find((i) => i.key === 'vinagrete')?.units, 2)
assert.equal(
  small.items.find((i) => i.key === 'arroz_branco_pequeno')?.units,
  2,
)
assert.equal(
  small.items.find((i) => i.key === 'feijao_tropeiro_pequeno')?.units,
  1,
)

const mid = compute(30, 30)
assert.equal(mid.largeKits, 1)
assert.equal(mid.smallKits, 0)
assert.equal(
  mid.items.find((i) => i.key === 'arroz_branco_grande')?.units,
  2,
)
assert.equal(mid.items.find((i) => i.key === 'vinagrete')?.units, 4)

const combo = compute(55, 55)
assert.equal(combo.largeKits, 1)
assert.equal(combo.smallKits, 1)
assert.equal(combo.items.find((i) => i.key === 'vinagrete')?.units, 6)

const big = compute(80, 80)
assert.equal(big.largeKits, 2)
assert.equal(big.smallKits, 0)
assert.equal(
  big.items.find((i) => i.key === 'arroz_branco_grande')?.units,
  3,
)
assert.equal(big.items.find((i) => i.key === 'vinagrete')?.units, 8)

assert.equal(
  kitRule.computeGarnishKitsFromConfig(CFG, {
    hasGarnish: false,
    totalPeople: 40,
  }).items.length,
  0,
)

const msg = mod.buildSupplierGarnishWhatsAppText({
  supplierName: 'Restaurante Central',
  orderNumber: 'OS-0007',
  eventDate: '2026-10-07',
  eventStartTime: '12:00',
  eventEndTime: '16:00',
  pickupTime: '10:00',
  teamName: 'Equipe Caio',
  garnishItems: ['Arroz branco', 'Feijão preto', 'Vinagrete', 'Farofa'],
  guestCount: 30,
  adultCount: 30,
  cdlKits: packing(30, 30),
  language: 'pt',
})

assert.match(msg, /Pedido de guarnição/)
assert.match(msg, /OS-0007/)
assert.match(msg, /Equipe Caio/)
assert.match(msg, /10:00/)
assert.match(msg, /\*Kits CDL\*/)
assert.match(msg, /Guarnição grande: 1/)
assert.match(msg, /Guarnição pequena: 0/)
assert.match(msg, /Arroz branco grande — 2 UN/)
assert.match(msg, /Feijão tropeiro grande — 1 UN/)
assert.match(msg, /Maionese grande — 1 UN/)
assert.match(msg, /Vinagrete — 4 UN/)
assert.match(msg, /\*Itens extras\*/)
assert.match(msg, /Farofa — 30 porções/)
assert.doesNotMatch(msg, /Arroz branco — 30 porções/)
assert.match(msg, /RECEBIDO|link abaixo/)
assert.match(msg, /────────/)
assert.match(msg, /\*Dados do pedido\*/)
assert.match(msg, /\*Itens \/ UN \(kit CDL\)\*/)
assert.match(msg, /\*Confirmação\*/)
assert.match(msg, /\*Data:\*/)
assert.match(msg, /\*BBQ At Home\*/)

assert.equal(
  mod.formatSupplierGarnishServingLine('Arroz branco (×25)', 30, 'porções'),
  'Arroz branco — 25 porções',
)

const withLink = mod.buildSupplierGarnishWhatsAppText({
  supplierName: 'Restaurante Central',
  orderNumber: 'OS-0007',
  eventDate: '2026-10-07',
  eventStartTime: '12:00',
  pickupTime: '10:00',
  garnishItems: ['Arroz branco'],
  guestCount: 25,
  adultCount: 25,
  cdlKits: packing(25, 25),
  language: 'pt',
  confirmUrl: 'https://example.com/confirmacao-guarnicao/abc123',
})
assert.match(withLink, /acesse o link abaixo/)
assert.match(withLink, /confirmacao-guarnicao\/abc123/)
assert.match(withLink, /Guarnição pequena: 1/)
assert.match(withLink, /Arroz branco pequeno — 2 UN/)
assert.doesNotMatch(withLink, /RECEBIDO/)

const teamMsg = mod.buildTeamAvailabilityWhatsAppText({
  teamName: 'Equipe Caio',
  leaderName: 'Caio',
  eventCode: 'EVT-SUP-001',
  eventTitle: 'Churrasco teste',
  clientName: 'Cliente Demo',
  eventDate: '2026-10-07',
  startTime: '12:00',
  endTime: '16:00',
  presentationTime: '11:00',
  address: 'Orlando, FL',
  packageLabel: 'BBQPRI+',
  language: 'pt',
})

assert.match(teamMsg, /Designação EVT-SUP-001/)
assert.match(teamMsg, /────────/)
assert.match(teamMsg, /\*Dados do evento\*/)
assert.match(teamMsg, /\*Confirmação\*/)
assert.match(teamMsg, /\*Equipe:\* Equipe Caio/)
assert.match(teamMsg, /\*Horário de apresentação no local:\* 11:00/)
assert.match(teamMsg, /\*BBQ At Home\*/)

const philippeMsg = mod.buildTeamAvailabilityWhatsAppText({
  teamName: 'Equipe Philippe',
  leaderName: mod.resolveTeamLeaderDisplayName({
    contactFullName: 'Philippe Santana',
    contactAbName: 'Philippe Santana (teste)',
    teamName: 'Equipe Philippe',
    notes: 'Líder: Filipe | Contato teste: Philippe Santana',
  }),
  eventCode: 'EVT-PH',
  eventTitle: 'Teste Philippe',
  eventDate: '2026-10-14',
  startTime: '12:00',
  endTime: '16:00',
  language: 'pt',
})
assert.match(philippeMsg, /Olá, Philippe,/)
assert.doesNotMatch(philippeMsg, /Olá, Filipe,/)

assert.equal(mod.subtractHoursFromTime('12:00', 2), '10:00')
assert.equal(mod.subtractHoursFromTime('01:00', 2), '23:00')

console.log('PASS  supplier + team WhatsApp templates (CDL kits HC–HK)')
