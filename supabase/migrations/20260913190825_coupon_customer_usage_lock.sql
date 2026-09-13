-- Atomic last barrier for coupon consumption.
-- Serializes reserve/apply for the same coupon (row lock) and the same
-- coupon+customer (advisory lock), then counts pending|applied uses before insert.
-- Same quote+coupon remains idempotent. Tenant scope is company_id on every lookup.
-- Execute granted to service_role only. Does not invent coupon_rules.

create or replace function public.reserve_quote_coupon_application(
  p_company_id uuid,
  p_quote_id uuid,
  p_coupon_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_coupon public.coupons%rowtype;
  v_quote public.quotes%rowtype;
  v_existing public.quote_coupon_applications%rowtype;
  v_inserted public.quote_coupon_applications%rowtype;
  v_customer_uses integer := 0;
  v_quote_uses integer := 0;
begin
  if p_company_id is null or p_quote_id is null or p_coupon_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_invalid_arguments';
  end if;

  select *
  into v_coupon
  from public.coupons
  where id = p_coupon_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_not_found';
  end if;

  select *
  into v_quote
  from public.quotes
  where id = p_quote_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'quote_not_found';
  end if;

  if v_quote.customer_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('coupon_customer_usage:' || p_coupon_id::text),
      pg_catalog.hashtext(v_quote.customer_id::text)
    );
  end if;

  select *
  into v_existing
  from public.quote_coupon_applications
  where quote_id = p_quote_id
    and coupon_id = p_coupon_id;

  if found then
    return pg_catalog.to_jsonb(v_existing);
  end if;

  select count(*)
  into v_quote_uses
  from public.quote_coupon_applications
  where quote_id = p_quote_id
    and company_id = p_company_id
    and approval_status in ('pending', 'applied');

  if v_coupon.max_uses_per_quote is not null
     and v_quote_uses >= v_coupon.max_uses_per_quote then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_usage_limit_reached';
  end if;

  if v_quote.customer_id is not null then
    if v_coupon.new_customer_only
       and exists (
         select 1
         from public.quotes q
         where q.company_id = p_company_id
           and q.customer_id = v_quote.customer_id
           and q.id <> p_quote_id
       ) then
      raise exception using
        errcode = 'P0001',
        message = 'coupon_new_customer_only';
    end if;

    select count(*)
    into v_customer_uses
    from public.quote_coupon_applications qca
    join public.quotes q on q.id = qca.quote_id
    where qca.coupon_id = p_coupon_id
      and qca.company_id = p_company_id
      and q.company_id = p_company_id
      and q.customer_id = v_quote.customer_id
      and qca.approval_status in ('pending', 'applied');

    if v_coupon.max_uses_per_customer is not null
       and v_customer_uses >= v_coupon.max_uses_per_customer then
      raise exception using
        errcode = 'P0001',
        message = 'coupon_usage_limit_reached';
    end if;
  end if;

  begin
    insert into public.quote_coupon_applications (
      company_id,
      quote_id,
      coupon_id,
      coupon_code_snapshot,
      campaign_name_snapshot,
      eligible_amount,
      potential_discount_amount,
      applied_discount_amount,
      approval_status,
      rules_snapshot,
      updated_at
    ) values (
      p_company_id,
      p_quote_id,
      p_coupon_id,
      coalesce(v_payload->>'coupon_code_snapshot', v_coupon.code),
      coalesce(v_payload->>'campaign_name_snapshot', v_coupon.campaign_name),
      coalesce((v_payload->>'eligible_amount')::numeric, 0),
      coalesce((v_payload->>'potential_discount_amount')::numeric, 0),
      coalesce((v_payload->>'applied_discount_amount')::numeric, 0),
      coalesce(v_payload->>'approval_status', 'applied'),
      coalesce(v_payload->'rules_snapshot', '{}'::jsonb),
      now()
    )
    returning * into v_inserted;
  exception
    when unique_violation then
      select *
      into v_existing
      from public.quote_coupon_applications
      where quote_id = p_quote_id
        and coupon_id = p_coupon_id;
      if found then
        return pg_catalog.to_jsonb(v_existing);
      end if;
      raise;
  end;

  return pg_catalog.to_jsonb(v_inserted);
end;
$$;

revoke all on function public.reserve_quote_coupon_application(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.reserve_quote_coupon_application(uuid, uuid, uuid, jsonb) from anon;
revoke all on function public.reserve_quote_coupon_application(uuid, uuid, uuid, jsonb) from authenticated;
grant execute on function public.reserve_quote_coupon_application(uuid, uuid, uuid, jsonb) to service_role;

comment on function public.reserve_quote_coupon_application(uuid, uuid, uuid, jsonb) is
  'Atomic coupon reserve/apply. Locks coupon + customer usage, enforces max_uses_per_customer/quote, same-quote idempotent. service_role only.';

notify pgrst, 'reload schema';
