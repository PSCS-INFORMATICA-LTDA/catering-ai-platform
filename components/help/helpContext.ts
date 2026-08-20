import { tHelp } from '@/Lib/i18n/help'

export type HelpRouteContext = {
  title: string
  description: string
  quickTips: string[]
}

function defaultContext(locale?: string | null): HelpRouteContext {
  return {
    title: tHelp(locale, 'titleDefault'),
    description: tHelp(locale, 'descDefault'),
    quickTips: [tHelp(locale, 'tipDefault1'), tHelp(locale, 'tipDefault2')],
  }
}

function matchContext(
  pathname: string,
  rules: Array<{ test: (path: string) => boolean; ctx: HelpRouteContext }>,
): HelpRouteContext | null {
  for (const rule of rules) {
    if (rule.test(pathname)) return rule.ctx
  }
  return null
}

function routeRules(
  locale?: string | null,
): Array<{ test: (path: string) => boolean; ctx: HelpRouteContext }> {
  return [
    {
      test: (path) => path === '/quotes/new',
      ctx: {
        title: tHelp(locale, 'titleQuoteNew'),
        description:
          'Posso ajudar com cliente, pacote, adicionais, regras e revisão da proposta.',
        quickTips: [
          'Confirme cliente, data e número de convidados.',
          'Na etapa Pacote, revise itens fixos, escolhas e guarnições.',
          'Antes de enviar, valide endereço e distância.',
        ],
      },
    },
    {
      test: (path) => /^\/quotes\/[^/]+\/edit$/.test(path),
      ctx: {
        title: tHelp(locale, 'titleQuoteEdit'),
        description:
          'Posso ajudar a revisar alterações, pacote, adicionais e pendências antes de salvar.',
        quickTips: [
          'Alterações no pacote podem resetar escolhas inclusas.',
          'Revise o total por pessoa após mudanças.',
        ],
      },
    },
    {
      test: (path) => path === '/packages' || path.startsWith('/packages/'),
      ctx: {
        title: tHelp(locale, 'titlePackages'),
        description:
          'Posso ajudar a revisar itens, guarnições, diferenciais e escolhas configuráveis.',
        quickTips: [
          'Separe itens fixos, guarnições e escolhas inclusas.',
          'Vincule adicionais para bloqueio e custo.',
        ],
      },
    },
    {
      test: (path) =>
        path === '/additional-items' || path.startsWith('/additional-items/'),
      ctx: {
        title: tHelp(locale, 'titleItems'),
        description:
          'Posso ajudar com categoria, preço, vínculo comercial e uso no sistema.',
        quickTips: [
          'Itens inativos não aparecem na cotação.',
          'Categoria e preço impactam a etapa de adicionais.',
        ],
      },
    },
    {
      test: (path) => path === '/customers' || path.startsWith('/customers/'),
      ctx: {
        title: tHelp(locale, 'titleCustomers'),
        description: 'Posso ajudar com nome, telefone, endereço e validação.',
        quickTips: [
          'Telefone válido facilita contato e confirmação.',
          'Endereço completo ajuda na etapa de logística.',
        ],
      },
    },
    {
      test: (path) =>
        path === '/commercial-rules' || path.startsWith('/commercial-rules/'),
      ctx: {
        title: tHelp(locale, 'titleCommercial'),
        description:
          'Posso ajudar com mínimos, taxas, descontos e critérios de cobrança.',
        quickTips: [
          'Regras afetam cálculo automático da cotação.',
          'Revise valores mínimos antes de fechar propostas.',
        ],
      },
    },
    {
      test: (path) => path === '/quotes' || /^\/quotes\/[^/]+$/.test(path),
      ctx: {
        title: tHelp(locale, 'titleQuotes'),
        description: 'Posso ajudar a revisar status, pendências e envio.',
        quickTips: [
          'Filtre por data para encontrar eventos próximos.',
          'Abra a cotação para ver detalhes e PDF.',
        ],
      },
    },
    {
      test: (path) =>
        path === '/customer-quote' || path.startsWith('/customer-quote/'),
      ctx: {
        title: tHelp(locale, 'titleProposal'),
        description: 'Posso explicar a proposta e orientar o cliente.',
        quickTips: [
          'Revise pacote, adicionais e valores com o cliente.',
          'Confirme data, local e número de convidados.',
        ],
      },
    },
    {
      test: (path) => path === '/' || path === '/quote-request',
      ctx: {
        title: tHelp(locale, 'titleHome'),
        description: 'Central de ajuda para operação comercial e cotações.',
        quickTips: [
          'Comece uma nova cotação pelo menu Cotações.',
          'Mantenha pacotes e adicionais atualizados no cadastro.',
        ],
      },
    },
  ]
}

export function resolveHelpContext(
  pathname: string,
  locale?: string | null,
): HelpRouteContext {
  const normalized = pathname.split('?')[0]?.trim() || '/'
  return matchContext(normalized, routeRules(locale)) ?? defaultContext(locale)
}

export function isHelpHiddenRoute(pathname: string): boolean {
  const path = pathname.toLowerCase()
  const hidden = ['/login', '/auth', '/sign-in', '/signin', '/onboarding']
  return hidden.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

export function isQuoteFlowRoute(pathname: string): boolean {
  return (
    pathname === '/quotes/new' ||
    /^\/quotes\/[^/]+\/edit$/.test(pathname)
  )
}
