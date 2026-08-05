/**
 * Textos WhatsApp — padrão Logistics (proposta ao cliente + designação da equipe).
 * Idioma: pt | en | es (idioma do cadastro / cotação / equipe).
 */

import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export type MessageLanguage = QuoteLanguage

export function normalizeMessageLanguage(
  value: string | null | undefined,
): MessageLanguage {
  const v = (value ?? 'pt').trim().toLowerCase()
  if (v === 'en' || v.startsWith('en')) return 'en'
  if (v === 'es' || v.startsWith('es') || v.startsWith('spa')) return 'es'
  return 'pt'
}

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
  guests: (adults: number, under3: number, kids: number) => string
  location: string
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
  team: string
  event: string
  client: string
  date: string
  presentation: string
  eventTime: string
  location: string
  package: string
  closingLink: string
  closingReply: string
  closingReplyYesNo: string
  waiting: string
  thanks: string
  teamFallback: string
}

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
    guests: (a, u, k) =>
      `Convidados: ${a} adultos · ${u} crianças até 3 anos · ${k} de 4 a 12 anos`,
    location: 'Local',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `Sinal para reservar a data (30%): ${m}`,
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
    guests: (a, u, k) =>
      `Guests: ${a} adults · ${u} children under 3 · ${k} ages 4–12`,
    location: 'Location',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `Deposit to reserve the date (30%): ${m}`,
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
    guests: (a, u, k) =>
      `Invitados: ${a} adultos · ${u} niños hasta 3 años · ${k} de 4 a 12 años`,
    location: 'Lugar',
    total: (m) => `*Total: ${m}*`,
    deposit: (m) => `Señal para reservar la fecha (30%): ${m}`,
    closingLink:
      'Si está de acuerdo, acceda al enlace que publico abajo y confirme la aceptación de la propuesta.',
    waiting: 'Quedo a la espera,',
    thanks: '¡Gracias por su atención!',
  },
}

const TEAM_COPY: Record<MessageLanguage, TeamCopy> = {
  pt: {
    helloNamed: (n) => `Olá, ${n},`,
    howAreYou: 'Tudo bem?',
    intro:
      'Segue a designação da equipe para o churrasco, para sua confirmação.',
    designationTitle: (code, c) => `*Designação ${code}* — ${c}`,
    team: 'Equipe',
    event: 'Evento',
    client: 'Cliente',
    date: 'Data',
    presentation: 'Horário de apresentação no local',
    eventTime: 'Horário do evento',
    location: 'Local',
    package: 'Pacote',
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
    team: 'Team',
    event: 'Event',
    client: 'Client',
    date: 'Date',
    presentation: 'On-site presentation time',
    eventTime: 'Event time',
    location: 'Location',
    package: 'Package',
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
    team: 'Equipo',
    event: 'Evento',
    client: 'Cliente',
    date: 'Fecha',
    presentation: 'Horario de presentación en el lugar',
    eventTime: 'Horario del evento',
    location: 'Lugar',
    package: 'Paquete',
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

  const lines: string[] = [
    hello ? t.helloNamed(hello) : t.hello,
    '',
    t.howAreYou,
    '',
    t.intro,
    '',
    t.proposalTitle(input.quoteNumber, company),
  ]

  if (input.eventDate) {
    lines.push(`${t.eventDate}: ${formatEventDate(input.eventDate, lang)}`)
  }
  if (input.startTime || input.endTime) {
    lines.push(
      `${t.time}: ${formatTime(input.startTime)} – ${formatTime(input.endTime)}`,
    )
  }
  if (input.packageLabel) {
    lines.push(`${t.package}: ${input.packageLabel}`)
  }

  const adults = Number(input.adultCount ?? 0)
  const under3 = Number(input.childrenUnder3Count ?? 0)
  const kids = Number(input.children4To12Count ?? 0)
  if (adults + under3 + kids > 0) {
    lines.push(t.guests(adults, under3, kids))
  }

  if (input.addressLine || input.city) {
    const place = [input.addressLine, input.city, input.state]
      .filter(Boolean)
      .join(', ')
    if (place) lines.push(`${t.location}: ${place}`)
  }

  lines.push(t.total(formatMoney(input.quoteTotal, currency, lang)))
  if (input.reservationAmount != null) {
    lines.push(
      t.deposit(formatMoney(input.reservationAmount, currency, lang)),
    )
  }

  lines.push(
    '',
    t.closingLink,
    '',
    input.proposalUrl,
    '',
    t.waiting,
    t.thanks,
    company,
  )

  return lines.join('\n')
}

/**
 * Mensagem à equipe — designação com horário de apresentação.
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
    `${t.team}: ${input.teamName}`,
    `${t.event}: ${input.eventTitle}`,
  ]

  if (input.clientName) {
    lines.push(`${t.client}: ${input.clientName}`)
  }
  lines.push(`${t.date}: ${formatEventDate(input.eventDate, lang)}`)
  if (input.presentationTime) {
    lines.push(
      `*${t.presentation}: ${formatTime(input.presentationTime)}*`,
    )
  }
  lines.push(
    `${t.eventTime}: ${formatTime(input.startTime)} – ${formatTime(input.endTime)}`,
  )
  if (input.address) {
    lines.push(`${t.location}: ${input.address}`)
  }
  if (input.packageLabel) {
    lines.push(`${t.package}: ${input.packageLabel}`)
  }

  lines.push('')
  if (input.confirmUrl?.trim()) {
    lines.push(t.closingLink, '', input.confirmUrl.trim())
  } else {
    lines.push(t.closingReply, t.closingReplyYesNo)
  }

  lines.push('', t.waiting, t.thanks, company)
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

export { BREAK as WHATSAPP_GREETING_BREAK }
