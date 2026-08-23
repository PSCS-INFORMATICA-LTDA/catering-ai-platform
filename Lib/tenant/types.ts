export type CompanyRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'operator'
  | 'kitchen'
  | 'finance'
  | 'viewer'

export type FranchiseGroup = {
  id: string
  name: string
  slug: string
  active?: boolean | null
}

export type Company = {
  id: string
  franchise_group_id?: string | null
  company_name?: string | null
  logo_url?: string | null
  brand_logo_url?: string | null
  company_code?: string | null
  legal_name?: string | null
  trade_name?: string | null
  slug?: string | null
  currency_code?: string | null
  default_language?: string | null
  timezone?: string | null
  subscription_status?: string | null
  google_calendar_enabled?: boolean | null
  google_calendar_id?: string | null
  google_calendar_timezone?: string | null
  active?: boolean | null
}

export type Branch = {
  id: string
  company_id: string
  name: string
  slug?: string | null
  branch_code?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  timezone?: string | null
  google_calendar_enabled?: boolean | null
  google_calendar_id?: string | null
  service_radius_miles?: number | null
  mileage_fee_per_mile?: number | null
  active?: boolean | null
}

export type CompanyMembership = {
  id: string
  company_id: string
  branch_id?: string | null
  user_id: string
  role: CompanyRole
  active?: boolean | null
}

export type Subscription = {
  id: string
  company_id: string
  plan_name: string
  monthly_price: number
  currency: string
  included_branches: number
  extra_branch_price: number
  status: string
}

export type FeatureFlagKey =
  | 'customer_portal'
  | 'pdf_generation'
  | 'google_calendar'
  | 'inventory'
  | 'ai_quote_assistant'
  | 'multilingual_customer_view'
  | 'advanced_rules'
  | 'branch_management'

export type TenantContext = {
  companyId: string
  company: Company | null
  branchId: string | null
  branch: Branch | null
  branches: Branch[]
  role: CompanyRole | null
  featureFlags: Record<string, boolean>
}
