import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { PscsOneIdentityV1 } from './types'

export class PscsOneCompanyService {
  static assertMappedCompany(identity: PscsOneIdentityV1, expectedCompanyId: string): void {
    if (identity.external_company_id !== expectedCompanyId) {
      throw new Error('company_mapping_mismatch')
    }
  }

  static async ensureMembership(authUserId: string, companyId: string): Promise<void> {
    const admin = getSupabaseServerClient()
    const { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle()

    if (!company) {
      throw new Error('mapped_company_missing')
    }

    const { data: existing } = await admin
      .from('company_memberships')
      .select('id, status')
      .eq('user_id', authUserId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (existing) {
      if (existing.status !== 'active') {
        const { error } = await admin
          .from('company_memberships')
          .update({ status: 'active', active: true })
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      }
      return
    }

    const { error } = await admin.from('company_memberships').insert({
      company_id: companyId,
      user_id: authUserId,
      role: 'viewer',
      status: 'active',
      active: true,
    })
    if (error) throw new Error(error.message)
  }
}
