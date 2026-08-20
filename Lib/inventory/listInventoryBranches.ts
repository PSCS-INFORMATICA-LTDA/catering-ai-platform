import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type InventoryBranchOption = {
  id: string
  name: string
  branch_code: string | null
  is_default: boolean
}

export async function listInventoryBranches(
  companyId: string,
): Promise<{ data: InventoryBranchOption[]; error?: string }> {
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('branches')
    .select('id, name, branch_code, is_default, active')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      branch_code: b.branch_code,
      is_default: b.is_default === true,
    })),
  }
}
