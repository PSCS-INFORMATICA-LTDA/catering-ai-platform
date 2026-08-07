import type { CommercialRuleRow } from '@/Lib/commercialRulesTableSchema'

export function getCommercialRuleCategory(ruleKey: string): string {
  const key = ruleKey.toLowerCase()
  if (key.startsWith('mileage_')) return 'Milhagem'
  if (key.startsWith('child') || key.includes('children')) return 'Crianças'
  if (key.includes('min_order') || key.includes('minimum_order')) return 'Pedido mínimo'
  if (key.startsWith('holiday_')) return 'Feriados'
  if (key.includes('policy')) return 'Políticas'
  if (key.includes('deposit') || key.includes('reservation')) return 'Reserva'
  if (key.includes('sides') || key.includes('garnish')) return 'Guarnições'
  return 'Geral'
}

export function groupCommercialRulesByCategory(rows: CommercialRuleRow[]) {
  const groups = new Map<string, CommercialRuleRow[]>()

  for (const row of rows) {
    const category = getCommercialRuleCategory(row.rule_key)
    const list = groups.get(category) ?? []
    list.push(row)
    groups.set(category, list)
  }

  const order = [
    'Reserva',
    'Milhagem',
    'Guarnições',
    'Crianças',
    'Pedido mínimo',
    'Feriados',
    'Políticas',
    'Geral',
  ]

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.rule_key.localeCompare(b.rule_key)),
    }))
}
