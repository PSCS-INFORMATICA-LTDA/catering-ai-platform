import type { BrasinhaLanguage } from './types'

const CDL_COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

export type BrasinhaPersona = {
  name: string
  role: string
  tone: string[]
  companyId: string
  occasionalEmoji: '🔥' | null
}

const CDL_PERSONA: BrasinhaPersona = {
  name: 'Brasinha',
  role: 'Assistente digital da CDL Services BBQ At Home.',
  tone: ['simpático', 'objetivo', 'acolhedor', 'comercial', 'profissional'],
  companyId: CDL_COMPANY_ID,
  occasionalEmoji: '🔥',
}

export function getCompanyPersona(companyId: string): BrasinhaPersona {
  if (companyId === CDL_COMPANY_ID) return CDL_PERSONA
  return {
    name: 'Assistant',
    role: 'Digital catering assistant',
    tone: ['clear', 'professional', 'helpful'],
    companyId,
    occasionalEmoji: null,
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
