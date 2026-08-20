import type { HelpRouteContext } from '@/components/help/helpContext'
import { helpActionLabel } from '@/Lib/i18n/help'

export type HelpAction =
  | 'explain'
  | 'pending'
  | 'next'
  | 'tips'
  | 'support'
  | 'whatsapp'

export function getHelpActionLabels(
  locale?: string | null,
): Record<HelpAction, string> {
  return {
    explain: helpActionLabel(locale, 'explain'),
    pending: helpActionLabel(locale, 'pending'),
    next: helpActionLabel(locale, 'next'),
    tips: helpActionLabel(locale, 'tips'),
    support: helpActionLabel(locale, 'support'),
    whatsapp: helpActionLabel(locale, 'whatsapp'),
  }
}

/** PT fallback for callers that do not pass locale. */
export const HELP_ACTION_LABELS: Record<HelpAction, string> =
  getHelpActionLabels('pt')

const PROACTIVE_BY_ROUTE: Array<{
  test: (path: string) => boolean
  hints: string[]
}> = [
  {
    test: (p) => p === '/quotes/new',
    hints: [
      'Quer ajuda para escolher o pacote ideal?',
      'Posso revisar pendências antes de avançar.',
      'Posso ajudar a confirmar cliente, pacote e adicionais.',
    ],
  },
  {
    test: (p) => p.startsWith('/packages'),
    hints: [
      'Posso revisar se este pacote tem itens, guarnições e diferenciais configurados.',
      'Quer verificar se existem escolhas obrigatórias faltando?',
    ],
  },
  {
    test: (p) => p.startsWith('/additional-items'),
    hints: [
      'Posso apontar itens sem categoria ou sem preço.',
      'Quer revisar se o item está pronto para uso comercial?',
    ],
  },
  {
    test: (p) => p.startsWith('/customers'),
    hints: [
      'Posso ajudar a revisar endereço e telefone.',
      'Quer validar se os dados do cliente estão completos?',
    ],
  },
]

const DEFAULT_HINTS = [
  'Posso ajudar nesta etapa',
  'Quer revisar antes de continuar?',
  'Há pendências para verificar',
]

export function getProactiveHints(pathname: string): string[] {
  const path = pathname.split('?')[0] ?? '/'
  for (const rule of PROACTIVE_BY_ROUTE) {
    if (rule.test(path)) return rule.hints
  }
  return DEFAULT_HINTS
}

export function pickHintForRoute(pathname: string, index = 0): string {
  const hints = getProactiveHints(pathname)
  return hints[index % hints.length] ?? DEFAULT_HINTS[0]!
}

export function buildHelpActionResponse(
  action: HelpAction,
  pathname: string,
  routeContext: HelpRouteContext,
  brandName: string,
): string {
  switch (action) {
    case 'explain':
      return `${routeContext.title}: ${routeContext.description}`
    case 'pending':
      if (pathname.includes('/quotes')) {
        return 'Revise cliente, data, pacote com escolhas obrigatórias, adicionais, endereço e distância antes de avançar ou salvar.'
      }
      if (pathname.startsWith('/packages')) {
        return 'Verifique itens fixos, guarnições (pacotes +), escolhas inclusas e vínculos com adicionais.'
      }
      return 'Nenhuma pendência automática crítica detectada nesta tela.'
    case 'next':
      if (pathname === '/quotes/new') {
        return 'Próxima ação sugerida: complete a etapa atual e use Próximo. Na etapa Pacote, confirme escolhas antes de adicionais.'
      }
      if (pathname.startsWith('/packages')) {
        return 'Próxima ação sugerida: abra um pacote e revise as três áreas — itens fixos, guarnições e escolhas.'
      }
      return 'Próxima ação sugerida: salve alterações e valide os dados principais desta tela.'
    case 'tips':
      return routeContext.quickTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')
    case 'support':
      return `Suporte ${brandName}: canal humano em breve. Por enquanto, use as dicas desta tela ou contate a operação.`
    case 'whatsapp':
      return 'Integração WhatsApp em breve. Você poderá compartilhar resumo da tela ou pendências diretamente daqui.'
    default:
      return routeContext.description
  }
}

export function helpHintStorageKey(pathname: string): string {
  return `catering-help-hint-dismissed:${pathname.split('?')[0] ?? '/'}`
}
