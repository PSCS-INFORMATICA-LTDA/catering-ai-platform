/**
 * Máquina de status da Ordem de Serviço (spec §F).
 *
 * planned → confirmed → preparing → team_assigned → ready → in_progress → completed
 * `cancelled` a partir de qualquer estado não terminal, com motivo obrigatório.
 */

export type ServiceOrderStatus =
  | 'planned'
  | 'confirmed'
  | 'preparing'
  | 'team_assigned'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export const SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = [
  'planned',
  'confirmed',
  'preparing',
  'team_assigned',
  'ready',
  'in_progress',
  'completed',
  'cancelled',
]

const FORWARD_FLOW: ServiceOrderStatus[] = [
  'planned',
  'confirmed',
  'preparing',
  'team_assigned',
  'ready',
  'in_progress',
  'completed',
]

const TERMINAL_STATUSES: ServiceOrderStatus[] = ['completed', 'cancelled']

function isKnownStatus(value: string | null | undefined): value is ServiceOrderStatus {
  return Boolean(value) && (SERVICE_ORDER_STATUSES as string[]).includes(value as string)
}

const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  planned: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'team_assigned', 'cancelled'],
  preparing: ['team_assigned', 'ready', 'cancelled'],
  team_assigned: ['ready', 'preparing', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function isValidServiceOrderTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isKnownStatus(from) || !isKnownStatus(to)) return false
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function isServiceOrderTerminal(status: string | null | undefined): boolean {
  return isKnownStatus(status) && TERMINAL_STATUSES.includes(status)
}

export function nextServiceOrderStatuses(
  status: string | null | undefined,
): ServiceOrderStatus[] {
  if (!isKnownStatus(status)) return []
  return ALLOWED_TRANSITIONS[status]
}

export function serviceOrderStatusRequiresReason(status: string | null | undefined): boolean {
  return status === 'cancelled'
}

export function serviceOrderStatusOrder(status: string | null | undefined): number {
  if (!isKnownStatus(status)) return -1
  const idx = FORWARD_FLOW.indexOf(status)
  return idx
}
