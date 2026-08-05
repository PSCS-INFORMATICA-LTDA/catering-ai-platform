export type NavChild = {
  href: string
  label: string
  soon?: boolean
}

export type NavGroup = {
  label: string
  children: NavChild[]
}

/** Menu lateral agrupado (espelho Logistics — domínio catering). */
export const CATERING_NAV: NavGroup[] = [
  {
    label: 'Operacional',
    children: [
      { href: '/agenda', label: 'Agenda de eventos' },
      { href: '/quotes', label: 'Cotações' },
      { href: '/quotes/new', label: 'Nova cotação' },
      { href: '/orders', label: 'Ordens de Serviço' },
    ],
  },
  {
    label: 'Cadastros',
    children: [
      { href: '/teams', label: 'Equipes' },
      { href: '/customers', label: 'Pessoas' },
      { href: '/packages', label: 'Pacotes' },
      { href: '/additional-items', label: 'Cadastro de itens' },
      { href: '/packages/images', label: 'Imagens' },
    ],
  },
  {
    label: 'DRE',
    children: [{ href: '#', label: 'Em breve', soon: true }],
  },
  {
    label: 'Financeiro',
    children: [{ href: '#', label: 'Em breve', soon: true }],
  },
  {
    label: 'Parâmetros',
    children: [{ href: '/commercial-rules', label: 'Regras comerciais' }],
  },
  {
    label: 'Configurações',
    children: [
      { href: '/settings/company', label: 'Empresa' },
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
    return (
      pathname === '/packages' ||
      (pathname.startsWith('/packages/') &&
        !pathname.startsWith('/packages/images'))
    )
  }
  if (href === '/quotes/new') {
    return pathname === '/quotes/new' || pathname.startsWith('/quotes/new/')
  }
  if (href === '/orders') {
    return pathname === '/orders' || pathname.startsWith('/orders/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
