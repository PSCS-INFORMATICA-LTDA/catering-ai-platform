-- Fix: customers.ab_number must be text (AB000001), not integer.
-- Philippe QA (Nova cotação): invalid input syntax for type integer: "A0000003"
-- when creating a new customer before saving the quote.
-- Dependent view vw_customer_display must be dropped/recreated for the type change.

DROP VIEW IF EXISTS public.vw_customer_display;

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT c.data_type
    INTO v_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'customers'
    AND c.column_name = 'ab_number';

  IF v_type IS NULL THEN
    ALTER TABLE public.customers
      ADD COLUMN ab_number text;
  ELSIF v_type IN ('integer', 'bigint', 'smallint', 'numeric') THEN
    ALTER TABLE public.customers
      ALTER COLUMN ab_number TYPE text
      USING CASE
        WHEN ab_number IS NULL THEN NULL
        ELSE 'AB' || lpad(ab_number::text, 6, '0')
      END;
  ELSIF v_type <> 'text' THEN
    ALTER TABLE public.customers
      ALTER COLUMN ab_number TYPE text
      USING ab_number::text;
  END IF;
END $$;

COMMENT ON COLUMN public.customers.ab_number IS
  'Address-book number (text), e.g. AB000001 — never integer.';

CREATE UNIQUE INDEX IF NOT EXISTS customers_company_id_ab_number_unique
  ON public.customers (company_id, ab_number)
  WHERE ab_number IS NOT NULL AND btrim(ab_number) <> '';

CREATE OR REPLACE VIEW public.vw_customer_display AS
SELECT
  c.id,
  c.company_id,
  c.ab_number,
  c.ab_name,
  c.ab_type,
  c.phone,
  c.email,
  c.full_name,
  c.contact_name,
  c.company_name,
  c.address,
  c.address_line,
  c.city,
  c.state,
  c.postal_code,
  c.country,
  c.customer_type,
  c.address_book_role,
  c.active,
  c.created_at,
  c.updated_at,
  NULLIF(
    BTRIM(
      COALESCE(
        c.ab_name,
        c.full_name,
        c.contact_name,
        c.company_name,
        c.email,
        c.phone::text
      )
    ),
    ''
  ) AS customer_display_name
FROM public.customers c;

COMMENT ON VIEW public.vw_customer_display IS
  'Nome de exibição único por cliente. Ordem: ab_name, full_name, contact_name, company_name, email, phone.';

GRANT SELECT ON public.vw_customer_display TO authenticated;
GRANT SELECT ON public.vw_customer_display TO service_role;
GRANT SELECT ON public.vw_customer_display TO anon;
