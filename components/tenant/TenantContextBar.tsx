'use client'

import { tChrome } from '@/Lib/i18n/chrome'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'
import { useTenant } from './TenantProvider'

export default function TenantContextBar() {
  const { loading, company, branches, branchId, setBranchId, role } = useTenant()
  const locale = useAuthLocaleFromMe()

  if (loading) {
    return (
      <div className="liquid-glass-panel px-3 py-2 text-xs text-cdl-muted">
        {tCommon(locale, 'loadingCompany')}
      </div>
    )
  }

  const companyLabel =
    resolveTenantCompanyDisplayName(company) ??
    tChrome(locale, 'headerCompanyUnidentified')

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
          <option value="">{tCommon(locale, 'selectBranch')}</option>
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
