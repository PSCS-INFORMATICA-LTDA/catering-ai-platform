alter table public.public_quote_intake_sessions
  add column if not exists coupon_code text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'public_quote_intake_sessions_coupon_code_format'
      and conrelid = 'public.public_quote_intake_sessions'::regclass
  ) then
    alter table public.public_quote_intake_sessions
      add constraint public_quote_intake_sessions_coupon_code_format
      check (
        coupon_code is null
        or (
          coupon_code = upper(coupon_code)
          and coupon_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
        )
      );
  end if;
end $$;

create index if not exists idx_quote_coupon_quote_company
  on public.quote_coupon_applications(quote_id, company_id);
