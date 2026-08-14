import type { AuthLocale } from './authUsers.ts'
import { pickLocalizedText } from './locales.ts'

const dict = {
  pt: {
    groupOperational: 'Operacional',
    groupMasterData: 'Cadastros',
    groupDre: 'DRE',
    groupFinancial: 'Financeiro',
    groupParameters: 'Parâmetros',
    groupSettings: 'Configurações',
    navAgenda: 'Agenda de eventos',
    navQuotes: 'Cotações',
    navNewQuote: 'Nova cotação',
    navOrders: 'Ordens de Serviço',
    navInventory: 'Estoque',
    navTeams: 'Equipes',
    navPeople: 'Pessoas',
    navPackages: 'Pacotes',
    navCatalogItems: 'Cadastro de itens',
    navImages: 'Imagens',
    navComingSoon: 'Em breve',
    navCommercialRules: 'Regras comerciais',
    navCompany: 'Empresa',
    navDataDictionary: 'Dicionário de dados',
    navUsersAccess: 'Usuários e acessos',
    navProfile: 'Meu perfil',
    headerCompany: 'Empresa',
    headerCompanyPrefix: 'EMPRESA:',
    headerCompanyFallback: 'Empresa',
    headerCompanyUnidentified: 'Empresa não identificada',
    headerOpenMenu: 'Abrir menu',
    sidebarMainMenu: 'Menu principal',
    sidebarExpand: 'Expandir menu',
    sidebarCollapse: 'Recolher menu',
    sidebarClose: 'Fechar menu',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    themeActivateDark: 'Ativar tema escuro',
    themeActivateLight: 'Ativar tema claro',
    themeDarkTitle: 'Tema escuro',
    themeLightTitle: 'Tema claro',
  },
  en: {
    groupOperational: 'Operational',
    groupMasterData: 'Master data',
    groupDre: 'P&L',
    groupFinancial: 'Financial',
    groupParameters: 'Parameters',
    groupSettings: 'Settings',
    navAgenda: 'Events schedule',
    navQuotes: 'Quotes',
    navNewQuote: 'New quote',
    navOrders: 'Service Orders',
    navInventory: 'Inventory',
    navTeams: 'Teams',
    navPeople: 'People',
    navPackages: 'Packages',
    navCatalogItems: 'Item catalog',
    navImages: 'Images',
    navComingSoon: 'Coming soon',
    navCommercialRules: 'Business rules',
    navCompany: 'Company',
    navDataDictionary: 'Data dictionary',
    navUsersAccess: 'Users and access',
    navProfile: 'My profile',
    headerCompany: 'Company',
    headerCompanyPrefix: 'COMPANY:',
    headerCompanyFallback: 'Company',
    headerCompanyUnidentified: 'Company not identified',
    headerOpenMenu: 'Open menu',
    sidebarMainMenu: 'Main menu',
    sidebarExpand: 'Expand menu',
    sidebarCollapse: 'Collapse menu',
    sidebarClose: 'Close menu',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeActivateDark: 'Switch to dark theme',
    themeActivateLight: 'Switch to light theme',
    themeDarkTitle: 'Dark theme',
    themeLightTitle: 'Light theme',
  },
  es: {
    groupOperational: 'Operacional',
    groupMasterData: 'Maestros',
    groupDre: 'PyG',
    groupFinancial: 'Financiero',
    groupParameters: 'Parámetros',
    groupSettings: 'Configuración',
    navAgenda: 'Agenda de eventos',
    navQuotes: 'Presupuestos',
    navNewQuote: 'Nuevo presupuesto',
    navOrders: 'Órdenes de Servicio',
    navInventory: 'Inventario',
    navTeams: 'Equipos',
    navPeople: 'Personas',
    navPackages: 'Paquetes',
    navCatalogItems: 'Registro de ítems',
    navImages: 'Imágenes',
    navComingSoon: 'Próximamente',
    navCommercialRules: 'Reglas comerciales',
    navCompany: 'Empresa',
    navDataDictionary: 'Diccionario de datos',
    navUsersAccess: 'Usuarios y accesos',
    navProfile: 'Mi perfil',
    headerCompany: 'Empresa',
    headerCompanyPrefix: 'EMPRESA:',
    headerCompanyFallback: 'Empresa',
    headerCompanyUnidentified: 'Empresa no identificada',
    headerOpenMenu: 'Abrir menú',
    sidebarMainMenu: 'Menú principal',
    sidebarExpand: 'Expandir menú',
    sidebarCollapse: 'Contraer menú',
    sidebarClose: 'Cerrar menú',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    themeActivateDark: 'Activar tema oscuro',
    themeActivateLight: 'Activar tema claro',
    themeDarkTitle: 'Tema oscuro',
    themeLightTitle: 'Tema claro',
  },
} as const

export type ChromeMessageKey = keyof (typeof dict)['pt']

export type ChromeNavGroupId =
  | 'operational'
  | 'masterData'
  | 'dre'
  | 'financial'
  | 'parameters'
  | 'settings'

const GROUP_KEY_MAP: Record<ChromeNavGroupId, ChromeMessageKey> = {
  operational: 'groupOperational',
  masterData: 'groupMasterData',
  dre: 'groupDre',
  financial: 'groupFinancial',
  parameters: 'groupParameters',
  settings: 'groupSettings',
}

const NAV_HREF_KEY_MAP: Record<string, ChromeMessageKey> = {
  '/agenda': 'navAgenda',
  '/quotes': 'navQuotes',
  '/quotes/new': 'navNewQuote',
  '/orders': 'navOrders',
  '/estoque': 'navInventory',
  '/teams': 'navTeams',
  '/customers': 'navPeople',
  '/packages': 'navPackages',
  '/additional-items': 'navCatalogItems',
  '/packages/images': 'navImages',
  '/commercial-rules': 'navCommercialRules',
  '/settings/company': 'navCompany',
  '/settings/dictionary': 'navDataDictionary',
  '/users': 'navUsersAccess',
  '/profile': 'navProfile',
}

export function tChrome(
  locale: AuthLocale | string | null | undefined,
  key: ChromeMessageKey,
): string {
  return pickLocalizedText(
    { pt: dict.pt[key], en: dict.en[key], es: dict.es[key] },
    locale,
  )
}

export function getChromeGroupLabel(
  locale: AuthLocale | string | null | undefined,
  groupId: string,
  fallbackLabel: string,
): string {
  const key = GROUP_KEY_MAP[groupId as ChromeNavGroupId]
  if (!key) return fallbackLabel
  return tChrome(locale, key) || fallbackLabel
}

export function getChromeNavLabel(
  locale: AuthLocale | string | null | undefined,
  href: string,
  fallbackLabel: string,
  soon = false,
): string {
  if (soon || href === '#') return tChrome(locale, 'navComingSoon') || fallbackLabel
  const key = NAV_HREF_KEY_MAP[href]
  if (!key) return fallbackLabel
  return tChrome(locale, key) || fallbackLabel
}

export function listChromeNavHrefs(): string[] {
  return Object.keys(NAV_HREF_KEY_MAP)
}

export function listChromeGroupIds(): ChromeNavGroupId[] {
  return Object.keys(GROUP_KEY_MAP) as ChromeNavGroupId[]
}

export function listChromeI18nEntries(): Array<{
  key: string
  module: string
  context: string
  pt: string
  en: string
  es: string
}> {
  return (Object.keys(dict.pt) as ChromeMessageKey[]).map((key) => ({
    key: `chrome.${key}`,
    module: 'chrome',
    context: 'shell',
    pt: dict.pt[key],
    en: dict.en[key],
    es: dict.es[key],
  }))
}
