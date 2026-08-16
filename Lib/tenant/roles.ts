import type { CompanyRole } from './types'

const ROLE_RANK: Record<CompanyRole, number> = {
  owner: 100,
  admin: 90,
  manager: 70,
  sales: 60,
  finance: 55,
  operator: 50,
  kitchen: 40,
  viewer: 10,
}

export function canManageCompany(role: CompanyRole | null | undefined): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK.admin
}

export function canCreateQuotes(role: CompanyRole | null | undefined): boolean {
  if (!role) return true
  return ROLE_RANK[role] >= ROLE_RANK.sales
}

export function canViewConfirmedEvents(
  role: CompanyRole | null | undefined,
): boolean {
  if (!role) return true
  return ROLE_RANK[role] >= ROLE_RANK.kitchen
}

export function isReadOnlyRole(role: CompanyRole | null | undefined): boolean {
  return role === 'viewer'
}
