/**
 * Seed DEV — 4 equipes + eventos de fim de semana + cotações realistas.
 *
 * Cada evento fecha uma cotação approved com:
 *   - pacote BBQ
 *   - adultos / crianças ≤3 / crianças 4–12
 *   - adicionais (por pessoa e/ou unidade)
 *   - milhagem
 *   - package_total + additional_total + mileage_fee + quote_total
 *
 * Uso:
 *   node scripts/dev/seed-agenda-teams-demo.mjs           # dry-run
 *   node scripts/dev/seed-agenda-teams-demo.mjs --apply
 *
 * Project Ref: yasprgtlqclwsjcshtls (DEV). PROD bloqueado.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const apply = process.argv.includes('--apply')

const PACKAGE_KEYS = [
  'BBQTRAD',
  'BBQSEL',
  'BBQCHO',
  'BBQPRI',
  'BBQTRAD+',
  'BBQSEL+',
  'BBQCHO+',
  'BBQPRI+',
]

/** Preferências de adicionais por evento (item_key). */
const ADDITIONAL_PICKS = [
  ['ITEM_002', 'ITEM_075', 'ITEM_084'], // Alcatra + Arroz + Churrasqueira
  ['ITEM_006', 'ITEM_FEIJAO_PRETO'], // Assado de tiras + Feijão
  ['ITEM_FRALDINHA', 'ITEM_079', 'ITEM_069'], // Fraldinha + Farofa + Batata frita
  ['ITEM_050', 'ITEM_084'], // Camarão + Churrasqueira
  ['ITEM_003', 'ITEM_081', 'ITEM_055'], // Costela Angus + Tropeiro + Abacaxi
  ['ITEM_010', 'ITEM_075'], // Fraldinha Wagyu + Arroz
  ['ITEM_015', 'ITEM_076', 'ITEM_084'], // Carré + Maionese + Churrasqueira
  ['ITEM_017', 'ITEM_043', 'ITEM_FEIJAO_PRETO'],
]

const TEAMS = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Equipe Ricardo',
    color: '#e21b1b',
    leader: 'Ricardo',
    members: ['Ana Souza', 'Bruno Lima'],
    sat: { date: '2026-08-08', start: '10:00:00', end: '14:00:00' },
    sun: { date: '2026-08-09', start: '10:00:00', end: '14:00:00' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    name: 'Equipe Filipe',
    color: '#2563eb',
    leader: 'Filipe',
    members: ['Carla Mendes', 'Diego Alves'],
    sat: { date: '2026-08-08', start: '12:00:00', end: '16:00:00' },
    sun: { date: '2026-08-09', start: '12:00:00', end: '16:00:00' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    name: 'Equipe Caio',
    color: '#16a34a',
    leader: 'Caio',
    members: ['Elena Rocha', 'Felipe Costa'],
    sat: { date: '2026-08-08', start: '14:00:00', end: '18:00:00' },
    sun: { date: '2026-08-09', start: '14:00:00', end: '18:00:00' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    name: 'Equipe Maicon',
    color: '#ca8a04',
    leader: 'Maicon',
    members: ['Gabriela Nunes', 'Henrique Dias'],
    sat: { date: '2026-08-08', start: '16:00:00', end: '20:00:00' },
    sun: { date: '2026-08-09', start: '16:00:00', end: '20:00:00' },
  },
]

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function refOf(url) {
  return (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
}

function notesFor(team) {
  return `Líder: ${team.leader} | Membros: ${team.members.join(', ')}`
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function padId(n) {
  return String(n).padStart(12, '0')
}

function ruleNumber(rulesByKey, key, fallback) {
  const raw = rulesByKey.get(key)
  if (raw == null) return fallback
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const n = Number(raw.value)
    return Number.isFinite(n) ? n : fallback
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function calcBillableGuestCount(adults, children4to12) {
  return roundMoney(adults + children4to12 * 0.5)
}

function calcPhysicalGuestCount(adults, under3, children4to12) {
  return adults + under3 + children4to12
}

function calcMileageFee(distance, freeLimit, rate) {
  return roundMoney(Math.max(0, distance - freeLimit) * rate)
}

function calcAdditionalLineTotal(line, billableGuestCount) {
  if (line.quantity <= 0) return 0
  if (line.perPerson) return roundMoney(line.unitPrice * billableGuestCount)
  return roundMoney(line.unitPrice * line.quantity)
}

function guestMix(n) {
  // Variar mix para a simulação parecer real
  const adults = 24 + n * 4 + (n % 3) * 2
  const childrenUnder3 = n % 2 === 0 ? 2 + (n % 3) : 1
  const children4To12 = 4 + (n % 5)
  return { adults, childrenUnder3, children4To12 }
}

function buildDemoRows(packagesByKey, additionalsByKey, rulesByKey) {
  const freeLimit = ruleNumber(rulesByKey, 'mileage_free_limit', 20)
  const mileageRate = ruleNumber(rulesByKey, 'mileage_rate', 2)
  const reservationPct = ruleNumber(rulesByKey, 'deposit_percentage', 30)

  const rows = []
  let n = 0
  for (const team of TEAMS) {
    for (const slot of [
      { ...team.sat, dayLabel: 'Sábado' },
      { ...team.sun, dayLabel: 'Domingo' },
    ]) {
      n += 1
      const pkgKey = PACKAGE_KEYS[(n - 1) % PACKAGE_KEYS.length]
      const pkg = packagesByKey.get(pkgKey)
      if (!pkg) throw new Error(`Pacote ${pkgKey} não encontrado no DEV`)

      const { adults, childrenUnder3, children4To12 } = guestMix(n)
      const billableGuestCount = calcBillableGuestCount(adults, children4To12)
      const physicalGuestCount = calcPhysicalGuestCount(
        adults,
        childrenUnder3,
        children4To12,
      )
      const price = Number(pkg.price_per_person || 0)
      const packageTotal = roundMoney(price * billableGuestCount)

      const pickKeys = ADDITIONAL_PICKS[(n - 1) % ADDITIONAL_PICKS.length]
      const additionals = []
      for (const key of pickKeys) {
        const item = additionalsByKey.get(key)
        if (!item) continue
        const perPerson =
          item.pricing_type === 'PER_PERSON' || item.charge_type === 'PERSON'
        const unitPrice = Number(item.sale_price ?? item.price ?? 0)
        if (unitPrice <= 0) continue
        const quantity = perPerson ? 1 : 1
        const totalPrice = calcAdditionalLineTotal(
          { quantity, unitPrice, perPerson },
          billableGuestCount,
        )
        additionals.push({
          itemId: item.id,
          itemKey: item.item_key,
          name: item.label_pt || item.item_name,
          quantity,
          unitPrice,
          perPerson,
          totalPrice,
        })
      }

      // Garantir ao menos 1 adicional se o catálogo tiver itens
      if (additionals.length === 0 && additionalsByKey.size > 0) {
        const fallback = [...additionalsByKey.values()].find(
          (i) => Number(i.sale_price ?? i.price ?? 0) > 0,
        )
        if (fallback) {
          const unitPrice = Number(fallback.sale_price ?? fallback.price)
          const perPerson =
            fallback.pricing_type === 'PER_PERSON' ||
            fallback.charge_type === 'PERSON'
          additionals.push({
            itemId: fallback.id,
            itemKey: fallback.item_key,
            name: fallback.label_pt || fallback.item_name,
            quantity: 1,
            unitPrice,
            perPerson,
            totalPrice: calcAdditionalLineTotal(
              { quantity: 1, unitPrice, perPerson },
              billableGuestCount,
            ),
          })
        }
      }

      const additionalTotal = roundMoney(
        additionals.reduce((s, line) => s + line.totalPrice, 0),
      )
      const mileageDistance = 12 + n * 7 // algumas abaixo e acima do free limit
      const mileageFee = calcMileageFee(mileageDistance, freeLimit, mileageRate)
      const quoteTotal = roundMoney(packageTotal + additionalTotal + mileageFee)
      const reservationAmount = roundMoney(quoteTotal * (reservationPct / 100))
      const balanceDue = roundMoney(quoteTotal - reservationAmount)
      const start = slot.start.slice(0, 5)
      const end = slot.end.slice(0, 5)

      rows.push({
        n,
        team,
        slot,
        pkg,
        pkgKey,
        adults,
        childrenUnder3,
        children4To12,
        billableGuestCount,
        physicalGuestCount,
        price,
        packageTotal,
        additionals,
        additionalTotal,
        mileageDistance,
        mileageFee,
        quoteTotal,
        reservationPct,
        reservationAmount,
        balanceDue,
        agendaEventId: `b1000000-0000-4000-8000-${padId(n)}`,
        cateringEventId: `c1000000-0000-4000-8000-${padId(n)}`,
        quoteId: `c1100000-0000-4000-8000-${padId(n)}`,
        customerId: `c1200000-0000-4000-8000-${padId(n)}`,
        agendaCode: `EVT-DEMO-${String(n).padStart(3, '0')}`,
        quoteNumber: `DEV-AGENDA-${String(n).padStart(3, '0')}`,
        title: `Evento ${team.leader} — ${slot.dayLabel}`,
        clientName: `Cliente Demo ${team.leader}`,
        start,
        end,
      })
    }
  }
  return rows
}

async function main() {
  console.log(
    `\n=== seed-agenda-teams-demo (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`,
  )
  const env = loadEnv()
  const ref = refOf(env.url)
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }

  const sb = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pkgs, error: pkgErr } = await sb
    .from('packages')
    .select('id, package_key, label_pt, price_per_person, active')
    .eq('company_id', CDL)
    .in('package_key', PACKAGE_KEYS)
  if (pkgErr) throw new Error(pkgErr.message)

  const packagesByKey = new Map()
  for (const p of pkgs || []) packagesByKey.set(p.package_key, p)
  for (const key of PACKAGE_KEYS) {
    if (!packagesByKey.has(key)) {
      throw new Error(`Falta pacote ${key} no DEV — rode sync:dev:commercial`)
    }
  }

  const { data: catalog, error: catErr } = await sb
    .from('catalog_items')
    .select(
      'id, item_key, label_pt, item_name, price, sale_price, pricing_type, charge_type, can_be_additional, active',
    )
    .eq('company_id', CDL)
    .eq('active', true)
    .eq('can_be_additional', true)
  if (catErr) throw new Error(catErr.message)

  const additionalsByKey = new Map()
  for (const item of catalog || []) {
    if (item.item_key) additionalsByKey.set(item.item_key, item)
  }

  const { data: rules, error: rulesErr } = await sb
    .from('commercial_rules')
    .select('rule_key, rule_value')
    .eq('company_id', CDL)
  if (rulesErr) throw new Error(rulesErr.message)
  const rulesByKey = new Map()
  for (const r of rules || []) rulesByKey.set(r.rule_key, r.rule_value)

  const demo = buildDemoRows(packagesByKey, additionalsByKey, rulesByKey)

  console.log('Simulação por evento (pacote · convidados · adicionais · total):')
  for (const row of demo) {
    const addLabels = row.additionals
      .map((a) => `${a.name}${a.perPerson ? '/p' : ''} $${a.totalPrice}`)
      .join(' + ')
    console.log(
      `  ${row.agendaCode} | ${row.pkgKey} $${row.price}/p | ` +
        `A${row.adults} ≤3:${row.childrenUnder3} 4-12:${row.children4To12} ` +
        `(billable ${row.billableGuestCount}) | ` +
        `pkg $${row.packageTotal} + add $${row.additionalTotal} + mi $${row.mileageFee} ` +
        `= TOTAL $${row.quoteTotal}`,
    )
    console.log(`           adicionais: ${addLabels || '(nenhum)'}`)
  }

  if (!apply) {
    console.log('\nDry-run OK. Rode com --apply.')
    return
  }

  const teamRows = TEAMS.map((t) => ({
    id: t.id,
    company_id: CDL,
    name: t.name,
    color: t.color,
    notes: notesFor(t),
    active: true,
  }))
  const { error: teamErr } = await sb
    .from('operational_teams')
    .upsert(teamRows, { onConflict: 'id' })
  if (teamErr) throw new Error(`teams: ${teamErr.message}`)
  console.log(`✓ operational_teams: ${teamRows.length}`)

  for (const row of demo) {
    // Cliente demo (best-effort)
    const customer = {
      id: row.customerId,
      company_id: CDL,
      full_name: row.clientName,
      name: row.clientName,
      phone: `+1407555${String(1000 + row.n).slice(-4)}`,
      email: `demo.agenda.${row.n}@cdl-dev.test`,
      active: true,
    }
    let { error: custErr } = await sb
      .from('customers')
      .upsert(customer, { onConflict: 'id' })
    if (custErr) {
      const slimCust = {
        id: customer.id,
        company_id: CDL,
        full_name: row.clientName,
        phone: customer.phone,
      }
      ;({ error: custErr } = await sb
        .from('customers')
        .upsert(slimCust, { onConflict: 'id' }))
    }
    if (custErr) {
      console.warn(`  ! customer ${row.n}: ${custErr.message}`)
    }

    const cateringEvent = {
      id: row.cateringEventId,
      company_id: CDL,
      event_name: row.title,
      event_date: row.slot.date,
      start_time: row.start,
      end_time: row.end,
      address_line: `${100 + row.n * 3} Demo Ave`,
      city: 'Orlando',
      state: 'FL',
      postal_code: '32801',
      country: 'US',
      adults_count: row.adults,
      children_count: row.childrenUnder3 + row.children4To12,
      billable_guests: row.billableGuestCount,
      total_guests: row.physicalGuestCount,
      distance_from_base: row.mileageDistance,
      active: true,
      notes: `Seed agenda → cotação ${row.quoteNumber} · ${row.pkgKey}`,
    }
    let { error: evErr } = await sb
      .from('events')
      .upsert(cateringEvent, { onConflict: 'id' })
    if (evErr) {
      const { company_id: _c, distance_from_base: _d, ...rest } = cateringEvent
      ;({ error: evErr } = await sb.from('events').upsert(rest, { onConflict: 'id' }))
    }
    if (evErr) throw new Error(`events ${row.n}: ${evErr.message}`)

    const quote = {
      id: row.quoteId,
      company_id: CDL,
      event_id: row.cateringEventId,
      customer_id: row.customerId,
      package_id: row.pkg.id,
      quote_number: row.quoteNumber,
      language: 'pt',
      quote_status: 'approved',
      source: 'dev_agenda_demo',
      active: true,
      physical_guest_count: row.physicalGuestCount,
      billable_guest_count: row.billableGuestCount,
      adult_count: row.adults,
      children_under_3_count: row.childrenUnder3,
      children_4_to_12_count: row.children4To12,
      package_price_per_person: row.price,
      package_unit_price: row.price,
      package_total: row.packageTotal,
      additional_total: row.additionalTotal,
      mileage_distance: row.mileageDistance,
      mileage_fee: row.mileageFee,
      reservation_percentage: row.reservationPct,
      reservation_amount: row.reservationAmount,
      balance_due: row.balanceDue,
      quote_total: row.quoteTotal,
      currency_code: 'USD',
    }
    let { error: qErr } = await sb.from('quotes').upsert(quote, { onConflict: 'id' })
    if (qErr) {
      const slim = {
        id: quote.id,
        company_id: quote.company_id,
        event_id: quote.event_id,
        package_id: quote.package_id,
        quote_number: quote.quote_number,
        language: 'pt',
        quote_status: 'approved',
        active: true,
        adult_count: row.adults,
        children_under_3_count: row.childrenUnder3,
        children_4_to_12_count: row.children4To12,
        physical_guest_count: row.physicalGuestCount,
        billable_guest_count: row.billableGuestCount,
        package_price_per_person: row.price,
        package_total: row.packageTotal,
        additional_total: row.additionalTotal,
        mileage_fee: row.mileageFee,
        quote_total: row.quoteTotal,
        reservation_amount: row.reservationAmount,
        balance_due: row.balanceDue,
        currency_code: 'USD',
      }
      ;({ error: qErr } = await sb.from('quotes').upsert(slim, { onConflict: 'id' }))
    }
    if (qErr) throw new Error(`quotes ${row.n}: ${qErr.message}`)

    await sb.from('quote_additional_items').delete().eq('quote_id', row.quoteId)
    if (row.additionals.length > 0) {
      const addRows = row.additionals.map((line) => ({
        id: randomUUID(),
        company_id: CDL,
        quote_id: row.quoteId,
        additional_item_id: line.itemId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.totalPrice,
        selected: true,
      }))
      const { error: addErr } = await sb
        .from('quote_additional_items')
        .insert(addRows)
      if (addErr) throw new Error(`quote_additional_items ${row.n}: ${addErr.message}`)
    }

    const agendaEvent = {
      id: row.agendaEventId,
      company_id: CDL,
      team_id: row.team.id,
      code: row.agendaCode,
      title: row.title,
      client_name: row.clientName,
      event_date: row.slot.date,
      start_time: row.slot.start,
      end_time: row.slot.end,
      status: 'scheduled',
      notes:
        `${row.pkgKey} · A${row.adults}/≤3:${row.childrenUnder3}/4-12:${row.children4To12} · ` +
        `Total $${row.quoteTotal} · Cotação ${row.quoteNumber}`,
      quote_id: row.quoteId,
    }
    const { error: aErr } = await sb
      .from('agenda_events')
      .upsert(agendaEvent, { onConflict: 'id' })
    if (aErr) throw new Error(`agenda_events ${row.n}: ${aErr.message}`)
  }

  console.log(`✓ events + quotes + additionals + agenda_events: ${demo.length}`)
  console.log(
    '\nClique no evento na agenda → /quotes/{id} com pacote, convidados, adicionais e total.',
  )
}

main().catch((e) => {
  console.error('FALHA:', e.message || e)
  process.exit(1)
})
