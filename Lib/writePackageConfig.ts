import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { normalizeCatalogItemLabelFields } from '@/Lib/publicQuote/catalogDisplayName'
import { supabase } from '@/Lib/supabase'

function withEditorialLabels(row: Record<string, unknown>) {
  return normalizeCatalogItemLabelFields(row)
}

function companyIdOrThrow(): string {
  const companyId = getCdlCompanyId()?.trim()
  if (!companyId) throw new Error('company_id não configurado.')
  return companyId
}

export async function insertPackageItem(row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_items')
    .insert({ ...withEditorialLabels(row), company_id })
    .select()
    .single()
}

export async function updatePackageItem(id: string, row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_items')
    .update(withEditorialLabels(row))
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()
}

export async function deletePackageItem(id: string) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_items')
    .delete()
    .eq('id', id)
    .eq('company_id', company_id)
}

export async function insertPackageSideItem(row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_side_items')
    .insert({ ...withEditorialLabels(row), company_id })
    .select()
    .single()
}

export async function updatePackageSideItem(id: string, row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_side_items')
    .update(withEditorialLabels(row))
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()
}

export async function deletePackageSideItem(id: string) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_side_items')
    .delete()
    .eq('id', id)
    .eq('company_id', company_id)
}

export async function insertPackageOptionGroup(row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_groups')
    .insert({ ...row, company_id })
    .select()
    .single()
}

export async function updatePackageOptionGroup(id: string, row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_groups')
    .update(row)
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()
}

export async function deletePackageOptionGroup(id: string) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_groups')
    .delete()
    .eq('id', id)
    .eq('company_id', company_id)
}

export async function insertPackageOptionGroupItem(row: Record<string, unknown>) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_group_items')
    .insert({ ...withEditorialLabels(row), company_id })
    .select()
    .single()
}

export async function updatePackageOptionGroupItem(
  id: string,
  row: Record<string, unknown>,
) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_group_items')
    .update(withEditorialLabels(row))
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()
}

export async function deletePackageOptionGroupItem(id: string) {
  const company_id = companyIdOrThrow()
  return supabase
    .from('package_option_group_items')
    .delete()
    .eq('id', id)
    .eq('company_id', company_id)
}
