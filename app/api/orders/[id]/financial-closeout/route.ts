import { hasPermission } from '@/Lib/auth/permissions'
import {
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import {
  finalizeEventFinancialCloseout,
  loadEventFinancialCloseout,
  saveEventFinancialCloseout,
  type EventCloseoutExtraServiceInput,
} from '@/Lib/payments/eventFinancialCloseout'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

const EXTRA_TYPES = new Set(['extra_service', 'overtime', 'equipment', 'damage', 'other'])

function canViewFinancial(session: Awaited<ReturnType<typeof requireApiAuth>> extends { ok: true; session: infer S } ? S : never) {
  return (
    session.isPlatformAdmin ||
    hasPermission(session.permissions, 'orders.financial.view') ||
    hasPermission(session.permissions, 'finance.invoices.view')
  )
}

function canManageCloseout(session: Awaited<ReturnType<typeof requireApiAuth>> extends { ok: true; session: infer S } ? S : never) {
  return session.isPlatformAdmin || hasPermission(session.permissions, 'finance.adjustments.manage')
}

function asGuestCount(value: unknown): number | null {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > 10000) return null
  return number
}

function parseExtraServices(value: unknown): EventCloseoutExtraServiceInput[] | null {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 50) return null
  const parsed: EventCloseoutExtraServiceInput[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Record<string, unknown>
    const lineType = typeof row.line_type === 'string' ? row.line_type : 'extra_service'
    const description = typeof row.description === 'string' ? row.description.trim() : ''
    const quantity = Number(row.quantity)
    const unitPrice = Number(row.unit_price)
    if (
      !EXTRA_TYPES.has(lineType) ||
      description.length < 3 ||
      description.length > 180 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 10000 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      unitPrice > 1000000
    ) {
      return null
    }
    parsed.push({
      line_type: lineType as EventCloseoutExtraServiceInput['line_type'],
      description,
      quantity: Math.round(quantity * 100) / 100,
      unit_price: Math.round(unitPrice * 100) / 100,
    })
  }
  return parsed
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response
  if (!canViewFinancial(auth.session)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const result = await loadEventFinancialCloseout(companyId, id)
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ data: result.data })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response
  if (!canManageCloseout(auth.session)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'invalid_payload' }, { status: 400 })

  const finalAdults = asGuestCount(body.finalAdults)
  const finalChildrenUnder3 = asGuestCount(body.finalChildrenUnder3)
  const finalChildren4To12 = asGuestCount(body.finalChildren4To12)
  const extraServices = parseExtraServices(body.extraServices)
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null

  if (
    finalAdults == null ||
    finalChildrenUnder3 == null ||
    finalChildren4To12 == null ||
    extraServices == null
  ) {
    return Response.json({ error: 'invalid_closeout_payload' }, { status: 400 })
  }

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const result = await saveEventFinancialCloseout({
    companyId,
    serviceOrderId: id,
    finalAdults,
    finalChildrenUnder3,
    finalChildren4To12,
    extraServices,
    notes,
    actorUserId: auth.session.userId,
  })
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })

  if (result.data.id) {
    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'event_financial_closeout',
      entityId: result.data.id,
      action: 'financial_closeout_saved',
      newData: {
        service_order_id: id,
        contracted_billable_guests: result.data.contracted.billable_guests,
        final_billable_guests: result.data.final.billable_guests,
        billable_guest_overage: result.data.billable_guest_overage,
        guest_overage_total: result.data.guest_overage_total,
        extra_services_total: result.data.extra_services_total,
        adjustment_total: result.data.adjustment_total,
      },
    })
  }

  return Response.json({ data: result.data })
}

export async function PATCH(_request: Request, { params }: Params) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response
  if (!canManageCloseout(auth.session)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const result = await finalizeEventFinancialCloseout({
    companyId,
    serviceOrderId: id,
    actorUserId: auth.session.userId,
  })
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })

  if (result.data.id) {
    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'event_financial_closeout',
      entityId: result.data.id,
      action: 'financial_closeout_finalized',
      newData: {
        service_order_id: id,
        status: result.data.status,
        adjustment_total: result.data.adjustment_total,
        supplemental_invoice_id: result.data.supplemental_invoice?.id ?? null,
        final_event_total: result.data.final_event_total,
      },
    })
  }

  return Response.json({ data: result.data })
}
