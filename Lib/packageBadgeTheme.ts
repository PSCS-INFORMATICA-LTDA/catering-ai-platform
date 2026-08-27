export type PackageBadgeTier =
  | 'traditional'
  | 'select'
  | 'choice'
  | 'prime'
  | 'default'

export type PackageBadgeTheme = {
  tier: PackageBadgeTier
  hasSides: boolean
  displayLabel: string
}

const TIER_STYLES: Record<
  PackageBadgeTier,
  { border: string; bg: string; text: string; weight: string }
> = {
  traditional: {
    border: 'border-[#0B1F3A]/35',
    bg: 'bg-[#0B1F3A]/10',
    text: 'text-[#0B1F3A]',
    weight: 'font-bold',
  },
  select: {
    border: 'border-[#4338CA]/35',
    bg: 'bg-[#4F46E5]/10',
    text: 'text-[#3730A3]',
    weight: 'font-bold',
  },
  choice: {
    border: 'border-[#4B5563]/35',
    bg: 'bg-[#374151]/10',
    text: 'text-[#1F2937]',
    weight: 'font-bold',
  },
  prime: {
    border: 'border-[#C9A227]/50',
    bg: 'bg-[#C9A227]/14',
    text: 'text-[#7A5E12]',
    weight: 'font-black',
  },
  default: {
    border: 'border-[#4B5563]/30',
    bg: 'bg-[#374151]/8',
    text: 'text-[#374151]',
    weight: 'font-bold',
  },
}

const GARNISH_STYLES = {
  border: 'border-[#8B6914]/45',
  bg: 'bg-[#8B6914]/12',
  text: 'text-[#5C4610]',
}

export function resolvePackageBadgeTheme(
  packageName: string | null | undefined,
): PackageBadgeTheme {
  const raw = packageName?.trim() || 'Não informado'
  const upper = raw.toUpperCase()

  const hasSides =
    upper.includes('+') ||
    upper.includes('GUARNI') ||
    upper.includes('WITH SIDES') ||
    upper.includes('COM GUARN')

  let tier: PackageBadgeTier = 'default'
  if (
    upper.includes('TRAD') ||
    upper.includes('TRADICIONAL') ||
    upper.includes('BBQTRAD')
  ) {
    tier = 'traditional'
  } else if (upper.includes('SELECT') || upper.includes('BBQSEL')) {
    tier = 'select'
  } else if (upper.includes('CHOICE') || upper.includes('BBQCHO')) {
    tier = 'choice'
  } else if (
    upper.includes('LUXURY') ||
    upper.includes('BBQLUX')
  ) {
    tier = 'prime'
  } else if (
    upper.includes('PRIME') ||
    upper.includes('PREMIUM') ||
    upper.includes('BBQPRI')
  ) {
    tier = 'prime'
  } else if (upper.includes('PERS')) {
    tier = 'choice'
  }

  return {
    tier,
    hasSides,
    displayLabel: raw.toUpperCase(),
  }
}

export function getPackageBadgeClasses(tier: PackageBadgeTier) {
  return TIER_STYLES[tier] ?? TIER_STYLES.default
}

export function getGarnishBadgeClasses() {
  return GARNISH_STYLES
}
