import { createHash, randomBytes } from 'node:crypto'
import { getPublicAppOrigin } from '@/Lib/quoteProposal'
import { operationalRoleLabel } from '@/Lib/agenda/operationalRoles'

export function newTeamMemberConfirmationToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashTeamMemberConfirmationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

export function buildPublicTeamMemberConfirmationUrl(
  token: string,
  origin?: string,
): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '')
  return `${base}/confirmacao-equipe/${token}`
}

export function defaultConfirmationExpiryIso(days = 14): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function firstName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  return name.trim().split(/\s+/)[0] || null
}

const SECTION = '──────────────'

export type TeamMemberConfirmWhatsAppInput = {
  companyName?: string | null
  personName?: string | null
  eventDate: string
  startTime: string
  endTime: string
  eventTitle: string
  location?: string | null
  teamName: string
  roleKey: string
  confirmUrl: string
  locale?: 'pt' | 'en' | 'es'
}

export function buildTeamMemberConfirmationWhatsAppText(
  input: TeamMemberConfirmWhatsAppInput,
): string {
  const locale = input.locale ?? 'pt'
  const role = operationalRoleLabel(input.roleKey, locale)
  const brand = input.companyName?.trim() || 'Catering'
  const loc = input.location?.trim() || '—'
  const start = input.startTime.slice(0, 5)
  const end = input.endTime.slice(0, 5)
  const hello = firstName(input.personName)

  if (locale === 'en') {
    return [
      hello ? `Hi, ${hello},` : 'Hi,',
      '',
      'How are you?',
      '',
      `*EVENT CONFIRMATION* — ${brand}`,
      '',
      SECTION,
      '',
      `*Date:* ${input.eventDate}`,
      `*Time:* ${start}–${end}`,
      `*Event:* ${input.eventTitle}`,
      `*Location:* ${loc}`,
      `*Team:* ${input.teamName}`,
      `*Role:* ${role}`,
      '',
      'Please confirm your participation:',
      input.confirmUrl,
    ].join('\n')
  }

  if (locale === 'es') {
    return [
      hello ? `Hola, ${hello},` : 'Hola,',
      '',
      '¿Todo bien?',
      '',
      `*CONFIRMACIÓN DE EVENTO* — ${brand}`,
      '',
      SECTION,
      '',
      `*Fecha:* ${input.eventDate}`,
      `*Horario:* ${start}–${end}`,
      `*Evento:* ${input.eventTitle}`,
      `*Local:* ${loc}`,
      `*Equipo:* ${input.teamName}`,
      `*Función:* ${role}`,
      '',
      'Confirme su participación:',
      input.confirmUrl,
    ].join('\n')
  }

  return [
    hello ? `Olá, ${hello},` : 'Olá,',
    '',
    'Tudo bem?',
    '',
    `*CONFIRMAÇÃO DE EVENTO* — ${brand}`,
    '',
    SECTION,
    '',
    `*Data:* ${input.eventDate}`,
    `*Horário:* ${start}–${end}`,
    `*Evento:* ${input.eventTitle}`,
    `*Local:* ${loc}`,
    `*Equipe:* ${input.teamName}`,
    `*Função:* ${role}`,
    '',
    'Confirme sua participação:',
    input.confirmUrl,
  ].join('\n')
}
