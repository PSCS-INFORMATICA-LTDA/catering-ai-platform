/** Link público + helpers do pedido de guarnição ao fornecedor. */

import { getPublicAppOrigin } from '@/Lib/quoteProposal'

export function buildPublicSupplierGarnishUrl(
  token: string,
  origin?: string,
): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '')
  return `${base}/confirmacao-guarnicao/${token}`
}

export function resolveSupplierGarnishShareUrl(
  token: string | null | undefined,
): string | null {
  if (!token?.trim()) return null
  return buildPublicSupplierGarnishUrl(token.trim())
}

export function newSupplierGarnishToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  }
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')
}

export function normalizePickupTimeForDb(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null
  const t = value.trim()
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 8)
  return t
}
