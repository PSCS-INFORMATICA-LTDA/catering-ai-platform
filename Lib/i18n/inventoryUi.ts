import { makeI18nModule } from './makeModule.ts'

const { t, list } = makeI18nModule('inventoryUi', 'ui', {
  title: { pt: 'Estoque', en: 'Inventory', es: 'Inventario' },
  subtitle: {
    pt: 'Saldos físicos por local. Ledger é a fonte de verdade — sem custo ou valuation nesta versão.',
    en: 'Physical balances by location. The ledger is the source of truth — no cost or valuation in this version.',
    es: 'Saldos físicos por local. El ledger es la fuente de verdad — sin costo ni valuación en esta versión.',
  },
  selectItem: {
    pt: 'Selecione um item.',
    en: 'Select an item.',
    es: 'Seleccione un ítem.',
  },
  postFailed: {
    pt: 'Falha no posting.',
    en: 'Posting failed.',
    es: 'Error al registrar el movimiento.',
  },
  createLocationFailed: {
    pt: 'Falha ao criar local.',
    en: 'Failed to create location.',
    es: 'Error al crear el local.',
  },
  rebuildFailed: {
    pt: 'Falha no rebuild.',
    en: 'Rebuild failed.',
    es: 'Error al reconstruir saldos.',
  },
  itemCategory: {
    pt: 'Item / categoria',
    en: 'Item / category',
    es: 'Ítem / categoría',
  },
  defaultSuffix: { pt: '(padrão)', en: '(default)', es: '(predeterminado)' },
  movementType: {
    pt: 'Tipo movimento',
    en: 'Movement type',
    es: 'Tipo de movimiento',
  },
  ensureDefaultLocation: {
    pt: 'Garantir local padrão',
    en: 'Ensure default location',
    es: 'Garantizar local predeterminado',
  },
  rebuildBalances: {
    pt: 'Rebuild saldos',
    en: 'Rebuild balances',
    es: 'Reconstruir saldos',
  },
  manualPost: {
    pt: 'Lançamento manual',
    en: 'Manual posting',
    es: 'Lanzamiento manual',
  },
  type: { pt: 'Tipo', en: 'Type', es: 'Tipo' },
  item: { pt: 'Item', en: 'Item', es: 'Ítem' },
  selectEllipsis: { pt: 'Selecione…', en: 'Select…', es: 'Seleccione…' },
  notesReason: {
    pt: 'Motivo / notas',
    en: 'Reason / notes',
    es: 'Motivo / notas',
  },
  notesRequiredAdjustment: {
    pt: 'Obrigatório para ajuste',
    en: 'Required for adjustment',
    es: 'Obligatorio para ajuste',
  },
  post: { pt: 'Postar', en: 'Post', es: 'Registrar' },
  balanceSummary: {
    pt: 'Resumo de saldo',
    en: 'Balance summary',
    es: 'Resumen de saldo',
  },
  colCategory: { pt: 'Categoria', en: 'Category', es: 'Categoría' },
  colUnit: { pt: 'Unidade', en: 'Unit', es: 'Unidad' },
  colLocation: { pt: 'Local', en: 'Location', es: 'Local' },
  colBalance: { pt: 'Saldo', en: 'Balance', es: 'Saldo' },
  colLastMovement: {
    pt: 'Último movimento',
    en: 'Last movement',
    es: 'Último movimiento',
  },
  emptyBalances: {
    pt: 'Nenhum saldo. Lance um saldo inicial ou rode o seed DEV.',
    en: 'No balances. Post an initial balance or run the DEV seed.',
    es: 'Ningún saldo. Registre un saldo inicial o ejecute el seed DEV.',
  },
  movements: { pt: 'Movimentos', en: 'Movements', es: 'Movimientos' },
  clearItemFilter: {
    pt: 'Limpar filtro item',
    en: 'Clear item filter',
    es: 'Limpiar filtro de ítem',
  },
  colQty: { pt: 'Qtd', en: 'Qty', es: 'Cant.' },
  colOriginOs: { pt: 'Origem / OS', en: 'Source / SO', es: 'Origen / OS' },
  colNotes: { pt: 'Notas', en: 'Notes', es: 'Notas' },
  emptyMovements: {
    pt: 'Sem movimentos para o filtro atual.',
    en: 'No movements for the current filter.',
    es: 'Sin movimientos para el filtro actual.',
  },
  typeInitialBalance: {
    pt: 'Saldo inicial',
    en: 'Initial balance',
    es: 'Saldo inicial',
  },
  typeEventDispatch: {
    pt: 'Saída OS',
    en: 'OS dispatch',
    es: 'Salida OS',
  },
  typeEventReturn: {
    pt: 'Retorno OS',
    en: 'OS return',
    es: 'Retorno OS',
  },
  typeEventLeftover: {
    pt: 'Sobra OS',
    en: 'OS leftover',
    es: 'Sobra OS',
  },
  typeAdjustmentIn: {
    pt: 'Ajuste entrada',
    en: 'Adjustment in',
    es: 'Ajuste entrada',
  },
  typeAdjustmentOut: {
    pt: 'Ajuste saída',
    en: 'Adjustment out',
    es: 'Ajuste salida',
  },
  bomTitle: {
    pt: 'Materiais operacionais (BOM)',
    en: 'Operational materials (BOM)',
    es: 'Materiales operativos (BOM)',
  },
  addMaterial: {
    pt: 'Adicionar material',
    en: 'Add material',
    es: 'Agregar material',
  },
  bomHint: {
    pt: 'Regras por empresa. Na conversão da cotação, viram snapshot na OS (não alteram ordens antigas).',
    en: 'Company rules. On quote conversion they become a snapshot on the service order (they do not change past orders).',
    es: 'Reglas por empresa. En la conversión del presupuesto se vuelven snapshot en la OS (no alteran órdenes antiguas).',
  },
  loadBomFailed: {
    pt: 'Falha ao carregar BOM',
    en: 'Failed to load BOM',
    es: 'Error al cargar BOM',
  },
  createFailed: {
    pt: 'Falha ao criar',
    en: 'Failed to create',
    es: 'Error al crear',
  },
  updateFailed: {
    pt: 'Falha ao atualizar',
    en: 'Failed to update',
    es: 'Error al actualizar',
  },
  material: { pt: 'Material', en: 'Material', es: 'Material' },
  method: { pt: 'Método', en: 'Method', es: 'Método' },
  rounding: { pt: 'Arredondamento', en: 'Rounding', es: 'Redondeo' },
  fixedQty: { pt: 'Qtd fixa', en: 'Fixed qty', es: 'Cant. fija' },
  qtyPerGuest: {
    pt: 'Qtd / convidado',
    en: 'Qty / guest',
    es: 'Cant. / invitado',
  },
  basis: { pt: 'Base', en: 'Basis', es: 'Base' },
  tiers: {
    pt: 'Faixas (1-30=1)',
    en: 'Tiers (1-30=1)',
    es: 'Rangos (1-30=1)',
  },
  saveRule: { pt: 'Salvar regra', en: 'Save rule', es: 'Guardar regla' },
  emptyBom: {
    pt: 'Nenhuma regra BOM neste item.',
    en: 'No BOM rules on this item.',
    es: 'Ninguna regla BOM en este ítem.',
  },
  methodFixed: {
    pt: 'fixo: {qty}',
    en: 'fixed: {qty}',
    es: 'fijo: {qty}',
  },
  methodTier: {
    pt: 'Faixa ({count} bandas)',
    en: 'Tier ({count} bands)',
    es: 'Rango ({count} bandas)',
  },
})

export const tInventoryUi = t
export const listInventoryUiI18nEntries = list

const MOVEMENT_TYPE_KEYS = {
  initial_balance: 'typeInitialBalance',
  event_dispatch: 'typeEventDispatch',
  event_return: 'typeEventReturn',
  event_leftover_return: 'typeEventLeftover',
  adjustment_in: 'typeAdjustmentIn',
  adjustment_out: 'typeAdjustmentOut',
} as const

export function inventoryMovementTypeLabel(
  locale: string | null | undefined,
  movementType: string,
): string {
  const key = MOVEMENT_TYPE_KEYS[movementType as keyof typeof MOVEMENT_TYPE_KEYS]
  return key ? t(locale, key) : movementType
}

export const INVENTORY_MOVEMENT_TYPE_KEYS = Object.keys(
  MOVEMENT_TYPE_KEYS,
) as Array<keyof typeof MOVEMENT_TYPE_KEYS>
