import { hasPermission } from '../../Lib/auth/permissions.ts'

export type NavChild = {
  href: string
  label: string
  soon?: boolean
  devOnly?: boolean
  requiredPermission?: string
  requiredAnyPermission?: string[]
}

type NavSession = {
  isPlatformAdmin?: boolean
  permissions?: string[] | null
} | null

/**
 * Implemented routes stay visible while the client session is hydrating.
 * Middleware already gated the shell. A null session is not "no permission".
 */
export function canSeeNavChild(session: NavSession, child: NavChild): boolean {
  const needed = [
    ...(child.requiredPermission ? [child.requiredPermission] : []),
    ...(child.requiredAnyPermission ?? []),
  ]
  if (needed.length === 0) return true
  if (!session) return true
  if (session.isPlatformAdmin) return true
  return needed.some((permission) => hasPermission(session.permissions, permission))
}

export type NavGroupId =
  | 'operational'
  | 'masterData'
  | 'dre'
  | 'financial'
  | 'parameters'
  | 'settings'

export type NavGroup = {
  id: NavGroupId
  label: string
  children: NavChild[]
}

/** Menu lateral agrupado (espelho Logistics — domínio catering). */
export const CATERING_NAV: NavGroup[] = [
  {
    id: 'operational',
    label: 'Operacional',
    children: [
      { href: '/agenda', label: 'Agenda de eventos' },
      { href: '/quotes', label: 'Cotações' },
      { href: '/quotes/new', label: 'Nova cotação' },
      { href: '/orders', label: 'Ordens de Serviço' },
      { href: '/estoque', label: 'Estoque' },
      { href: '/brasinha', label: '🔥 Brasinha', devOnly: true },
    ],
  },
  {
    id: 'masterData',
    label: 'Cadastros',
    children: [
      { href: '/teams', label: 'Equipes' },
      { href: '/customers', label: 'Pessoas' },
      { href: '/packages', label: 'Pacotes' },
      { href: '/additional-items', label: 'Cadastro de itens' },
      { href: '/media', label: 'Mídia' },
      { href: '/media/packages', label: 'Imagens de Pacotes' },
    ],
  },
  {
    id: 'dre',
    label: 'DRE',
    children: [{ href: '#', label: 'Em breve', soon: true }],
  },
  {
    id: 'financial',
    label: 'Financeiro',
    children: [
      {
        href: '/finance',
        label: 'Visão Geral',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
      {
        href: '/invoices',
        label: 'Faturamento',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
      {
        href: '/payments/paypal-control',
        label: 'PayPal',
        requiredPermission: 'finance.invoices.view',
      },
      {
        href: '/finance/refunds',
        label: 'Reembolsos',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
      {
        href: '/finance/post-event',
        label: 'Pós-evento',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
      {
        href: '/finance/reconciliation',
        label: 'Conciliação',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
      {
        href: '/finance/pscs-one',
        label: 'Integração PSCS One',
        requiredAnyPermission: ['finance.invoices.view', 'orders.financial.view'],
      },
    ],
  },
  {
    id: 'parameters',
    label: 'Parâmetros',
    children: [
      { href: '/commercial-rules', label: 'Regras comerciais' },
      {
        href: '/coupons',
        label: 'Cupons',
        requiredPermission: 'commercial.coupons.view',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    children: [
      { href: '/settings/company', label: 'Empresa' },
      { href: '/settings/payments', label: 'Pagamentos' },
      {
        href: '/settings/notifications',
        label: 'Notificações',
        requiredAnyPermission: ['notifications.view', 'notification_deliveries.view'],
      },
      { href: '/settings/dictionary', label: 'Dicionário de dados' },
      { href: '/users', label: 'Usuários e acessos' },
      { href: '/profile', label: 'Meu perfil' },
    ],
  },
]

export function isNavHrefActive(pathname: string, href: string): boolean {
  if (!href || href === '#') return false
  if (href === '/quotes') {
    return (
      pathname === '/quotes' ||
      (pathname.startsWith('/quotes/') && !pathname.startsWith('/quotes/new'))
    )
  }
  if (href === '/packages') {
    return pathname === '/packages' || pathname.startsWith('/packages/')
  }
  if (href === '/media') {
    return pathname === '/media'
  }
  if (href === '/media/packages') {
    return pathname === '/media/packages' || pathname.startsWith('/media/packages/')
  }
  if (href === '/quotes/new') {
    return pathname === '/quotes/new' || pathname.startsWith('/quotes/new/')
  }
  if (href === '/orders') {
    return pathname === '/orders' || pathname.startsWith('/orders/')
  }
  if (href === '/finance') {
    return pathname === '/finance'
  }
  if (href === '/invoices') {
    return pathname === '/invoices' || pathname.startsWith('/invoices/')
  }
  if (href === '/coupons') {
    return pathname === '/coupons' || pathname.startsWith('/coupons/')
  }
  if (href === '/estoque') {
    return pathname === '/estoque' || pathname.startsWith('/estoque/')
  }
  if (href === '/brasinha') {
    return pathname === '/brasinha' || pathname.startsWith('/brasinha/') || pathname === '/dev/brasinha'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
