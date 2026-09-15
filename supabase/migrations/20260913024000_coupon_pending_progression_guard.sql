create or replace function private.assert_no_pending_coupon_for_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quote_id is not null and exists (
    select 1
    from public.quote_coupon_applications qca
    where qca.company_id = new.company_id
      and qca.quote_id = new.quote_id
      and qca.approval_status = 'pending'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coupon_approval_pending';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_pending_coupon_guard on public.invoices;
create trigger invoices_pending_coupon_guard
before insert on public.invoices
for each row
execute function private.assert_no_pending_coupon_for_quote();

drop trigger if exists service_orders_pending_coupon_guard on public.service_orders;
create trigger service_orders_pending_coupon_guard
before insert on public.service_orders
for each row
execute function private.assert_no_pending_coupon_for_quote();
