import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('customers', 'ui', {
  title: { pt: 'Pessoas', en: 'People', es: 'Personas' },
  subtitle: {
    pt: 'Cadastro único (Address Book): cliente, fornecedor e equipe — o que muda é a flag de papel.',
    en: 'Single Address Book: customer, supplier and team — only the role flag changes.',
    es: 'Registro único (Address Book): cliente, proveedor y equipo — solo cambia el rol.',
  },
  searchPlaceholder: {
    pt: 'Nome, telefone, e-mail ou AB number',
    en: 'Name, phone, email or AB number',
    es: 'Nombre, teléfono, correo o AB number',
  },
  newPerson: { pt: 'Nova pessoa', en: 'New person', es: 'Nueva persona' },
  editPerson: { pt: 'Editar cadastro', en: 'Edit record', es: 'Editar registro' },
  empty: { pt: 'Nenhuma pessoa encontrada.', en: 'No people found.', es: 'Ninguna persona encontrada.' },
  filterRole: { pt: 'Filtrar por papel', en: 'Filter by role', es: 'Filtrar por rol' },
  allRoles: { pt: 'Todos os papéis', en: 'All roles', es: 'Todos los roles' },
  customers: { pt: 'Clientes', en: 'Customers', es: 'Clientes' },
  suppliers: { pt: 'Fornecedores', en: 'Suppliers', es: 'Proveedores' },
  roles: { pt: 'Papéis', en: 'Roles', es: 'Roles' },
  multipleRoles: { pt: 'Múltiplos', en: 'Multiple', es: 'Múltiples' },
  fullName: { pt: 'Nome completo', en: 'Full name', es: 'Nombre completo' },
  contactName: { pt: 'Nome para contato', en: 'Contact name', es: 'Nombre de contacto' },
  phoneRequired: { pt: 'Telefone *', en: 'Phone *', es: 'Teléfono *' },
  rolesHint: {
    pt: 'Cadastro único: a mesma pessoa pode ser cliente, fornecedor e/ou contato de equipe.',
    en: 'Single record: the same person can be customer, supplier and/or team contact.',
    es: 'Registro único: la misma persona puede ser cliente, proveedor y/o contacto de equipo.',
  },
  deleteConfirm: {
    pt: 'Excluir cadastro de "{label}"?\n\nO cliente será desativado (soft delete).',
    en: 'Delete record "{label}"?\n\nThe person will be deactivated (soft delete).',
    es: '¿Eliminar el registro "{label}"?\n\nLa persona se desactivará (soft delete).',
  },
  cannotDeleteOpenQuotes: {
    pt: 'Não é possível excluir este cadastro porque existem {count} cotação(ões) em aberto vinculadas a ele.',
    en: 'Cannot delete this record because there are {count} open quote(s) linked to it.',
    es: 'No es posible eliminar este registro porque hay {count} presupuesto(s) abierto(s) vinculado(s).',
  },
  cannotDeleteOpenQuotesGeneric: {
    pt: 'Não é possível excluir este cadastro porque existem cotações em aberto vinculadas a ele.',
    en: 'Cannot delete this record because there are open quotes linked to it.',
    es: 'No es posible eliminar este registro porque hay presupuestos abiertos vinculados.',
  },
  saveError: {
    pt: 'Não foi possível salvar cadastro.',
    en: 'Could not save the record.',
    es: 'No fue posible guardar el registro.',
  },
  refreshError: {
    pt: 'Erro ao atualizar clientes.',
    en: 'Failed to refresh people.',
    es: 'Error al actualizar personas.',
  },
  loadError: {
    pt: 'Erro ao carregar pessoas.',
    en: 'Failed to load people.',
    es: 'Error al cargar personas.',
  },
})

export const tCustomers = t
export const listCustomersI18nEntries = list
