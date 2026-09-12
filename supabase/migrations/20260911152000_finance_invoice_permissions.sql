-- DEV finance hardening: invoice/payment reads require explicit finance permission.
-- Keep owner/admin/sales/finance aligned with the existing orders.financial.view audience.

insert into public.permissions (
  permission_key,
  label_pt,
  label_en,
  label_es,
  category_key,
  active
)
values (
  'finance.invoices.view',
  'Ver faturas financeiras',
  'View financial invoices',
  'Ver facturas financieras',
  'finance',
  true
)
on conflict (permission_key) do update
set
  label_pt = excluded.label_pt,
  label_en = excluded.label_en,
  label_es = excluded.label_es,
  category_key = excluded.category_key,
  active = excluded.active;

insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'finance.invoices.view'),
  ('admin', 'finance.invoices.view'),
  ('sales', 'finance.invoices.view'),
  ('finance', 'finance.invoices.view')
on conflict do nothing;

drop policy if exists invoices_select_member on public.invoices;
drop policy if exists invoices_select_finance on public.invoices;
create policy invoices_select_finance
on public.invoices
for select
to authenticated
using (private.has_permission(company_id, 'finance.invoices.view'));

drop policy if exists invoice_payments_select_member on public.invoice_payments;
drop policy if exists invoice_payments_select_finance on public.invoice_payments;
create policy invoice_payments_select_finance
on public.invoice_payments
for select
to authenticated
using (private.has_permission(company_id, 'finance.invoices.view'));

drop policy if exists invoice_payment_links_select_member on public.invoice_payment_links;
drop policy if exists invoice_payment_links_select_finance on public.invoice_payment_links;
create policy invoice_payment_links_select_finance
on public.invoice_payment_links
for select
to authenticated
using (private.has_permission(company_id, 'finance.invoices.view'));
