import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('companySettings', 'ui', {
  title: { pt: 'Empresa', en: 'Company', es: 'Empresa' },
  subtitle: {
    pt: 'Cadastro da empresa do tenant (como no Logistics). O nome e o logo aparecem no sistema e nas propostas — não use marca de terceiros.',
    en: 'Tenant company profile (same pattern as Logistics). Name and logo appear in the system and on proposals — do not use third-party brands.',
    es: 'Registro de la empresa del tenant (como en Logistics). El nombre y el logo aparecen en el sistema y en las propuestas — no use marca de terceros.',
  },
  loadError: {
    pt: 'Erro ao carregar empresa',
    en: 'Failed to load company',
    es: 'Error al cargar la empresa',
  },
  loadErrorHint: {
    pt: 'Aplique a migration DEV `20260804140000_company_profile_address_logo.sql` se as colunas de endereço ainda não existirem.',
    en: 'Apply the DEV migration `20260804140000_company_profile_address_logo.sql` if the address columns do not exist yet.',
    es: 'Aplique la migration DEV `20260804140000_company_profile_address_logo.sql` si las columnas de dirección aún no existen.',
  },
  saveFailed: {
    pt: 'Falha ao salvar',
    en: 'Failed to save',
    es: 'Error al guardar',
  },
  saved: {
    pt: 'Dados da empresa salvos.',
    en: 'Company details saved.',
    es: 'Datos de la empresa guardados.',
  },
  invalidCep: {
    pt: 'CEP inválido',
    en: 'Invalid postal code',
    es: 'Código postal inválido',
  },
  uploadFailed: {
    pt: 'Falha no upload',
    en: 'Upload failed',
    es: 'Error al subir',
  },
  logoUpdated: {
    pt: 'Logo atualizado. Ele pode aparecer nas propostas/cotações.',
    en: 'Logo updated. It may appear on proposals/quotes.',
    es: 'Logo actualizado. Puede aparecer en las propuestas/presupuestos.',
  },
  logoError: {
    pt: 'Erro no logo',
    en: 'Logo error',
    es: 'Error en el logo',
  },
  removeFailed: {
    pt: 'Falha ao remover',
    en: 'Failed to remove',
    es: 'Error al quitar',
  },
  logoRemoved: {
    pt: 'Logo removido.',
    en: 'Logo removed.',
    es: 'Logo quitado.',
  },
  registrationTitle: {
    pt: 'Dados cadastrais',
    en: 'Company details',
    es: 'Datos registrales',
  },
  saveData: { pt: 'Salvar dados', en: 'Save details', es: 'Guardar datos' },
  legalName: {
    pt: 'Razão social / legal name',
    en: 'Legal name',
    es: 'Razón social / legal name',
  },
  tradeName: {
    pt: 'Nome fantasia',
    en: 'Trade name',
    es: 'Nombre comercial',
  },
  displayName: {
    pt: 'Nome exibição (company_name)',
    en: 'Display name (company_name)',
    es: 'Nombre para mostrar (company_name)',
  },
  document: {
    pt: 'CNPJ / documento',
    en: 'Tax ID / document',
    es: 'CNPJ / documento',
  },
  stateRegistration: {
    pt: 'Inscrição estadual',
    en: 'State registration',
    es: 'Inscripción estadual',
  },
  billingEmail: {
    pt: 'E-mail financeiro',
    en: 'Billing email',
    es: 'Correo financiero',
  },
  website: { pt: 'Website', en: 'Website', es: 'Sitio web' },
  searchingCep: {
    pt: 'Buscando CEP…',
    en: 'Looking up postal code…',
    es: 'Buscando código postal…',
  },
  lookupCep: {
    pt: 'Buscar CEP',
    en: 'Look up postal code',
    es: 'Buscar código postal',
  },
  postalCode: { pt: 'CEP', en: 'ZIP / postal code', es: 'Código postal' },
  stateUf: { pt: 'UF', en: 'State', es: 'Estado' },
  street: { pt: 'Logradouro', en: 'Street', es: 'Calle' },
  number: { pt: 'Número', en: 'Number', es: 'Número' },
  complement: { pt: 'Complemento', en: 'Complement', es: 'Complemento' },
  neighborhood: { pt: 'Bairro', en: 'Neighborhood', es: 'Barrio' },
  fullAddress: {
    pt: 'Endereço completo',
    en: 'Full address',
    es: 'Dirección completa',
  },
  logoTitle: {
    pt: 'Logo da empresa',
    en: 'Company logo',
    es: 'Logo de la empresa',
  },
  logoHint: {
    pt: 'JPG, PNG ou WEBP · máx. 5 MB · aparece nas propostas (cotações).',
    en: 'JPG, PNG or WEBP · max 5 MB · appears on proposals (quotes).',
    es: 'JPG, PNG o WEBP · máx. 5 MB · aparece en las propuestas (presupuestos).',
  },
  logoAlt: {
    pt: 'Logo da empresa',
    en: 'Company logo',
    es: 'Logo de la empresa',
  },
  noLogo: {
    pt: 'Nenhum logo enviado.',
    en: 'No logo uploaded.',
    es: 'Ningún logo enviado.',
  },
  uploadLogo: { pt: 'Enviar logo', en: 'Upload logo', es: 'Subir logo' },
  removeLogo: { pt: 'Remover logo', en: 'Remove logo', es: 'Quitar logo' },
})

export const tCompanySettings = t
export const listCompanySettingsI18nEntries = list
