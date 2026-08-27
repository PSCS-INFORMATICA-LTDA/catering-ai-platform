import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('paymentSettings', 'billing', {
  title: { pt: 'Pagamentos', en: 'Payments', es: 'Pagos' },
  subtitle: {
    pt: 'Provedores da empresa ativa. Credenciais nunca saem do servidor.',
    en: 'Providers for the active company. Credentials never leave the server.',
    es: 'Proveedores de la empresa activa. Las credenciales nunca salen del servidor.',
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
    pt: 'Checkout público: OFF',
    en: 'Public checkout: OFF',
    es: 'Checkout público: OFF',
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
