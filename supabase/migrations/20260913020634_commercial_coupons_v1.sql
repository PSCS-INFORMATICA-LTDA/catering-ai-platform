create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  campaign_name text not null,
  description text null,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  discount_type text not null check (discount_type in ('fixed','percent')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  max_discount_amount numeric(12,2) null check (max_discount_amount is null or max_discount_amount >= 0),
  min_eligible_amount numeric(12,2) not null default 0 check (min_eligible_amount >= 0),
  valid_from date null,
  valid_to date null,
  eligible_weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  all_packages boolean not null default true,
  eligible_package_ids uuid[] not null default '{}'::uuid[],
  include_additionals boolean not null default true,
  include_grill boolean not null default false,
  include_additional_cuts boolean not null default false,
  include_mileage boolean not null default false,
  new_customer_only boolean not null default false,
  max_uses_per_customer integer null check (max_uses_per_customer is null or max_uses_per_customer > 0),
  max_uses_per_quote integer not null default 1 check (max_uses_per_quote > 0),
  stackable boolean not null default false,
  apply_to_deposit boolean not null default false,
  apply_to_balance boolean not null default true,
  allow_post_event_adjustment boolean not null default false,
  manual_approval_required boolean not null default false,
  distribution_channel text null,
  minimum_final_mon_thu numeric(12,2) null check (minimum_final_mon_thu is null or minimum_final_mon_thu >= 0),
  minimum_final_fri_sun numeric(12,2) null check (minimum_final_fri_sun is null or minimum_final_fri_sun >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_format check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint coupons_validity_range check (valid_to is null or valid_from is null or valid_to >= valid_from),
  constraint coupons_percent_range check (discount_type <> 'percent' or discount_value <= 100),
  constraint coupons_weekdays_range check (eligible_weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

create unique index if not exists uq_coupons_company_code_upper
  on public.coupons(company_id, upper(code));
create index if not exists idx_coupons_company_status
  on public.coupons(company_id, status, valid_from, valid_to);

create table if not exists public.quote_coupon_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  coupon_code_snapshot text not null,
  campaign_name_snapshot text not null,
  eligible_amount numeric(12,2) not null default 0 check (eligible_amount >= 0),
  potential_discount_amount numeric(12,2) not null default 0 check (potential_discount_amount >= 0),
  applied_discount_amount numeric(12,2) not null default 0 check (applied_discount_amount >= 0),
  approval_status text not null default 'applied' check (approval_status in ('pending','applied','rejected','revoked')),
  rules_snapshot jsonb not null default '{}'::jsonb,
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_coupon_applications_quote_company_fk
    foreign key (quote_id, company_id) references public.quotes(id, company_id) on delete cascade,
  constraint quote_coupon_application_amounts
    check (applied_discount_amount <= potential_discount_amount)
);

create unique index if not exists uq_quote_coupon_once
  on public.quote_coupon_applications(quote_id, coupon_id);
create index if not exists idx_quote_coupon_company_quote
  on public.quote_coupon_applications(company_id, quote_id);
create index if not exists idx_quote_coupon_coupon_status
  on public.quote_coupon_applications(coupon_id, approval_status, created_at desc);

insert into public.permissions (permission_key,label_pt,label_en,label_es,category_key,active)
values
  ('commercial.coupons.view','Ver cupons','View coupons','Ver cupones','commercial',true),
  ('commercial.coupons.manage','Gerenciar cupons','Manage coupons','Gestionar cupones','commercial',true)
on conflict (permission_key) do update set
  label_pt=excluded.label_pt,
  label_en=excluded.label_en,
  label_es=excluded.label_es,
  category_key=excluded.category_key,
  active=excluded.active;

insert into public.role_permissions(role_key,permission_key)
values
  ('owner','commercial.coupons.view'),
  ('owner','commercial.coupons.manage'),
  ('admin','commercial.coupons.view'),
  ('admin','commercial.coupons.manage'),
  ('manager','commercial.coupons.view'),
  ('manager','commercial.coupons.manage'),
  ('sales','commercial.coupons.view')
on conflict do nothing;

alter table public.coupons enable row level security;
alter table public.quote_coupon_applications enable row level security;

drop policy if exists coupons_select_permission on public.coupons;
create policy coupons_select_permission on public.coupons
for select to authenticated
using (private.has_permission(company_id,'commercial.coupons.view'));

drop policy if exists coupons_insert_permission on public.coupons;
create policy coupons_insert_permission on public.coupons
for insert to authenticated
with check (private.has_permission(company_id,'commercial.coupons.manage'));

drop policy if exists coupons_update_permission on public.coupons;
create policy coupons_update_permission on public.coupons
for update to authenticated
using (private.has_permission(company_id,'commercial.coupons.manage'))
with check (private.has_permission(company_id,'commercial.coupons.manage'));

drop policy if exists coupons_delete_permission on public.coupons;
create policy coupons_delete_permission on public.coupons
for delete to authenticated
using (private.has_permission(company_id,'commercial.coupons.manage'));

drop policy if exists quote_coupon_select_permission on public.quote_coupon_applications;
create policy quote_coupon_select_permission on public.quote_coupon_applications
for select to authenticated
using (
  private.has_permission(company_id,'commercial.coupons.view')
  or private.has_permission(company_id,'quotes.view')
);

drop policy if exists quote_coupon_insert_permission on public.quote_coupon_applications;
create policy quote_coupon_insert_permission on public.quote_coupon_applications
for insert to authenticated
with check (
  private.has_permission(company_id,'commercial.coupons.manage')
  or private.has_permission(company_id,'quotes.manage')
);

drop policy if exists quote_coupon_update_permission on public.quote_coupon_applications;
create policy quote_coupon_update_permission on public.quote_coupon_applications
for update to authenticated
using (
  private.has_permission(company_id,'commercial.coupons.manage')
  or private.has_permission(company_id,'quotes.manage')
)
with check (
  private.has_permission(company_id,'commercial.coupons.manage')
  or private.has_permission(company_id,'quotes.manage')
);

grant select, insert, update, delete on public.coupons to authenticated;
grant select, insert, update on public.quote_coupon_applications to authenticated;
revoke all on public.coupons from anon;
revoke all on public.quote_coupon_applications from anon;
