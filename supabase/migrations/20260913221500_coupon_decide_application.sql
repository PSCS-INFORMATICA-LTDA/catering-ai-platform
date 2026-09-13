-- Atomic admin approve/reject for a pending quote coupon application.
-- Locks the application (and the quote on approve), then writes
-- quote_coupon_applications + quotes + current quote_versions together.
-- Money math stays in the application server; this RPC applies the patch.
-- Execute granted to service_role only. Does not invent coupon_rules.
-- Does not alter reserve_quote_coupon_application.

create or replace function public.decide_quote_coupon_application(
  p_company_id uuid,
  p_application_id uuid,
  p_decision text,
  p_reviewed_by uuid,
  p_quote_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.quote_coupon_applications%rowtype;
  v_quote public.quotes%rowtype;
  v_now timestamptz := now();
  v_patch jsonb := coalesce(p_quote_patch, '{}'::jsonb);
  v_discount numeric(12,2);
begin
  if p_company_id is null
     or p_application_id is null
     or p_reviewed_by is null
     or p_decision not in ('approve', 'reject') then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_invalid_arguments';
  end if;

  select *
  into v_application
  from public.quote_coupon_applications
  where id = p_application_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_application_not_found';
  end if;

  if v_application.approval_status = 'applied' and p_decision = 'approve' then
    return jsonb_build_object(
      'ok', true,
      'status', 'applied',
      'idempotent', true
    );
  end if;

  if v_application.approval_status = 'rejected' and p_decision = 'reject' then
    return jsonb_build_object(
      'ok', true,
      'status', 'rejected',
      'idempotent', true
    );
  end if;

  if v_application.approval_status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_already_decided';
  end if;

  if p_decision = 'reject' then
    update public.quote_coupon_applications
    set
      approval_status = 'rejected',
      applied_discount_amount = 0,
      rejected_by = p_reviewed_by,
      rejected_at = v_now,
      updated_at = v_now
    where id = p_application_id
      and company_id = p_company_id
      and approval_status = 'pending';

    if not found then
      return jsonb_build_object(
        'ok', true,
        'status', 'rejected',
        'idempotent', true
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'rejected',
      'idempotent', false
    );
  end if;

  if v_patch->'pricing_breakdown' is null then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_invalid_arguments';
  end if;

  if exists (
    select 1
    from public.invoices
    where company_id = p_company_id
      and quote_id = v_application.quote_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_invoice_exists';
  end if;

  select *
  into v_quote
  from public.quotes
  where id = v_application.quote_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'quote_not_found';
  end if;

  v_discount := coalesce((v_patch->>'discount_amount')::numeric, 0);

  update public.quote_coupon_applications
  set
    approval_status = 'applied',
    applied_discount_amount = v_discount,
    approved_by = p_reviewed_by,
    approved_at = v_now,
    updated_at = v_now
  where id = p_application_id
    and company_id = p_company_id
    and approval_status = 'pending';

  if not found then
    return jsonb_build_object(
      'ok', true,
      'status', 'applied',
      'idempotent', true
    );
  end if;

  update public.quotes
  set
    discount = coalesce((v_patch->>'discount')::numeric, v_discount),
    discount_amount = v_discount,
    reservation_amount = coalesce((v_patch->>'reservation_amount')::numeric, 0),
    deposit_amount = coalesce((v_patch->>'deposit_amount')::numeric, 0),
    balance_due = coalesce((v_patch->>'balance_due')::numeric, 0),
    total_amount = coalesce((v_patch->>'total_amount')::numeric, 0),
    quote_total = coalesce((v_patch->>'quote_total')::numeric, 0),
    pricing_breakdown = v_patch->'pricing_breakdown'
  where id = v_application.quote_id
    and company_id = p_company_id;

  update public.quote_versions
  set
    discount_amount = v_discount,
    reservation_amount = coalesce((v_patch->>'reservation_amount')::numeric, 0),
    balance_due = coalesce((v_patch->>'balance_due')::numeric, 0),
    quote_total = coalesce((v_patch->>'quote_total')::numeric, 0),
    commercial_snapshot = coalesce(commercial_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'pricing_breakdown', v_patch->'pricing_breakdown',
        'coupon', coalesce(v_patch->'coupon_snapshot', '{}'::jsonb)
      )
  where quote_id = v_application.quote_id
    and company_id = p_company_id
    and is_current = true;

  return jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'idempotent', false,
    'total', coalesce((v_patch->>'quote_total')::numeric, 0),
    'deposit', coalesce((v_patch->>'deposit_amount')::numeric, 0),
    'balance', coalesce((v_patch->>'balance_due')::numeric, 0)
  );
end;
$$;

revoke all on function public.decide_quote_coupon_application(uuid, uuid, text, uuid, jsonb) from public;
revoke all on function public.decide_quote_coupon_application(uuid, uuid, text, uuid, jsonb) from anon;
revoke all on function public.decide_quote_coupon_application(uuid, uuid, text, uuid, jsonb) from authenticated;
grant execute on function public.decide_quote_coupon_application(uuid, uuid, text, uuid, jsonb) to service_role;

comment on function public.decide_quote_coupon_application(uuid, uuid, text, uuid, jsonb) is
  'Atomic coupon approve/reject. Locks application + quote, updates application/quote/current versions together. service_role only.';

notify pgrst, 'reload schema';
