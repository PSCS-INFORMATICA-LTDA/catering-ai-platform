import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('media', 'ui', {
  title: { pt: 'Mídia e Conteúdo', en: 'Media & Content', es: 'Medios y Contenido' },
  subtitle: {
    pt: 'Imagens, vídeos e conteúdo visual da empresa',
    en: 'Company images, videos and visual content',
    es: 'Imágenes, videos y contenido visual de la empresa',
  },
  tabHero: { pt: 'Página inicial', en: 'Home', es: 'Inicio' },
  tabHow: { pt: 'Como funciona', en: 'How it works', es: 'Cómo funciona' },
  tabVideos: { pt: 'Vídeos', en: 'Videos', es: 'Videos' },
  tabPackages: { pt: 'Pacotes', en: 'Packages', es: 'Paquetes' },
  tabAdditionals: { pt: 'Adicionais', en: 'Additionals', es: 'Adicionales' },
  previewMobile: { pt: 'Mobile', en: 'Mobile', es: 'Móvil' },
  previewTablet: { pt: 'Tablet', en: 'Tablet', es: 'Tablet' },
  previewDesktop: { pt: 'Desktop', en: 'Desktop', es: 'Escritorio' },
  statusActive: { pt: 'Ativo', en: 'Active', es: 'Activo' },
  statusInactive: { pt: 'Inativo', en: 'Inactive', es: 'Inactivo' },
  statusDraft: { pt: 'Rascunho', en: 'Draft', es: 'Borrador' },
  actionEdit: { pt: 'Editar', en: 'Edit', es: 'Editar' },
  actionPreview: { pt: 'Preview', en: 'Preview', es: 'Vista previa' },
  actionActivate: { pt: 'Ativar', en: 'Activate', es: 'Activar' },
  actionDeactivate: { pt: 'Desativar', en: 'Deactivate', es: 'Desactivar' },
  actionReplace: { pt: 'Substituir', en: 'Replace', es: 'Reemplazar' },
  actionDisable: { pt: 'Desativar', en: 'Disable', es: 'Desactivar' },
  actionAdd: { pt: 'Adicionar', en: 'Add', es: 'Añadir' },
  actionSave: { pt: 'Salvar', en: 'Save', es: 'Guardar' },
  empty: {
    pt: 'Nenhum item publicado ainda. O site público continua com o fallback atual.',
    en: 'Nothing published yet. The public site keeps the current fallback.',
    es: 'Aún no hay elementos publicados. El sitio público mantiene el fallback actual.',
  },
  forbidden: {
    pt: 'Você não tem permissão para gerenciar mídia.',
    en: 'You do not have permission to manage media.',
    es: 'No tienes permiso para gestionar medios.',
  },
  search: { pt: 'Pesquisar', en: 'Search', es: 'Buscar' },
  internalName: { pt: 'Nome interno', en: 'Internal name', es: 'Nombre interno' },
  order: { pt: 'Ordem', en: 'Order', es: 'Orden' },
  overlay: { pt: 'Texto sobre a foto', en: 'Text on photo', es: 'Texto sobre la foto' },
  howPhaseNote: {
    pt: 'Conteúdo preparado para a seção pública. A home ainda não renderiza estes blocos (Fase B).',
    en: 'Content prepared for the public section. The home page does not render these blocks yet (Phase B).',
    es: 'Contenido preparado para la sección pública. La home aún no renderiza estos bloques (Fase B).',
  },
  catalogMediaOnly: {
    pt: 'Somente imagem. Preço e regras comerciais não podem ser alterados aqui.',
    en: 'Images only. Price and commercial rules cannot be changed here.',
    es: 'Solo imagen. Precio y reglas comerciales no se cambian aquí.',
  },
  invalidFile: {
    pt: 'Arquivo inválido. Use JPEG, PNG, WebP ou MP4.',
    en: 'Invalid file. Use JPEG, PNG, WebP or MP4.',
    es: 'Archivo inválido. Use JPEG, PNG, WebP o MP4.',
  },
  fileTooLarge: {
    pt: 'Arquivo grande demais.',
    en: 'File is too large.',
    es: 'El archivo es demasiado grande.',
  },
})

export const tMedia = t
export const listMediaI18nEntries = list
