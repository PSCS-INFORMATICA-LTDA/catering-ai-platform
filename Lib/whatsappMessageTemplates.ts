/**
 * Textos WhatsApp / SMS / e-mail — padrão Logistics.
 * O bloco financeiro espelha o Resumo da cotação (pacote, milhagem,
 * churrasqueira, feriado, mínimo, desconto, total, sinal).
 * Idioma: pt | en | es.
 */

export type MessageLanguage = 'pt' | 'en' | 'es'

export function normalizeMessageLanguage(
  value: string | null | undefined,
): MessageLanguage {
  const v = (value ?? 'pt').trim().toLowerCase()
  if (v === 'en' || v.startsWith('en')) return 'en'
  if (v === 'es' || v.startsWith('es') || v.startsWith('spa')) return 'es'
  return 'pt'
}

export type CommercialShareReason =
  | 'weekday'
  | 'weekend'
  | 'dec_jan'
  | 'cdl_holiday'
  | 'us_holiday'
  | 'none'

export type ClientQuoteWhatsAppInput = {
  quoteNumber: string
  customerName?: string | null
  eventDate?: string | null
  startTime?: string | null
  endTime?: string | null
  packageLabel?: string | null
  quoteTotal?: number | null
  reservationAmount?: number | null
  currencyCode?: string | null
  proposalUrl: string
  companyName?: string | null
  adultCount?: number | null
  childrenUnder3Count?: number | null
  children4To12Count?: number | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  language?: string | null
  /** Linhas do resumo financeiro (espelho da tela). */
  packageTotal?: number | null
  additionalTotal?: number | null
  /** Pacote inclui guarnições (chave …+). */
  packageHasGarnish?: boolean | null
  /** Valor das guarnições quando inclusas no pacote (opcional). */
  garnishIncludedTotal?: number | null
  /** Texto das guarnições inclusas (como na review), ex.: "Arroz, Feijão…". */
  garnishDescription?: string | null
  /** Itens do pacote (como na review). */
  packageItemsDescription?: string | null
  /** Preço unitário do pacote (por pessoa). */
  packageUnitPrice?: number | null
  /** Escolhas inclusas (como na review). */
  packageSelectionLines?: Array<{
    groupTitle: string
    itemLabel: string
  }> | null
  /** Adicionais discriminados (ex.: guarnições à la carte). */
  additionalLines?: Array<{
    label: string
    amount: number
    isGarnish?: boolean
  }> | null
  mileageFee?: number | null
  chargedMiles?: number | null
  mileageFreeLimit?: number | null
  grillRentalTotal?: number | null
  grillRentalQty?: number | null
  discountAmount?: number | null
  /** @deprecated preferir package/mileage/grill; mantido p/ compat. */
  baseSubtotal?: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  minimumOrderAmount?: number | null
  /** Motivo do pedido mínimo / feriado aplicado. */
  commercialReason?: CommercialShareReason | null
}

export type TeamAvailabilityWhatsAppInput = {
  teamName: string
  leaderName?: string | null
  eventCode: string
  eventTitle: string
  clientName?: string | null
  eventDate: string
  startTime: string
  endTime: string
  presentationTime?: string | null
  address?: string | null
  packageLabel?: string | null
  companyName?: string | null
  confirmUrl?: string | null
  language?: string | null
}

/** Packing operacional CDL (HC–HK) já resolvido para o idioma da mensagem. */
export type SupplierGarnishCdlKitsInput = {
  largeKits: number
  smallKits: number
  items: Array<{ label: string; units: number }>
}

/** Pedido de guarnição ao fornecedor (restaurante) — WhatsApp. */
export type SupplierGarnishWhatsAppInput = {
  supplierName?: string | null
  orderNumber: string
  eventDate: string
  /** Horário do evento (início). */
  eventStartTime?: string | null
  eventEndTime?: string | null
  /** Horário de retirada (flexível; default tipicamente 2h antes). */
  pickupTime?: string | null
  teamName?: string | null
  garnishItems: string[]
  /** ET — QUANTIDADE TOTAL DE PESSOAS (billable); contexto + extras. */
  guestCount?: number | null
  /** Adultos (HH/HI); exibido se diferente de guestCount. */
  adultCount?: number | null
  /**
   * Kits/UN da planilha QuoteCDL (HC–HK). Quando presente com itens,
   * substitui o modelo porção 1:1 nos itens cobertos pelo kit.
   */
  cdlKits?: SupplierGarnishCdlKitsInput | null
  companyName?: string | null
  language?: string | null
  /** Link público para confirmar recebimento no sistema. */
  confirmUrl?: string | null
}

function localeFor(lang: MessageLanguage): string {
  if (lang === 'en') return 'en-US'
  if (lang === 'es') return 'es-US'
  return 'pt-BR'
}

function formatMoney(
  value: number | null | undefined,
  currency = 'USD',
  lang: MessageLanguage = 'pt',
): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value))
  } catch {
    return `$${Number(value).toFixed(2)}`
  }
}

function formatEventDate(
  value: string | null | undefined,
  lang: MessageLanguage,
): string {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  if (lang === 'en') return `${m}/${d}/${y}`
  return `${d}/${m}/${y}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length >= 5 ? value.slice(0, 5) : value
}

function firstName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  return name.trim().split(/\s+/)[0] || null
}

type ClientCopy = {
  helloNamed: (name: string) => string
  hello: string
  howAreYou: string
  intro: string
  proposalTitle: (n: string, company: string) => string
  eventDate: string
  time: string
  package: string
  guestsLabel: string
  guests: (adults: number, under3: number, kids: number) => string
  location: string
  packageDetailHeader: string
  packageChosen: (name: string, unitMoney: string | null) => string
  packageValue: (money: string) => string
  includedChoicesHeader: string
  packageItemsHeader: string
  garnishHeader: string
  garnishNotIncluded: string
  additionalItemsHeader: string
  selectionLine: (group: string, item: string) => string
  financialHeader: string
  packageAmount: (money: string) => string
  garnishHeaderIncluded: string
  garnishHeaderAdditional: string
  garnishIncludedAmount: (money: string) => string
  additionalsAmount: (money: string) => string
  additionalLine: (label: string, money: string) => string
  bulletItem: (label: string) => string
  mileageAmount: (money: string, charged: number, free: number) => string
  grillRental: (money: string, qty: number) => string
  holidaySurcharge: (money: string) => string
  minOrderApplied: (adj: string, min: string) => string
  discount: (money: string) => string
  ruleWeekend: string
  ruleWeekday: string
  ruleDecJan: string
  ruleHoliday: string
  /** Só quando há milhagem cobrada. */
  ruleMileage: string
  /** Só quando há aluguel de churrasqueira. */
  ruleGrill: string
  /** Só quando pacote já inclui guarnições. */
  ruleGarnishIncluded: string
  /** Só quando pacote sem guarnição e há guarnição como adicional. */
  ruleGarnishAsAdditional: string
  total: (money: string) => string
  deposit: (money: string) => string
  closingLink: string
  waiting: string
  thanks: string
}

type TeamCopy = {
  helloNamed: (name: string) => string
  howAreYou: string
  intro: string
  designationTitle: (code: string, company: string) => string
  eventHeader: string
  team: string
  event: string
  client: string
  date: string
  presentation: string
  eventTime: string
  location: string
  package: string
  confirmHeader: string
  closingLink: string
  closingReply: string
  closingReplyYesNo: string
  waiting: string
  thanks: string
  teamFallback: string
}

type SupplierCopy = {
  helloNamed: (name: string) => string
  hello: string
  howAreYou: string
  intro: string
  title: (orderNumber: string) => string
  orderHeader: string
  date: string
  eventTime: string
  pickup: string
  team: string
  guests: string
  adults: string
  kitsHeader: string
  kitLarge: string
  kitSmall: string
  itemsHeader: string
  itemsEmpty: string
  /** Unidade operacional legado (porções) — só extras fora do kit. */
  portions: string
  /** Unidade de packing CDL (HE–HK). */
  units: string
  extrasHeader: string
  confirmHeader: string
  closingLink: string
  closingReply: string
  waiting: string
  thanks: string
}

/** Formata linha de guarnição com porções para o fornecedor. */
export function formatSupplierGarnishServingLine(
  item: string,
  guestCount: number | null | undefined,
  portionsWord: string,
): string {
  const trimmed = item.trim()
  if (!trimmed) return ''

  const withQty = trimmed.match(/^(.*?)\s*\(×\s*(\d+)\)\s*$/i)
  if (withQty) {
    const label = withQty[1]?.trim() || trimmed
    const qty = Number(withQty[2])
    if (Number.isFinite(qty) && qty > 0) {
      return `${label} — ${qty} ${portionsWord}`
    }
  }

  if (/\d+\s*(porç|serving|porcion)/i.test(trimmed)) {
    return trimmed
  }

  const n = Number(guestCount ?? 0)
  if (Number.isFinite(n) && n > 0) {
    return `${trimmed} — ${n} ${portionsWord}`
  }
  return trimmed
}

/** Separador visual entre assuntos (mesmo padrão da mensagem ao cliente). */
const SECTION = '────────'

const CLIENT_COPY: Record<MessageLanguage, ClientCopy> = {
  pt: {
    helloNamed: (n) => `Olá, ${n},`,
    hello: 'Olá,',
    howAreYou: 'Tudo bem?',
    intro: 'Segue a proposta de churrasco BBQ At Home para análise.',
    proposalTitle: (n, c) => `*Proposta ${n}* — ${c}`,
    eventDate: 'Data do evento',
    time: 'Horário',
    package: 'Pacote',
    guestsLabel: 'Convidados',
    guests: (a, u, k) =>
      `${a} adultos · ${u} crianças até 3 anos · ${k} de 4 a 12 anos`,
    location: 'Local',
    packageDetailHeader: '*Pacote CDL*',
    packageChosen: (name, unit) =>
      unit
        ? `*Pacote escolhido:* ${name}\n${unit} / pessoa`
        : `*Pacote escolhido:* ${name}`,
    packageValue: (m) => `*Valor do pacote:* ${m}`,
    includedChoicesHeader: '*Escolhas inclusas:*',
    packageItemsHeader: '*Itens do pacote:*',
    garnishHeader: '*Guarnições:*',
    garnishNotIncluded: 'Não inclusas',
    additionalItemsHeader: '*Itens adicionais:*',
    selectionLine: (group, item) => `• ${group}: ${item}`,
    financialHeader: '*Resumo financeiro*',
    packageAmount: (m) => `*Pacote:* ${m}`,
    garnishHeaderIncluded: '*Guarnições (inclusas no pacote):*',
    garnishHeaderAdditional: '*Guarnições (adicional):*',
    garnishIncludedAmount: (m) => `Valor guarnições: ${m}`,
    additionalsAmount: (m) => `*Adicionais:* ${m}`,
    additionalLine: (label, m) => `• ${label}: ${m}`,
    bulletItem: (label) => `• ${label}`,
    mileageAmount: (m, charged, free) =>
      charged > 0
        ? `*Milhagem* (${charged} mi cobradas além de ${free} mi cortesia):\n${m}`
        : `*Milhagem:* ${m}`,
    grillRental: (m, qty) =>
      qty > 1
        ? `*Aluguel de churrasqueira* (${qty}×):\n${m}`
        : `*Aluguel de churrasqueira:* ${m}`,
    holidaySurcharge: (m) =>
      `*Adicional de feriado / data comemorativa (100%):*\n${m}`,
    minOrderApplied: (adj, min) =>
      `*Pedido mínimo aplicado:* +${adj}\n(mínimo da data: ${min})`,
    discount: (m) => `*Desconto:* ${m}`,
    ruleWeekend:
      '_Regra:_ sexta a domingo — pedido mínimo de $1.000.',
    ruleWeekday: '_Regra:_ segunda a quinta — pedido mínimo de $800.',
    ruleDecJan:
      '_Regra:_ dezembro/janeiro (fora de feriado) — pedido mínimo de $900.',
    ruleHoliday:
      '_Regra:_ feriados federais dos EUA e datas comemorativas (24, 25 e 31/dez e 1º de janeiro) — acréscimo de 100% e pedido mínimo de $2.000.',
    ruleMileage:
      '_Regra de milhagem:_ base Orlando Eye — 20 mi de cortesia; acima disso, $2/mi.',
    ruleGrill:
      '_Regra:_ se o local não tem churrasqueira, aluguel de $100 por unidade.',
    ruleGarnishIncluded:
      '_Regra:_ pacote com guarnições — guarnições já inclusas; não podem ser escolhidas novamente como adicional.',
    ruleGarnishAsAdditional:
      '_Regra:_ pacote sem guarnições — guarnições disponíveis como adicional (preço do cadastro).',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `*Sinal para reservar a data (30%):* ${m}`,
    closingLink:
      'Caso concorde, acesse o link que publico abaixo e confirme o aceite da proposta.',
    waiting: 'Fico no aguardo,',
    thanks: 'Obrigado pela atenção!',
  },
  en: {
    helloNamed: (n) => `Hi, ${n},`,
    hello: 'Hi,',
    howAreYou: 'How are you?',
    intro: 'Please find the BBQ At Home barbecue proposal for your review.',
    proposalTitle: (n, c) => `*Proposal ${n}* — ${c}`,
    eventDate: 'Event date',
    time: 'Time',
    package: 'Package',
    guestsLabel: 'Guests',
    guests: (a, u, k) =>
      `${a} adults · ${u} children under 3 · ${k} ages 4–12`,
    location: 'Location',
    packageDetailHeader: '*CDL Package*',
    packageChosen: (name, unit) =>
      unit
        ? `*Selected package:* ${name}\n${unit} / person`
        : `*Selected package:* ${name}`,
    packageValue: (m) => `*Package amount:* ${m}`,
    includedChoicesHeader: '*Included choices:*',
    packageItemsHeader: '*Package items:*',
    garnishHeader: '*Sides:*',
    garnishNotIncluded: 'Not included',
    additionalItemsHeader: '*Additional items:*',
    selectionLine: (group, item) => `• ${group}: ${item}`,
    financialHeader: '*Financial summary*',
    packageAmount: (m) => `*Package:* ${m}`,
    garnishHeaderIncluded: '*Sides (included in package):*',
    garnishHeaderAdditional: '*Sides (add-on):*',
    garnishIncludedAmount: (m) => `Sides amount: ${m}`,
    additionalsAmount: (m) => `*Add-ons:* ${m}`,
    additionalLine: (label, m) => `• ${label}: ${m}`,
    bulletItem: (label) => `• ${label}`,
    mileageAmount: (m, charged, free) =>
      charged > 0
        ? `*Mileage* (${charged} mi charged beyond ${free} mi courtesy):\n${m}`
        : `*Mileage:* ${m}`,
    grillRental: (m, qty) =>
      qty > 1
        ? `*Grill rental* (${qty}×):\n${m}`
        : `*Grill rental:* ${m}`,
    holidaySurcharge: (m) =>
      `*Holiday / commemorative surcharge (100%):*\n${m}`,
    minOrderApplied: (adj, min) =>
      `*Minimum order applied:* +${adj}\n(date minimum: ${min})`,
    discount: (m) => `*Discount:* ${m}`,
    ruleWeekend: '_Rule:_ Friday–Sunday — minimum order $1,000.',
    ruleWeekday: '_Rule:_ Monday–Thursday — minimum order $800.',
    ruleDecJan:
      '_Rule:_ December/January (non-holiday) — minimum order $900.',
    ruleHoliday:
      '_Rule:_ U.S. federal holidays and commemorative dates (Dec 24, 25, 31 and Jan 1) — 100% surcharge and $2,000 minimum.',
    ruleMileage:
      '_Mileage rule:_ Orlando Eye base — 20 mi courtesy; beyond that, $2/mi.',
    ruleGrill:
      '_Rule:_ if the venue has no grill, rental is $100 per unit.',
    ruleGarnishIncluded:
      '_Rule:_ package includes sides — sides are already included and cannot be selected again as add-ons.',
    ruleGarnishAsAdditional:
      '_Rule:_ package without sides — sides are available as add-ons (catalog price).',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `*Deposit to reserve the date (30%):* ${m}`,
    closingLink:
      'If you agree, please open the link below and confirm acceptance of the proposal.',
    waiting: 'Looking forward to your reply,',
    thanks: 'Thank you!',
  },
  es: {
    helloNamed: (n) => `Hola, ${n},`,
    hello: 'Hola,',
    howAreYou: '¿Cómo estás?',
    intro: 'Le enviamos la propuesta de asado BBQ At Home para su revisión.',
    proposalTitle: (n, c) => `*Propuesta ${n}* — ${c}`,
    eventDate: 'Fecha del evento',
    time: 'Horario',
    package: 'Paquete',
    guestsLabel: 'Invitados',
    guests: (a, u, k) =>
      `${a} adultos · ${u} niños hasta 3 años · ${k} de 4 a 12 años`,
    location: 'Lugar',
    packageDetailHeader: '*Paquete CDL*',
    packageChosen: (name, unit) =>
      unit
        ? `*Paquete elegido:* ${name}\n${unit} / persona`
        : `*Paquete elegido:* ${name}`,
    packageValue: (m) => `*Valor del paquete:* ${m}`,
    includedChoicesHeader: '*Elecciones incluidas:*',
    packageItemsHeader: '*Ítems del paquete:*',
    garnishHeader: '*Guarniciones:*',
    garnishNotIncluded: 'No incluidas',
    additionalItemsHeader: '*Ítems adicionales:*',
    selectionLine: (group, item) => `• ${group}: ${item}`,
    financialHeader: '*Resumen financiero*',
    packageAmount: (m) => `*Paquete:* ${m}`,
    garnishHeaderIncluded: '*Guarniciones (incluidas en el paquete):*',
    garnishHeaderAdditional: '*Guarniciones (adicional):*',
    garnishIncludedAmount: (m) => `Valor guarniciones: ${m}`,
    additionalsAmount: (m) => `*Adicionales:* ${m}`,
    additionalLine: (label, m) => `• ${label}: ${m}`,
    bulletItem: (label) => `• ${label}`,
    mileageAmount: (m, charged, free) =>
      charged > 0
        ? `*Kilometraje* (${charged} mi cobradas además de ${free} mi de cortesía):\n${m}`
        : `*Kilometraje:* ${m}`,
    grillRental: (m, qty) =>
      qty > 1
        ? `*Alquiler de parrilla* (${qty}×):\n${m}`
        : `*Alquiler de parrilla:* ${m}`,
    holidaySurcharge: (m) =>
      `*Adicional de feriado / fecha conmemorativa (100%):*\n${m}`,
    minOrderApplied: (adj, min) =>
      `*Pedido mínimo aplicado:* +${adj}\n(mínimo de la fecha: ${min})`,
    discount: (m) => `*Descuento:* ${m}`,
    ruleWeekend:
      '_Regla:_ viernes a domingo — pedido mínimo de $1.000.',
    ruleWeekday: '_Regla:_ lunes a jueves — pedido mínimo de $800.',
    ruleDecJan:
      '_Regla:_ diciembre/enero (fuera de feriado) — pedido mínimo de $900.',
    ruleHoliday:
      '_Regla:_ feriados federales de EE. UU. y fechas conmemorativas (24, 25 y 31/dic y 1º de enero) — recargo del 100% y mínimo de $2.000.',
    ruleMileage:
      '_Regla de kilometraje:_ base Orlando Eye — 20 mi de cortesía; por encima, $2/mi.',
    ruleGrill:
      '_Regla:_ si el local no tiene parrilla, alquiler de $100 por unidad.',
    ruleGarnishIncluded:
      '_Regla:_ paquete con guarniciones — ya incluidas; no se pueden elegir otra vez como adicional.',
    ruleGarnishAsAdditional:
      '_Regla:_ paquete sin guarniciones — disponibles como adicional (precio del catálogo).',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `*Señal para reservar la fecha (30%):* ${m}`,
    closingLink:
      'Si está de acuerdo, acceda al enlace que publico abajo y confirme la aceptación de la propuesta.',
    waiting: 'Quedo a la espera,',
    thanks: '¡Gracias por su atención!',
  },
}

/** Explica só o que efetivamente entrou no resumo (sem regra genérica). */
function appendApplicableRuleNotes(
  lines: string[],
  t: ClientCopy,
  input: {
    holidaySurcharge: number
    minAdj: number
    mileageFee: number
    grillRentalTotal: number
    packageHasGarnish: boolean
    hasGarnishAdditional: boolean
    commercialReason?: CommercialShareReason | null
  },
) {
  if (input.holidaySurcharge > 0) {
    lines.push('', t.ruleHoliday)
  }
  if (input.minAdj > 0) {
    if (input.holidaySurcharge > 0) {
      // Feriado já cobre o mínimo de $2000 — não repetir regra de dia útil.
    } else if (input.commercialReason === 'weekend') {
      lines.push('', t.ruleWeekend)
    } else if (input.commercialReason === 'dec_jan') {
      lines.push('', t.ruleDecJan)
    } else {
      lines.push('', t.ruleWeekday)
    }
  }
  if (input.mileageFee > 0) {
    lines.push('', t.ruleMileage)
  }
  if (input.grillRentalTotal > 0) {
    lines.push('', t.ruleGrill)
  }
  if (input.packageHasGarnish) {
    lines.push('', t.ruleGarnishIncluded)
  } else if (input.hasGarnishAdditional) {
    lines.push('', t.ruleGarnishAsAdditional)
  }
}

/** Linha de despesa com espaço em branco entre itens (WhatsApp / SMS / e-mail). */
function pushExpenseLine(lines: string[], text: string) {
  lines.push('')
  for (const part of text.split('\n')) {
    lines.push(part)
  }
}

/** Quebra descrição da review ("A · B · C" ou "A, B, C") em itens. */
function parseGarnishItems(description: string | null | undefined): string[] {
  if (!description?.trim()) return []
  const cleaned = description
    .replace(/^Guarnições:\s*/i, '')
    .replace(/^Sides:\s*/i, '')
    .replace(/^Guarniciones:\s*/i, '')
    .replace(/^Não inclusas$/i, '')
    .replace(/^Não$/i, '')
    .trim()
  if (!cleaned) return []
  return cleaned
    .split(/\s*[·•|,;]\s*|\n+/)
    .map((part) => part.replace(/^[-–•]\s*/, '').trim())
    .filter((part) => part && part !== '—' && part !== '-')
}

const TEAM_COPY: Record<MessageLanguage, TeamCopy> = {
  pt: {
    helloNamed: (n) => `Olá, ${n},`,
    howAreYou: 'Tudo bem?',
    intro:
      'Segue a designação da equipe para o churrasco, para sua confirmação.',
    designationTitle: (code, c) => `*Designação ${code}* — ${c}`,
    eventHeader: '*Dados do evento*',
    team: 'Equipe',
    event: 'Evento',
    client: 'Cliente',
    date: 'Data',
    presentation: 'Horário de apresentação no local',
    eventTime: 'Horário do evento',
    location: 'Local',
    package: 'Pacote',
    confirmHeader: '*Confirmação*',
    closingLink:
      'Por favor, acesse o link abaixo e confirme se a equipe aceita ou recusa esta designação.',
    closingReply:
      'Por favor, confirme se a equipe está disponível neste dia para realizar o churrasco.',
    closingReplyYesNo:
      'Responda *SIM* para aceitar ou *NÃO* se não puder atender.',
    waiting: 'Fico no aguardo da sua confirmação,',
    thanks: 'Obrigado!',
    teamFallback: 'equipe',
  },
  en: {
    helloNamed: (n) => `Hi, ${n},`,
    howAreYou: 'How are you?',
    intro:
      'Please find the team assignment for the barbecue for your confirmation.',
    designationTitle: (code, c) => `*Assignment ${code}* — ${c}`,
    eventHeader: '*Event details*',
    team: 'Team',
    event: 'Event',
    client: 'Client',
    date: 'Date',
    presentation: 'On-site presentation time',
    eventTime: 'Event time',
    location: 'Location',
    package: 'Package',
    confirmHeader: '*Confirmation*',
    closingLink:
      'Please open the link below and confirm whether the team accepts or declines this assignment.',
    closingReply:
      'Please confirm if the team is available on this day to run the barbecue.',
    closingReplyYesNo: 'Reply *YES* to accept or *NO* if you cannot take it.',
    waiting: 'Looking forward to your confirmation,',
    thanks: 'Thank you!',
    teamFallback: 'team',
  },
  es: {
    helloNamed: (n) => `Hola, ${n},`,
    howAreYou: '¿Cómo estás?',
    intro:
      'Le enviamos la designación del equipo para el asado, para su confirmación.',
    designationTitle: (code, c) => `*Designación ${code}* — ${c}`,
    eventHeader: '*Datos del evento*',
    team: 'Equipo',
    event: 'Evento',
    client: 'Cliente',
    date: 'Fecha',
    presentation: 'Horario de presentación en el lugar',
    eventTime: 'Horario del evento',
    location: 'Lugar',
    package: 'Paquete',
    confirmHeader: '*Confirmación*',
    closingLink:
      'Por favor, acceda al enlace abajo y confirme si el equipo acepta o rechaza esta designación.',
    closingReply:
      'Por favor, confirme si el equipo está disponible ese día para realizar el asado.',
    closingReplyYesNo:
      'Responda *SÍ* para aceptar o *NO* si no puede atender.',
    waiting: 'Quedo a la espera de su confirmación,',
    thanks: '¡Gracias!',
    teamFallback: 'equipo',
  },
}

const SUPPLIER_COPY: Record<MessageLanguage, SupplierCopy> = {
  pt: {
    helloNamed: (n) => `Olá, ${n},`,
    hello: 'Olá,',
    howAreYou: 'Tudo bem?',
    intro: 'Segue o pedido de guarnições da BBQ At Home.',
    title: (n) => `*Pedido de guarnição — OS ${n}*`,
    orderHeader: '*Dados do pedido*',
    date: 'Data',
    eventTime: 'Horário do evento',
    pickup: 'Horário de retirada',
    team: 'Equipe',
    guests: 'Convidados (cobrados)',
    adults: 'Adultos',
    kitsHeader: '*Kits CDL*',
    kitLarge: 'Guarnição grande',
    kitSmall: 'Guarnição pequena',
    itemsHeader: '*Itens / UN (kit CDL)*',
    itemsEmpty: '• (liste as guarnições e unidades necessárias)',
    portions: 'porções',
    units: 'UN',
    extrasHeader: '*Itens extras*',
    confirmHeader: '*Confirmação*',
    closingLink:
      'Por favor, acesse o link abaixo e confirme o recebimento do pedido.',
    closingReply:
      'Responda *OK* / *RECEBIDO* para confirmar o recebimento.',
    waiting: 'Fico no aguardo da confirmação,',
    thanks: 'Obrigado!',
  },
  en: {
    helloNamed: (n) => `Hi, ${n},`,
    hello: 'Hi,',
    howAreYou: 'How are you?',
    intro: 'Please find the side-dish order for BBQ At Home.',
    title: (n) => `*Side-dish order — ${n}*`,
    orderHeader: '*Order details*',
    date: 'Date',
    eventTime: 'Event time',
    pickup: 'Pickup time',
    team: 'Team',
    guests: 'Guests (billable)',
    adults: 'Adults',
    kitsHeader: '*CDL kits*',
    kitLarge: 'Large side kit',
    kitSmall: 'Small side kit',
    itemsHeader: '*Items / units (CDL kit)*',
    itemsEmpty: '• (list the sides and units needed)',
    portions: 'servings',
    units: 'UN',
    extrasHeader: '*Extra items*',
    confirmHeader: '*Confirmation*',
    closingLink:
      'Please open the link below and confirm receipt of this order.',
    closingReply: 'Reply *OK* / *RECEIVED* to confirm receipt.',
    waiting: 'Looking forward to your confirmation,',
    thanks: 'Thank you!',
  },
  es: {
    helloNamed: (n) => `Hola, ${n},`,
    hello: 'Hola,',
    howAreYou: '¿Cómo estás?',
    intro: 'Le enviamos el pedido de guarniciones de BBQ At Home.',
    title: (n) => `*Pedido de guarniciones — ${n}*`,
    orderHeader: '*Datos del pedido*',
    date: 'Fecha',
    eventTime: 'Horario del evento',
    pickup: 'Horario de retiro',
    team: 'Equipo',
    guests: 'Invitados (cobrados)',
    adults: 'Adultos',
    kitsHeader: '*Kits CDL*',
    kitLarge: 'Guarnición grande',
    kitSmall: 'Guarnición pequeña',
    itemsHeader: '*Ítems / UN (kit CDL)*',
    itemsEmpty: '• (liste las guarniciones y unidades)',
    portions: 'porciones',
    units: 'UN',
    extrasHeader: '*Ítems extras*',
    confirmHeader: '*Confirmación*',
    closingLink:
      'Por favor, acceda al enlace abajo y confirme la recepción del pedido.',
    closingReply: 'Responda *OK* / *RECIBIDO* para confirmar la recepción.',
    waiting: 'Quedo a la espera de su confirmación,',
    thanks: '¡Gracias!',
  },
}

/** Espaçamento estilo Logistics (quebra visual no WhatsApp). */
const BREAK = '\n\n\n'

/**
 * Mensagem ao cliente — proposta de churrasco + link de aceite.
 */
export function buildClientQuoteWhatsAppText(
  input: ClientQuoteWhatsAppInput,
): string {
  const lang = normalizeMessageLanguage(input.language)
  const t = CLIENT_COPY[lang]
  const hello = firstName(input.customerName)
  const company = input.companyName?.trim() || 'BBQ At Home'
  const currency = input.currencyCode ?? 'USD'

  const packageTotal = Number(input.packageTotal ?? 0)
  const additionalTotal = Number(input.additionalTotal ?? 0)
  const garnishIncludedTotal = Number(input.garnishIncludedTotal ?? 0)
  const packageUnitPrice = Number(input.packageUnitPrice ?? 0)
  const packageHasGarnish = Boolean(input.packageHasGarnish)
  const garnishItems = parseGarnishItems(input.garnishDescription)
  const packageItemsText = (input.packageItemsDescription ?? '').trim()
  const packageLabel = (input.packageLabel ?? '').trim()
  const selectionLines = (input.packageSelectionLines ?? []).filter(
    (line) => line?.groupTitle?.trim() && line?.itemLabel?.trim(),
  )
  const additionalLines = (input.additionalLines ?? []).filter(
    (line) => line && Number(line.amount) > 0 && line.label?.trim(),
  )

  // Bloco Pacote CDL — logo após o título (pedido Philippe / linha verde).
  const hasPackageDetail =
    Boolean(packageLabel) ||
    selectionLines.length > 0 ||
    Boolean(packageItemsText) ||
    packageHasGarnish ||
    garnishItems.length > 0 ||
    additionalLines.length > 0 ||
    packageTotal > 0 ||
    Boolean(input.garnishDescription?.trim())

  const lines: string[] = [
    hello ? t.helloNamed(hello) : t.hello,
    '',
    t.howAreYou,
    '',
    t.intro,
    '',
    t.proposalTitle(input.quoteNumber, company),
  ]

  if (hasPackageDetail) {
    lines.push('', SECTION, '', t.packageDetailHeader)
    if (packageLabel) {
      lines.push(
        '',
        t.packageChosen(
          packageLabel,
          packageUnitPrice > 0
            ? formatMoney(packageUnitPrice, currency, lang)
            : null,
        ),
      )
    }
    if (packageTotal > 0) {
      lines.push(t.packageValue(formatMoney(packageTotal, currency, lang)))
    }
    if (selectionLines.length > 0) {
      lines.push('', t.includedChoicesHeader)
      for (const sel of selectionLines) {
        lines.push(
          t.selectionLine(sel.groupTitle.trim(), sel.itemLabel.trim()),
        )
      }
    }
    if (packageItemsText) {
      lines.push('', t.packageItemsHeader, packageItemsText)
    }
    lines.push('', t.garnishHeader)
    if (packageHasGarnish && garnishItems.length > 0) {
      for (const item of garnishItems) {
        lines.push(t.bulletItem(item))
      }
    } else if (packageHasGarnish && input.garnishDescription?.trim()) {
      lines.push(input.garnishDescription.trim())
    } else {
      lines.push(t.garnishNotIncluded)
    }
    if (packageHasGarnish && garnishIncludedTotal > 0) {
      lines.push(
        t.garnishIncludedAmount(
          formatMoney(garnishIncludedTotal, currency, lang),
        ),
      )
    }
    if (additionalLines.length > 0) {
      lines.push('', t.additionalItemsHeader)
      for (const line of additionalLines) {
        lines.push(
          t.additionalLine(
            line.label.trim(),
            formatMoney(line.amount, currency, lang),
          ),
        )
      }
    }
    lines.push('', SECTION)
  }

  if (input.eventDate) {
    lines.push(
      `*${t.eventDate}:* ${formatEventDate(input.eventDate, lang)}`,
    )
  }
  if (input.startTime || input.endTime) {
    lines.push(
      `*${t.time}:* ${formatTime(input.startTime)} – ${formatTime(input.endTime)}`,
    )
  }

  const adults = Number(input.adultCount ?? 0)
  const under3 = Number(input.childrenUnder3Count ?? 0)
  const kids = Number(input.children4To12Count ?? 0)
  if (adults + under3 + kids > 0) {
    lines.push(`*${t.guestsLabel}:* ${t.guests(adults, under3, kids)}`)
  }

  if (input.addressLine || input.city) {
    const place = [input.addressLine, input.city, input.state]
      .filter(Boolean)
      .join(', ')
    if (place) lines.push(`*${t.location}:* ${place}`)
  }
  const hasGarnishAdditional = additionalLines.some((line) => line.isGarnish)
  const mileageFee = Number(input.mileageFee ?? 0)
  const chargedMiles = Number(input.chargedMiles ?? 0)
  const mileageFreeLimit = Number(input.mileageFreeLimit ?? 20)
  const grillRentalTotal = Number(input.grillRentalTotal ?? 0)
  const grillRentalQty = Number(input.grillRentalQty ?? 0)
  const holidaySurcharge = Number(input.holidaySurchargeAmount ?? 0)
  const minAdj = Number(input.minimumOrderAdjustment ?? 0)
  const minAmount = Number(input.minimumOrderAmount ?? 0)
  const discountAmount = Number(input.discountAmount ?? 0)

  const hasFinanceLines =
    packageTotal > 0 ||
    garnishIncludedTotal > 0 ||
    additionalTotal > 0 ||
    additionalLines.length > 0 ||
    mileageFee > 0 ||
    grillRentalTotal > 0 ||
    holidaySurcharge > 0 ||
    minAdj > 0 ||
    discountAmount > 0 ||
    Number(input.quoteTotal ?? 0) > 0

  if (hasFinanceLines) {
    lines.push('', SECTION, '', t.financialHeader)
    if (packageTotal > 0) {
      pushExpenseLine(
        lines,
        t.packageAmount(formatMoney(packageTotal, currency, lang)),
      )
    }
    // Valores (itens já detalhados no bloco Pacote CDL quando disponível).
    if (packageHasGarnish && garnishIncludedTotal > 0) {
      pushExpenseLine(
        lines,
        t.garnishIncludedAmount(
          formatMoney(garnishIncludedTotal, currency, lang),
        ),
      )
    }
    const extrasTotal =
      additionalTotal > 0
        ? additionalTotal
        : additionalLines.reduce((sum, line) => sum + Number(line.amount), 0)
    if (extrasTotal > 0) {
      pushExpenseLine(
        lines,
        t.additionalsAmount(formatMoney(extrasTotal, currency, lang)),
      )
      if (!hasPackageDetail) {
        for (const line of additionalLines) {
          lines.push(
            t.additionalLine(
              line.label.trim(),
              formatMoney(line.amount, currency, lang),
            ),
          )
        }
      }
    }
    // Linhas e regras: só o que realmente aplicou nesta cotação.
    if (mileageFee > 0) {
      pushExpenseLine(
        lines,
        t.mileageAmount(
          formatMoney(mileageFee, currency, lang),
          chargedMiles,
          mileageFreeLimit,
        ),
      )
    }
    if (grillRentalTotal > 0) {
      pushExpenseLine(
        lines,
        t.grillRental(
          formatMoney(grillRentalTotal, currency, lang),
          grillRentalQty > 0 ? grillRentalQty : 1,
        ),
      )
    }
    if (holidaySurcharge > 0) {
      pushExpenseLine(
        lines,
        t.holidaySurcharge(formatMoney(holidaySurcharge, currency, lang)),
      )
    }
    if (minAdj > 0) {
      pushExpenseLine(
        lines,
        t.minOrderApplied(
          formatMoney(minAdj, currency, lang),
          formatMoney(minAmount, currency, lang),
        ),
      )
    }
    if (discountAmount > 0) {
      pushExpenseLine(
        lines,
        t.discount(formatMoney(discountAmount, currency, lang)),
      )
    }
    appendApplicableRuleNotes(lines, t, {
      holidaySurcharge,
      minAdj,
      mileageFee,
      grillRentalTotal,
      packageHasGarnish,
      hasGarnishAdditional,
      commercialReason: input.commercialReason,
    })
  }

  lines.push('', SECTION)
  pushExpenseLine(lines, t.total(formatMoney(input.quoteTotal, currency, lang)))
  if (input.reservationAmount != null) {
    pushExpenseLine(
      lines,
      t.deposit(formatMoney(input.reservationAmount, currency, lang)),
    )
  }

  lines.push(
    '',
    SECTION,
    '',
    t.closingLink,
    '',
    input.proposalUrl,
    '',
    t.waiting,
    t.thanks,
    `*${company}*`,
  )

  return lines.join('\n')
}

/**
 * Mensagem ao fornecedor — pedido de guarnição (mesmo padrão visual do cliente).
 */
/** Itens de catálogo cobertos pelo kit CDL (não repetir como porção 1:1). */
function isCdlKitCoveredSideLabel(label: string): boolean {
  return /arroz|feij[aã]o|tropeiro|maionese|mayonnaise|vinagrete|vinagreta/i.test(
    label.trim(),
  )
}

export function buildSupplierGarnishWhatsAppText(
  input: SupplierGarnishWhatsAppInput,
): string {
  const lang = normalizeMessageLanguage(input.language)
  const t = SUPPLIER_COPY[lang]
  const company = input.companyName?.trim() || 'BBQ At Home'
  const supplier = firstName(input.supplierName)
  const items = (input.garnishItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
  const guestCount = Number(input.guestCount ?? 0)
  const adultCount = Number(
    input.adultCount != null && Number(input.adultCount) > 0
      ? input.adultCount
      : input.guestCount ?? 0,
  )
  const kits = input.cdlKits
  const useKitPacking = Boolean(kits && kits.items.length > 0)

  const lines: string[] = [
    supplier ? t.helloNamed(supplier) : t.hello,
    '',
    t.howAreYou,
    '',
    t.intro,
    '',
    t.title(input.orderNumber),
    '',
    SECTION,
    '',
    t.orderHeader,
    `*${t.date}:* ${formatEventDate(input.eventDate, lang)}`,
  ]

  if (input.eventStartTime || input.eventEndTime) {
    lines.push(
      `*${t.eventTime}:* ${formatTime(input.eventStartTime)} – ${formatTime(input.eventEndTime)}`,
    )
  }
  if (input.pickupTime) {
    lines.push(`*${t.pickup}:* ${formatTime(input.pickupTime)}`)
  }
  if (input.teamName?.trim()) {
    lines.push(`*${t.team}:* ${input.teamName.trim()}`)
  }
  if (guestCount > 0) {
    lines.push(`*${t.guests}:* ${guestCount}`)
  }
  if (adultCount > 0 && adultCount !== guestCount) {
    lines.push(`*${t.adults}:* ${adultCount}`)
  }

  if (useKitPacking && kits) {
    lines.push('', SECTION, '', t.kitsHeader)
    lines.push(`• ${t.kitLarge}: ${kits.largeKits}`)
    lines.push(`• ${t.kitSmall}: ${kits.smallKits}`)
    lines.push('', SECTION, '', t.itemsHeader)
    for (const item of kits.items) {
      lines.push(`• ${item.label} — ${item.units} ${t.units}`)
    }
    const extras = items.filter((item) => {
      const name = item.replace(/\s*\(×\s*\d+\)\s*$/i, '').trim()
      return !isCdlKitCoveredSideLabel(name)
    })
    if (extras.length > 0) {
      lines.push('', SECTION, '', t.extrasHeader)
      for (const item of extras) {
        lines.push(
          `• ${formatSupplierGarnishServingLine(item, guestCount, t.portions)}`,
        )
      }
    }
  } else {
    lines.push('', SECTION, '', t.itemsHeader)
    if (items.length > 0) {
      for (const item of items) {
        lines.push(
          `• ${formatSupplierGarnishServingLine(item, input.guestCount, t.portions)}`,
        )
      }
    } else {
      lines.push(t.itemsEmpty)
    }
  }

  lines.push('', SECTION, '', t.confirmHeader, '')
  if (input.confirmUrl?.trim()) {
    lines.push(t.closingLink, '', input.confirmUrl.trim())
  } else {
    lines.push(t.closingReply)
  }
  lines.push('', t.waiting, t.thanks, `*${company}*`)
  return lines.join('\n')
}

/** Subtrai horas de HH:MM (ou HH:MM:SS). Retorna HH:MM. */
export function subtractHoursFromTime(
  time: string | null | undefined,
  hours: number,
): string | null {
  if (!time?.trim()) return null
  const raw = time.trim().slice(0, 5)
  const [h, m] = raw.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  let total = h * 60 + m - Math.round(hours * 60)
  if (total < 0) total += 24 * 60
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Mensagem à equipe — designação (mesmo padrão visual do cliente).
 */
export function buildTeamAvailabilityWhatsAppText(
  input: TeamAvailabilityWhatsAppInput,
): string {
  const lang = normalizeMessageLanguage(input.language)
  const t = TEAM_COPY[lang]
  const hello =
    firstName(input.leaderName) ||
    firstName(input.teamName) ||
    t.teamFallback
  const company = input.companyName?.trim() || 'BBQ At Home'

  const lines: string[] = [
    t.helloNamed(hello),
    '',
    t.howAreYou,
    '',
    t.intro,
    '',
    t.designationTitle(input.eventCode, company),
    '',
    SECTION,
    '',
    t.eventHeader,
    `*${t.team}:* ${input.teamName}`,
    `*${t.event}:* ${input.eventTitle}`,
  ]

  if (input.clientName) {
    lines.push(`*${t.client}:* ${input.clientName}`)
  }
  lines.push(`*${t.date}:* ${formatEventDate(input.eventDate, lang)}`)
  if (input.presentationTime) {
    lines.push(
      `*${t.presentation}:* ${formatTime(input.presentationTime)}`,
    )
  }
  lines.push(
    `*${t.eventTime}:* ${formatTime(input.startTime)} – ${formatTime(input.endTime)}`,
  )
  if (input.address) {
    lines.push(`*${t.location}:* ${input.address}`)
  }
  if (input.packageLabel) {
    lines.push(`*${t.package}:* ${input.packageLabel}`)
  }

  lines.push('', SECTION, '', t.confirmHeader, '')
  if (input.confirmUrl?.trim()) {
    lines.push(t.closingLink, '', input.confirmUrl.trim())
  } else {
    lines.push(t.closingReply, '', t.closingReplyYesNo)
  }

  lines.push('', t.waiting, t.thanks, `*${company}*`)
  return lines.join('\n')
}

export function buildQuoteProposalEmailSubjectLocalized(input: {
  quoteNumber: string
  language?: string | null
}): string {
  const lang = normalizeMessageLanguage(input.language)
  if (lang === 'en') return `Proposal ${input.quoteNumber} — BBQ At Home`
  if (lang === 'es') return `Propuesta ${input.quoteNumber} — BBQ At Home`
  return `Proposta ${input.quoteNumber} — BBQ At Home`
}

/** Extrai nome do líder das notes da equipe (seed: "Líder: Ricardo | …"). */
export function parseTeamLeaderFromNotes(
  notes: string | null | undefined,
): string | null {
  if (!notes?.trim()) return null
  const m = notes.match(/L[ií]der:\s*([^|]+)/i)
  return m?.[1]?.trim() || null
}

/**
 * Nome do líder para WhatsApp/SMS.
 * Prioridade: pessoa vinculada → nome da equipe (“Equipe Philippe”) → notes.
 * Evita conflito seed “Líder: Filipe” vs equipe/contato “Philippe”.
 */
export function resolveTeamLeaderDisplayName(input: {
  contactFullName?: string | null
  contactAbName?: string | null
  teamName?: string | null
  notes?: string | null
}): string | null {
  const fromContact =
    input.contactFullName?.trim() || input.contactAbName?.trim() || null
  if (fromContact) return fromContact

  const team = (input.teamName ?? '').trim()
  if (team) {
    const stripped = team
      .replace(/^(equipe|team|equipo)\s+/i, '')
      .trim()
    if (stripped && stripped.toLowerCase() !== team.toLowerCase()) {
      return stripped
    }
  }

  return parseTeamLeaderFromNotes(input.notes)
}

export { BREAK as WHATSAPP_GREETING_BREAK }
