export type CompanyPublicBrandInput = {
  companyName?: string | null
  tradeName?: string | null
  legalName?: string | null
  city?: string | null
  state?: string | null
  locationLabel?: string | null
  logoUrl?: string | null
  assistantName?: string | null
  assistantRole?: string | null
  occasionalEmoji?: string | null
}

export type CompanyPublicBrand = {
  displayName: string
  location: string | null
  logoUrl: string | null
  assistantName: string
  assistantRole: string
  occasionalEmoji: '🔥' | null
}

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
}

export function expandRegionName(region: string | null | undefined): string | null {
  const raw = region?.trim()
  if (!raw) return null
  const mapped = US_STATE_NAMES[raw.toUpperCase()]
  return mapped || raw
}

export function formatCompanyLocation(input: CompanyPublicBrandInput): string | null {
  const labeled = input.locationLabel?.trim()
  if (labeled) return labeled
  const city = input.city?.trim() || ''
  const region = expandRegionName(input.state)
  if (city && region) return `${city}, ${region}`
  return city || region || null
}

export function resolveCompanyDisplayNameFromBrand(
  input: CompanyPublicBrandInput,
): string {
  return (
    input.tradeName?.trim() ||
    input.companyName?.trim() ||
    input.legalName?.trim() ||
    'Catering AI'
  )
}

export function resolveCompanyPublicBrand(
  input: CompanyPublicBrandInput,
): CompanyPublicBrand {
  const displayName = resolveCompanyDisplayNameFromBrand(input)
  return {
    displayName,
    location: formatCompanyLocation(input),
    logoUrl: input.logoUrl?.trim() || null,
    assistantName: input.assistantName?.trim() || 'Assistant',
    assistantRole:
      input.assistantRole?.trim() ||
      `Digital catering assistant for ${displayName}.`,
    occasionalEmoji: input.occasionalEmoji === '🔥' ? '🔥' : null,
  }
}

export function parseAssistantPersonaRule(value: unknown): {
  name: string | null
  role: string | null
  locationLabel: string | null
  occasionalEmoji: string | null
} {
  const raw =
    value && typeof value === 'object' && value !== null && 'value' in value
      ? (value as { value: unknown }).value
      : value
  if (!raw || typeof raw !== 'object') {
    return { name: null, role: null, locationLabel: null, occasionalEmoji: null }
  }
  const record = raw as Record<string, unknown>
  const text = (key: string) =>
    typeof record[key] === 'string' ? String(record[key]).trim() || null : null
  return {
    name: text('name'),
    role: text('role'),
    locationLabel: text('location_label'),
    occasionalEmoji: text('occasional_emoji'),
  }
}
