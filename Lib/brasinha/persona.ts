import type { BrasinhaLanguage } from './types'
import {
  resolveCompanyPublicBrand,
  type CompanyPublicBrandInput,
} from '@/Lib/tenant/companyPublicBrand'

export type BrasinhaPersona = {
  name: string
  role: string
  tone: string[]
  companyId: string
  occasionalEmoji: '🔥' | null
}

export function getCompanyPersona(
  companyId: string,
  profile?: CompanyPublicBrandInput,
): BrasinhaPersona {
  const brand = resolveCompanyPublicBrand(profile ?? {})
  return {
    name: brand.assistantName,
    role: brand.assistantRole,
    tone: ['clear', 'professional', 'helpful'],
    companyId,
    occasionalEmoji: brand.occasionalEmoji,
  }
}

export function personaIntro(language: BrasinhaLanguage, persona: BrasinhaPersona): string {
  if (language === 'en') {
    return `I'm ${persona.name}, ${persona.role} I only share catalog prices and public rules from Catering AI.`
  }
  if (language === 'es') {
    return `Soy ${persona.name}, ${persona.role} Solo comparto precios y reglas públicas de Catering AI.`
  }
  return `Eu sou ${persona.name}, ${persona.role} Só informo preços e regras públicas da Catering AI.`
}
