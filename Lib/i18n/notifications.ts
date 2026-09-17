import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('notifications', 'notifications', {
  title: { pt: 'Central de notificações', en: 'Notification Center', es: 'Centro de notificaciones' },
  recipients: { pt: 'Destinatários', en: 'Recipients', es: 'Destinatarios' },
  deliveries: { pt: 'Histórico de entregas', en: 'Delivery history', es: 'Historial de entregas' },
  eventQuoteCreated: { pt: 'Nova cotação', en: 'New quote', es: 'Nuevo presupuesto' },
  channelWhatsapp: { pt: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp' },
  enabled: { pt: 'Ativo', en: 'Enabled', es: 'Activo' },
  disabled: { pt: 'Desativado', en: 'Disabled', es: 'Desactivado' },
  addRecipient: { pt: 'Adicionar destinatário', en: 'Add recipient', es: 'Añadir destinatario' },
  displayName: { pt: 'Nome', en: 'Name', es: 'Nombre' },
  phone: { pt: 'Telefone', en: 'Phone', es: 'Teléfono' },
  locale: { pt: 'Idioma', en: 'Locale', es: 'Idioma' },
  save: { pt: 'Salvar', en: 'Save', es: 'Guardar' },
  retry: { pt: 'Tentar de novo', en: 'Retry', es: 'Reintentar' },
  status: { pt: 'Status', en: 'Status', es: 'Estado' },
  channel: { pt: 'Canal', en: 'Channel', es: 'Canal' },
  template: { pt: 'Template', en: 'Template', es: 'Plantilla' },
  providerId: { pt: 'ID do provedor', en: 'Provider ID', es: 'ID del proveedor' },
  error: { pt: 'Erro', en: 'Error', es: 'Error' },
  createdAt: { pt: 'Criado em', en: 'Created at', es: 'Creado el' },
  emptyRecipients: {
    pt: 'Nenhum destinatário configurado para quote.created.',
    en: 'No recipients configured for quote.created.',
    es: 'No hay destinatarios configurados para quote.created.',
  },
  emptyDeliveries: {
    pt: 'Nenhuma entrega registrada.',
    en: 'No deliveries recorded.',
    es: 'No hay entregas registradas.',
  },
  templatePending: {
    pt: 'Código pronto. O template Meta ainda precisa de aprovação externa.',
    en: 'Code is ready. The Meta template still needs external approval.',
    es: 'El código está listo. La plantilla de Meta aún necesita aprobación externa.',
  },
  companyContextRequired: {
    pt: 'Selecione uma empresa para configurar notificações.',
    en: 'Select a company to configure notifications.',
    es: 'Seleccione una empresa para configurar notificaciones.',
  },
})

export const tNotifications = t
export const listNotificationsI18nEntries = list
