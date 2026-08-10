import { hasPermission } from '@/Lib/auth/permissions'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  buildMaterialDispatchWhatsAppText,
  buildPublicMaterialDispatchUrl,
  defaultMaterialDispatchExpiryIso,
  hashMaterialDispatchToken,
  newMaterialDispatchToken,
} from '@/Lib/orders/materialDispatchConfirmation'
import { resolveOrderTeamLeader } from '@/Lib/orders/resolveOrderTeamLeader'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireApiPermission('orders.materials.view')
  if (!auth.ok) return auth.response

  const { id: orderId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data: order } = await db
    .from('service_orders')
    .select('id')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!order) {
    return Response.json({ error: 'OS não encontrada.' }, { status: 404 })
  }

  const leader = await resolveOrderTeamLeader(companyId, orderId)

  const { data: confirmations } = await db
    .from('service_order_material_dispatch_confirmations')
    .select(
      'id, status, expires_at, confirmed_at, revoked_at, leader_person_id, team_id, created_at',
    )
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(10)

  return Response.json({
    data: {
      leader,
      confirmations: confirmations ?? [],
      active:
        (confirmations ?? []).find(
          (c) => c.status === 'pending' && !c.revoked_at,
        ) ?? null,
    },
  })
}

/** Gera (e revoga anterior) link de conferência de saída + WhatsApp. */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireApiPermission('orders.materials.dispatch')
  if (!auth.ok) return auth.response

  const { id: orderId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  let body: { revoke_only?: boolean } = {}
  try {
    body = (await request.json()) as { revoke_only?: boolean }
  } catch {
    body = {}
  }

  const { data: order } = await db
    .from('service_orders')
    .select(
      'id, service_order_number, event_date, start_time, end_time, venue_name, address_line, city, state',
    )
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!order) {
    return Response.json({ error: 'OS não encontrada.' }, { status: 404 })
  }

  const leader = await resolveOrderTeamLeader(companyId, orderId)
  if (leader.blockedReason) {
    const msg =
      leader.blockedReason === 'no_agenda'
        ? 'OS sem evento de agenda — não é possível gerar confirmação de saída.'
        : leader.blockedReason === 'no_team'
          ? 'Evento sem equipe designada — não é possível gerar confirmação de saída.'
          : 'Equipe sem líder — não é possível gerar confirmação de saída.'
    return Response.json({ error: msg, leader }, { status: 422 })
  }

  // Revoga tokens pending anteriores
  const now = new Date().toISOString()
  const { data: prior } = await db
    .from('service_order_material_dispatch_confirmations')
    .select('id')
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .eq('status', 'pending')
    .is('revoked_at', null)

  if (prior?.length) {
    await db
      .from('service_order_material_dispatch_confirmations')
      .update({ status: 'revoked', revoked_at: now, updated_at: now })
      .in(
        'id',
        prior.map((p) => p.id),
      )

    for (const p of prior) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'service_order_material_dispatch',
        entityId: p.id,
        action: 'dispatch_link_revoked',
        newData: { service_order_id: orderId },
      })
    }
  }

  if (body.revoke_only) {
    return Response.json({ data: { revoked: true, leader } })
  }

  const { data: materials } = await db
    .from('service_order_materials')
    .select('id, status, checked_at')
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .neq('status', 'cancelled')

  const ready = (materials ?? []).filter(
    (m) => m.checked_at && m.status !== 'divergence',
  )
  const divergences = (materials ?? []).filter((m) => m.status === 'divergence')

  if ((materials ?? []).length === 0) {
    return Response.json(
      { error: 'Nenhum material ativo para saída.' },
      { status: 400 },
    )
  }
  if (ready.length === 0 && divergences.length === 0) {
    return Response.json(
      { error: 'Materiais ainda não conferidos — conclua a conferência interna.' },
      { status: 400 },
    )
  }

  const token = newMaterialDispatchToken()
  const tokenHash = hashMaterialDispatchToken(token)
  const expiresAt = defaultMaterialDispatchExpiryIso(order.event_date)

  const { data: created, error } = await db
    .from('service_order_material_dispatch_confirmations')
    .insert({
      company_id: companyId,
      service_order_id: orderId,
      team_id: leader.teamId,
      leader_person_id: leader.leaderPersonId,
      status: 'pending',
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: auth.session.userId,
    })
    .select('id, status, expires_at, created_at')
    .single()

  if (error || !created) {
    return Response.json(
      { error: error?.message || 'Falha ao criar link.' },
      { status: 500 },
    )
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'service_order_material_dispatch',
    entityId: created.id,
    action: 'dispatch_link_created',
    newData: {
      service_order_id: orderId,
      leader_person_id: leader.leaderPersonId,
      expires_at: expiresAt,
      // sem token
    },
  })

  const { data: company } = await db
    .from('companies')
    .select('company_name, trade_name')
    .eq('id', companyId)
    .maybeSingle()

  const locale =
    leader.leaderLocale === 'en' ||
    leader.leaderLocale === 'es' ||
    leader.leaderLocale === 'pt'
      ? leader.leaderLocale
      : 'pt'
  const confirmUrl = buildPublicMaterialDispatchUrl(token, undefined, locale)
  const location = [order.address_line, order.city, order.state]
    .filter(Boolean)
    .join(', ')
  const whatsappText = buildMaterialDispatchWhatsAppText({
    companyName: company?.trade_name || company?.company_name,
    leaderName: leader.leaderName,
    eventDate: order.event_date || '—',
    startTime: order.start_time,
    endTime: order.end_time,
    eventLabel: order.service_order_number,
    location,
    teamName: leader.teamName,
    confirmUrl,
    locale,
  })

  const canViewToken =
    auth.session.isPlatformAdmin ||
    hasPermission(auth.session.permissions, 'orders.materials.dispatch')

  return Response.json({
    data: {
      confirmation: created,
      leader,
      confirm_url: canViewToken ? confirmUrl : null,
      whatsapp_text: whatsappText,
      phone: leader.leaderPhone,
      divergences_pending: divergences.length,
      expires_at: expiresAt,
    },
  })
}
