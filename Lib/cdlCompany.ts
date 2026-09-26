import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'

/**
 * TEST_FIXTURE / TENANT_SEED_OK — CDL's real companies.id.
 * Do not use as an engine fallback. Import only from seeds, QA scripts, or
 * explicit DEV fixtures.
 */
export const CDL_DEFAULT_COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

/** @deprecated Prefer session company_id. Throws when no explicit context exists. */
export function getCdlCompanyId(): string {
  return getActiveCompanyId()
}

export { getActiveCompanyId, getConfiguredDevCompanyId } from '@/Lib/tenant/resolveTenant'
