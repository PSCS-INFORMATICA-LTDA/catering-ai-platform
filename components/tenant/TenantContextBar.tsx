'use client'

import { useTenant } from './TenantProvider'

export default function TenantContextBar() {
  const { loading, company, branches, branchId, setBranchId, role } = useTenant()

  if (loading) {
    return (
      <div className="liquid-glass-panel px-3 py-2 text-xs text-cdl-muted">
        Carregando empresa…
      </div>
    )
  }

  const companyLabel =
    company?.trade_name?.trim() ||
    company?.company_name?.trim() ||
    'Empresa ativa'

  return (
    <div className="liquid-glass-panel flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="font-bold text-cdl-title">{companyLabel}</span>
      {role ? (
        <span className="rounded-full bg-cdl-inset px-2 py-0.5 font-semibold uppercase tracking-wide text-cdl-muted">
          {role}
        </span>
      ) : null}
      {branches.length > 1 ? (
        <select
          value={branchId ?? ''}
          onChange={(event) =>
            setBranchId(event.target.value ? event.target.value : null)
          }
          className="liquid-glass-field min-h-8 !py-1 text-xs font-semibold"
        >
          <option value="">Selecione a filial</option>
          {branches.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      ) : branches.length === 1 ? (
        <span className="text-cdl-muted">· {branches[0]!.name}</span>
      ) : null}
    </div>
  )
}
