import { createHash, randomBytes } from 'node:crypto'
import { getPublicAppOrigin } from '@/Lib/quoteProposal'

export function newMaterialDispatchToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashMaterialDispatchToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

export function buildPublicMaterialDispatchUrl(
  token: string,
  origin?: string,
  locale?: 'pt' | 'en' | 'es' | null,
): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '')
  const lang = locale === 'en' || locale === 'es' ? locale : 'pt'
  return `${base}/conferencia-saida/${token}?lang=${lang}`
}

/** Locale da rota pública: query → líder → Accept-Language → PT. */
export function resolvePublicDispatchLocale(input: {
  queryLang?: string | null
  leaderLocale?: string | null
  acceptLanguage?: string | null
}): 'pt' | 'en' | 'es' {
  const q = (input.queryLang || '').trim().toLowerCase()
  if (q === 'en' || q === 'es' || q === 'pt') return q
  const leader = (input.leaderLocale || '').trim().toLowerCase()
  if (leader.startsWith('en')) return 'en'
  if (leader.startsWith('es')) return 'es'
  if (leader.startsWith('pt')) return 'pt'
  const accept = (input.acceptLanguage || '').toLowerCase()
  if (accept.includes('en')) return 'en'
  if (accept.includes('es')) return 'es'
  return 'pt'
}

/**
 * Expiração: fim do dia do evento (UTC) + 2 dias.
 * Se sem data de evento: 7 dias a partir de agora (fallback).
 */
export function defaultMaterialDispatchExpiryIso(
  eventDate: string | null | undefined,
): string {
  if (eventDate && /^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
    const d = new Date(`${eventDate.slice(0, 10)}T23:59:59.000Z`)
    d.setUTCDate(d.getUTCDate() + 2)
    return d.toISOString()
  }
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

export type MaterialDispatchWhatsAppInput = {
  companyName?: string | null
  leaderName?: string | null
  eventDate: string
  startTime?: string | null
  endTime?: string | null
  eventLabel?: string | null
  location?: string | null
  teamName?: string | null
  confirmUrl: string
  locale?: 'pt' | 'en' | 'es'
}

function firstName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  return name.trim().split(/\s+/)[0] || null
}

const SECTION = '──────────────'

export function buildMaterialDispatchWhatsAppText(
  input: MaterialDispatchWhatsAppInput,
): string {
  const locale = input.locale ?? 'pt'
  const brand = input.companyName?.trim() || 'Catering'
  const hello = firstName(input.leaderName)
  const start = (input.startTime || '').slice(0, 5) || '—'
  const end = (input.endTime || '').slice(0, 5) || '—'
  const loc = input.location?.trim() || '—'
  const event = input.eventLabel?.trim() || '—'
  const team = input.teamName?.trim() || '—'

  if (locale === 'en') {
    return [
      hello ? `Hi, ${hello},` : 'Hi,',
      '',
      `*DISPATCH CHECK* — ${brand}`,
      '',
      SECTION,
      '',
      `*Date:* ${input.eventDate}`,
      `*Time:* ${start}–${end}`,
      `*Event:* ${event}`,
      `*Location:* ${loc}`,
      `*Team:* ${team}`,
      '',
      'Please check materials before leaving:',
      input.confirmUrl,
    ].join('\n')
  }

  if (locale === 'es') {
    return [
      hello ? `Hola, ${hello},` : 'Hola,',
      '',
      `*CONFERENCIA DE SALIDA* — ${brand}`,
      '',
      SECTION,
      '',
      `*Fecha:* ${input.eventDate}`,
      `*Horario:* ${start}–${end}`,
      `*Evento:* ${event}`,
      `*Local:* ${loc}`,
      `*Equipo:* ${team}`,
      '',
      'Confirme los materiales antes de salir:',
      input.confirmUrl,
    ].join('\n')
  }

  return [
    hello ? `Olá, ${hello},` : 'Olá,',
    '',
    `*CONFERÊNCIA DE SAÍDA* — ${brand}`,
    '',
    SECTION,
    '',
    `*Data:* ${input.eventDate}`,
    `*Horário:* ${start}–${end}`,
    `*Evento:* ${event}`,
    `*Local:* ${loc}`,
    `*Equipe:* ${team}`,
    '',
    'Confira os materiais antes da saída:',
    input.confirmUrl,
  ].join('\n')
}
