import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('paymentSettings', 'billing', {
  title: { pt: 'Pagamentos', en: 'Payments', es: 'Pagos' },
  subtitle: {
    pt: 'Provedores da empresa ativa. Credenciais nunca saem do servidor.',
    en: 'Providers for the active company. Credentials never leave the server.',
    es: 'Proveedores de la empresa activa. Las credenciales nunca salen del servidor.',
  },
  breadcrumbSettings: { pt: 'Configurações', en: 'Settings', es: 'Configuración' },
  breadcrumbPayments: { pt: 'Pagamentos', en: 'Payments', es: 'Pagos' },
  breadcrumbProviders: { pt: 'Provedores', en: 'Providers', es: 'Proveedores' },
  breadcrumbPaypal: { pt: 'PayPal', en: 'PayPal', es: 'PayPal' },
  accessNote: {
    pt: 'Acesso: company.settings (owner/admin da empresa ativa via PSCS One). Sem admin global.',
    en: 'Access: company.settings (owner/admin of the active company via PSCS One). No global admin.',
    es: 'Acceso: company.settings (owner/admin de la empresa activa vía PSCS One). Sin admin global.',
  },
  providers: { pt: 'Provedores', en: 'Providers', es: 'Proveedores' },
  paypal: { pt: 'PayPal', en: 'PayPal', es: 'PayPal' },
  zelle: { pt: 'Zelle', en: 'Zelle', es: 'Zelle' },
  bank: {
    pt: 'Transferência bancária',
    en: 'Bank transfer',
    es: 'Transferencia bancaria',
  },
  preserved: { pt: 'Preservado', en: 'Preserved', es: 'Preservado' },
  statusUnconfigured: {
    pt: 'Não configurado',
    en: 'Not configured',
    es: 'No configurado',
  },
  statusConfigured: { pt: 'Configurado', en: 'Configured', es: 'Configurado' },
  statusValidated: {
    pt: 'Conexão validada',
    en: 'Connection validated',
    es: 'Conexión validada',
  },
  statusError: { pt: 'Erro', en: 'Error', es: 'Error' },
  environment: { pt: 'Ambiente', en: 'Environment', es: 'Ambiente' },
  sandbox: { pt: 'Sandbox', en: 'Sandbox', es: 'Sandbox' },
  liveDisabled: {
    pt: 'Live desabilitado / não homologado',
    en: 'Live disabled / not homologated',
    es: 'Live deshabilitado / no homologado',
  },
  clientId: { pt: 'Client ID', en: 'Client ID', es: 'Client ID' },
  clientSecret: { pt: 'Client Secret', en: 'Client Secret', es: 'Client Secret' },
  secretConfigured: { pt: 'Configurado', en: 'Configured', es: 'Configurado' },
  secretPlaceholder: {
    pt: 'Deixe vazio para manter o segredo atual',
    en: 'Leave blank to keep the current secret',
    es: 'Deje vacío para mantener el secreto actual',
  },
  replaceSecret: {
    pt: 'Substituir segredo',
    en: 'Replace secret',
    es: 'Reemplazar secreto',
  },
  webhookUrl: { pt: 'Webhook URL', en: 'Webhook URL', es: 'Webhook URL' },
  webhookId: { pt: 'Webhook ID', en: 'Webhook ID', es: 'Webhook ID' },
  copy: { pt: 'Copiar', en: 'Copy', es: 'Copiar' },
  copied: { pt: 'Copiado', en: 'Copied', es: 'Copiado' },
  enabled: {
    pt: 'PayPal ativo para a empresa',
    en: 'PayPal enabled for this company',
    es: 'PayPal activo para la empresa',
  },
  publicCheckoutOff: {
    pt: 'Checkout público: OFF / não homologado',
    en: 'Public checkout: OFF / not homologated',
    es: 'Checkout público: OFF / no homologado',
  },
  webhookStatus: { pt: 'Webhook status', en: 'Webhook status', es: 'Estado del webhook' },
  webhookReady: { pt: 'Configurado', en: 'Configured', es: 'Configurado' },
  webhookMissing: {
    pt: 'Não configurado',
    en: 'Not configured',
    es: 'No configurado',
  },
  errorNotConfigured: {
    pt: 'PayPal ainda não está configurado para esta empresa.',
    en: 'PayPal is not configured for this company yet.',
    es: 'PayPal aún no está configurado para esta empresa.',
  },
  errorLiveBlocked: {
    pt: 'PayPal Live está bloqueado nesta rodada.',
    en: 'PayPal Live is blocked in this round.',
    es: 'PayPal Live está bloqueado en esta ronda.',
  },
  errorAuthFailed: {
    pt: 'Não foi possível validar a conexão Sandbox. Confira Client ID e Client Secret.',
    en: 'Could not validate the Sandbox connection. Check Client ID and Client Secret.',
    es: 'No fue posible validar la conexión Sandbox. Revise Client ID y Client Secret.',
  },
  errorTestRequired: {
    pt: 'Valide a conexão Sandbox antes de configurar o webhook.',
    en: 'Validate the Sandbox connection before configuring the webhook.',
    es: 'Valide la conexión Sandbox antes de configurar el webhook.',
  },
  errorWebhookFailed: {
    pt: 'Não foi possível configurar o webhook Sandbox.',
    en: 'Could not configure the Sandbox webhook.',
    es: 'No fue posible configurar el webhook Sandbox.',
  },
  errorForbidden: {
    pt: 'Sem permissão para administrar pagamentos desta empresa.',
    en: 'You cannot administer payments for this company.',
    es: 'Sin permiso para administrar pagos de esta empresa.',
  },
  save: {
    pt: 'Salvar configuração',
    en: 'Save configuration',
    es: 'Guardar configuración',
  },
  test: { pt: 'Testar conexão', en: 'Test connection', es: 'Probar conexión' },
  configureWebhook: {
    pt: 'Configurar / atualizar webhook',
    en: 'Configure / update webhook',
    es: 'Configurar / actualizar webhook',
  },
  lastTest: { pt: 'Último teste', en: 'Last test', es: 'Última prueba' },
  never: { pt: 'Nunca', en: 'Never', es: 'Nunca' },
  saved: {
    pt: 'Configuração salva.',
    en: 'Configuration saved.',
    es: 'Configuración guardada.',
  },
  testOk: {
    pt: 'Conexão PayPal Sandbox validada.',
    en: 'PayPal Sandbox connection validated.',
    es: 'Conexión PayPal Sandbox validada.',
  },
  webhookOk: {
    pt: 'Webhook configurado.',
    en: 'Webhook configured.',
    es: 'Webhook configurado.',
  },
  canonicalNote: {
    pt: 'Empresa resolvida pela sessão / mapping PSCS One. company_id do browser não autoriza.',
    en: 'Company is resolved from the session / PSCS One mapping. Browser company_id is not authorization.',
    es: 'Empresa resuelta por la sesión / mapping PSCS One. company_id del navegador no autoriza.',
  },
})

export const tPaymentSettings = t
export const listPaymentSettingsI18nEntries = list
