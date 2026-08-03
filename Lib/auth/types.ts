import type { CompanyRole } from '@/Lib/tenant/types'

export type MembershipStatus = 'active' | 'inactive' | 'suspended'

export type AuthMembership = {
  id: string
  company_id: string
  branch_id: string | null
  user_id: string
  role: CompanyRole
  active: boolean
  status: MembershipStatus
  company_name?: string | null
}

export type AuthAppUser = {
  id: string
  auth_user_id: string | null
  email: string | null
  full_name: string | null
  display_name: string | null
  preferred_language: string | null
  is_pscs_master: boolean
  active: boolean
  company_id: string | null
}

export type AuthSessionContext = {
  userId: string
  email: string | null
  appUser: AuthAppUser | null
  isPlatformAdmin: boolean
  memberships: AuthMembership[]
  activeMembership: AuthMembership | null
  permissions: string[]
  supportSession: {
    id: string
    target_company_id: string
    reason: string
    started_at: string
  } | null
}
