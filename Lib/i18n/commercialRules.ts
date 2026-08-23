import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('commercialRules', 'ui', {
  title: {
    pt: 'Regras comerciais',
    en: 'Commercial rules',
    es: 'Reglas comerciales',
  },
  subtitle: {
    pt: 'Dashboard operacional · Catering AI',
    en: 'Operational dashboard · Catering AI',
    es: 'Panel operacional · Catering AI',
  },
  searchPlaceholder: {
    pt: 'rule_key, rótulo ou valor',
    en: 'rule_key, label or value',
    es: 'rule_key, etiqueta o valor',
  },
  fetchError: {
    pt: 'Não foi possível carregar regras.',
    en: 'Could not load rules.',
    es: 'No fue posible cargar las reglas.',
  },
  refreshError: {
    pt: 'Erro ao atualizar regras.',
    en: 'Failed to refresh rules.',
    es: 'Error al actualizar las reglas.',
  },
  saveError: {
    pt: 'Não foi possível salvar regra.',
    en: 'Could not save rule.',
    es: 'No fue posible guardar la regla.',
  },
  saveErrorGeneric: {
    pt: 'Erro ao salvar regra.',
    en: 'Failed to save rule.',
    es: 'Error al guardar la regla.',
  },
  seedError: {
    pt: 'Não foi possível criar regras padrão.',
    en: 'Could not create default rules.',
    es: 'No fue posible crear las reglas predeterminadas.',
  },
  seedErrorGeneric: {
    pt: 'Erro ao criar regras padrão.',
    en: 'Failed to create default rules.',
    es: 'Error al crear las reglas predeterminadas.',
  },
  deactivateConfirm: {
    pt: 'Inativar regra "{key}"?',
    en: 'Deactivate rule "{key}"?',
    es: '¿Desactivar la regla "{key}"?',
  },
  deactivateError: {
    pt: 'Não foi possível inativar regra.',
    en: 'Could not deactivate rule.',
    es: 'No fue posible desactivar la regla.',
  },
  seedButton: {
    pt: 'Criar regras padrão',
    en: 'Create default rules',
    es: 'Crear reglas predeterminadas',
  },
  newRule: { pt: 'Nova regra', en: 'New rule', es: 'Nueva regla' },
  tableMissing: {
    pt: 'Tabela {table} não encontrada. Execute {script} no Supabase. Valores atuais vêm do fallback em código.',
    en: 'Table {table} not found. Run {script} in Supabase. Current values come from the code fallback.',
    es: 'Tabla {table} no encontrada. Ejecute {script} en Supabase. Los valores actuales vienen del fallback en código.',
  },
  metricTotal: {
    pt: 'Total de regras',
    en: 'Total rules',
    es: 'Total de reglas',
  },
  metricActive: { pt: 'Ativas', en: 'Active', es: 'Activas' },
  metricInactive: { pt: 'Inativas', en: 'Inactive', es: 'Inactivas' },
  allCategories: {
    pt: 'Todas as categorias',
    en: 'All categories',
    es: 'Todas las categorías',
  },
  allTypes: { pt: 'Todos os tipos', en: 'All types', es: 'Todos los tipos' },
  rulesByCategory: {
    pt: 'Regras por categoria',
    en: 'Rules by category',
    es: 'Reglas por categoría',
  },
  rulesByCategorySubtitle: {
    pt: 'Cards expansíveis para leitura e manutenção',
    en: 'Expandable cards for reading and maintenance',
    es: 'Tarjetas expandibles para lectura y mantenimiento',
  },
  empty: {
    pt: 'Nenhuma regra encontrada.',
    en: 'No rules found.',
    es: 'Ninguna regla encontrada.',
  },
  sourceSupabase: { pt: 'Supabase', en: 'Supabase', es: 'Supabase' },
  sourceFallback: {
    pt: 'fallback em código',
    en: 'code fallback',
    es: 'fallback en código',
  },
  sourceMeta: {
    pt: 'Fonte: {source} · Reserva {reservation}% · Base {base}',
    en: 'Source: {source} · Reservation {reservation}% · Base {base}',
    es: 'Fuente: {source} · Reserva {reservation}% · Base {base}',
  },
  ruleSingular: { pt: 'regra', en: 'rule', es: 'regla' },
  rulesPlural: { pt: 'regras', en: 'rules', es: 'reglas' },
  rulesCount: {
    pt: '{count} {label}',
    en: '{count} {label}',
    es: '{count} {label}',
  },
})

export const tCommercialRules = t
export const listCommercialRulesI18nEntries = list
