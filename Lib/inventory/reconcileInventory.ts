import { rebuildInventoryBalances } from '@/Lib/inventory/postInventory'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { InventoryReconciliationMismatch } from '@/Lib/inventory/types'

export type InventoryReconciliationReport = {
  ok: boolean
  company_id: string
  checked_rows: number
  mismatches: InventoryReconciliationMismatch[]
  rebuild?: Record<string, unknown>
  error?: string
}

/**
 * Compara SUM(movements) vs inventory_balances.quantity_on_hand por dimensão.
 * Opcionalmente executa rebuild_inventory_balances antes da verificação.
 */
export async function reconcileInventoryBalances(input: {
  companyId: string
  rebuildFirst?: boolean
}): Promise<InventoryReconciliationReport> {
  const db = getSupabaseServerClient()
  const { companyId, rebuildFirst = false } = input

  let rebuild: Record<string, unknown> | undefined
  if (rebuildFirst) {
    rebuild = await rebuildInventoryBalances(companyId)
    if (rebuild.ok !== true) {
      return {
        ok: false,
        company_id: companyId,
        checked_rows: 0,
        mismatches: [],
        rebuild,
        error: String(rebuild.error || 'rebuild_failed'),
      }
    }
  }

  const { data: movements, error: movErr } = await db
    .from('inventory_movements')
    .select('branch_id, location_id, catalog_item_id, lot_id, quantity')
    .eq('company_id', companyId)

  if (movErr) {
    return {
      ok: false,
      company_id: companyId,
      checked_rows: 0,
      mismatches: [],
      error: movErr.message,
    }
  }

  const ledger = new Map<string, number>()
  for (const m of movements ?? []) {
    const key = [
      m.branch_id ?? '',
      m.location_id,
      m.catalog_item_id,
      m.lot_id ?? '',
    ].join('|')
    ledger.set(key, (ledger.get(key) ?? 0) + Number(m.quantity))
  }

  const { data: balances, error: balErr } = await db
    .from('inventory_balances')
    .select(
      'branch_id, location_id, catalog_item_id, lot_id, quantity_on_hand',
    )
    .eq('company_id', companyId)

  if (balErr) {
    return {
      ok: false,
      company_id: companyId,
      checked_rows: 0,
      mismatches: [],
      error: balErr.message,
    }
  }

  const mismatches: InventoryReconciliationMismatch[] = []
  const seen = new Set<string>()

  for (const b of balances ?? []) {
    const key = [
      b.branch_id ?? '',
      b.location_id,
      b.catalog_item_id,
      b.lot_id ?? '',
    ].join('|')
    seen.add(key)
    const ledgerSum = ledger.get(key) ?? 0
    const onHand = Number(b.quantity_on_hand)
    const delta = onHand - ledgerSum
    if (Math.abs(delta) > 0.000001) {
      mismatches.push({
        branch_id: b.branch_id,
        location_id: b.location_id,
        catalog_item_id: b.catalog_item_id,
        lot_id: b.lot_id,
        ledger_sum: ledgerSum,
        balance_on_hand: onHand,
        delta,
      })
    }
  }

  for (const [key, ledgerSum] of ledger) {
    if (seen.has(key) || Math.abs(ledgerSum) <= 0.000001) continue
    const [branchId, locationId, catalogItemId, lotId] = key.split('|')
    mismatches.push({
      branch_id: branchId || null,
      location_id: locationId,
      catalog_item_id: catalogItemId,
      lot_id: lotId || null,
      ledger_sum: ledgerSum,
      balance_on_hand: 0,
      delta: -ledgerSum,
    })
  }

  return {
    ok: mismatches.length === 0,
    company_id: companyId,
    checked_rows: balances?.length ?? 0,
    mismatches,
    rebuild,
  }
}
