/**
 * Proposed MEDIA_EDITOR role for Juninho.
 * NOT applied: roles / role_permissions / RLS stay unchanged until PO approval.
 * Do not import this into auth fallbacks until the migration is approved.
 */
export const PROPOSED_JUNINHO_ROLE = 'media_editor' as const

export const PROPOSED_JUNINHO_ALLOW = [
  'media.view',
  'media.manage',
  'catalog.view',
] as const

export const PROPOSED_JUNINHO_DENY = [
  'media.delete',
  'quotes.view',
  'quotes.manage',
  'orders.financial.view',
  'users.view',
  'users.manage',
  'users.invite',
  'company.settings',
  'materials.rules.manage',
  'catalog.manage',
  'inventory.adjust',
] as const

export const MEDIA_EDITOR_READY = false
export const SCHEMA_CHANGE_REQUIRED_FOR_ROLE = true
export const RLS_CHANGE_REQUIRED_FOR_ROLE = false
