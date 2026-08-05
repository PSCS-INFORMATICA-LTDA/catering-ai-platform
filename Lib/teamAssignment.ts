/** Link público + helpers da designação da equipe (padrão Logistics). */

import { getPublicAppOrigin } from '@/Lib/quoteProposal'

export function buildPublicTeamAssignmentUrl(
  token: string,
  origin?: string,
): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '')
  return `${base}/designacao-equipe/${token}`
}

export function resolveTeamAssignmentShareUrl(
  token: string | null | undefined,
): string | null {
  if (!token?.trim()) return null
  return buildPublicTeamAssignmentUrl(token.trim())
}

export function newTeamAssignmentToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  }
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')
}

/** Sugere apresentação 90 min antes do início do evento (ou o próprio início). */
export function suggestPresentationTime(
  startTime: string | null | undefined,
): string {
  if (!startTime) return '10:00'
  const parts = startTime.slice(0, 5).split(':').map(Number)
  const h = parts[0] ?? 10
  const m = parts[1] ?? 0
  let total = h * 60 + m - 90
  if (total < 0) total = h * 60 + m
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function normalizeTimeForDb(value: string): string {
  const t = value.trim()
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 8)
  return t
}

export function formatTimeShort(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length >= 5 ? value.slice(0, 5) : value
}
