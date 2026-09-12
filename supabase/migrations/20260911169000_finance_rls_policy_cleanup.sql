-- =============================================================================
-- Finance RLS cleanup.
-- The legacy FOR ALL admin policies also participated in SELECT, causing a
-- second permissive SELECT policy beside finance.invoices.view. Split them into
-- explicit write commands so read authorization has one clear policy path.
-- =============================================================================

DROP POLICY IF EXISTS invoices_write_admin ON public.invoices;

CREATE POLICY invoices_insert_admin
ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (private.has_company_role(company_id, ARRAY['admin','owner']));

CREATE POLICY invoices_update_admin
ON public.invoices
FOR UPDATE TO authenticated
USING (private.has_company_role(company_id, ARRAY['admin','owner']))
WITH CHECK (private.has_company_role(company_id, ARRAY['admin','owner']));

CREATE POLICY invoices_delete_admin
ON public.invoices
FOR DELETE TO authenticated
USING (private.has_company_role(company_id, ARRAY['admin','owner']));

DROP POLICY IF EXISTS invoice_payment_links_write_admin ON public.invoice_payment_links;

CREATE POLICY invoice_payment_links_insert_admin
ON public.invoice_payment_links
FOR INSERT TO authenticated
WITH CHECK (private.has_company_role(company_id, ARRAY['admin','owner']));

CREATE POLICY invoice_payment_links_update_admin
ON public.invoice_payment_links
FOR UPDATE TO authenticated
USING (private.has_company_role(company_id, ARRAY['admin','owner']))
WITH CHECK (private.has_company_role(company_id, ARRAY['admin','owner']));

CREATE POLICY invoice_payment_links_delete_admin
ON public.invoice_payment_links
FOR DELETE TO authenticated
USING (private.has_company_role(company_id, ARRAY['admin','owner']));
