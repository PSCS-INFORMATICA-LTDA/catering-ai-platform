-- =============================================================================
-- Confirmação pública do pedido de guarnição ao fornecedor (padrão designação)
-- Ambiente-alvo: DEV. Idempotente.
-- =============================================================================

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS supplier_garnish_token text,
  ADD COLUMN IF NOT EXISTS supplier_garnish_response text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS supplier_garnish_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_garnish_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_customer_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_garnish_pickup_time time without time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_orders_supplier_garnish_response_check'
  ) THEN
    ALTER TABLE public.service_orders
      ADD CONSTRAINT service_orders_supplier_garnish_response_check
      CHECK (supplier_garnish_response IN ('pending', 'confirmed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_orders_supplier_customer_id_fkey'
  ) THEN
    ALTER TABLE public.service_orders
      ADD CONSTRAINT service_orders_supplier_customer_id_fkey
      FOREIGN KEY (supplier_customer_id)
      REFERENCES public.customers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_supplier_garnish_token
  ON public.service_orders (supplier_garnish_token)
  WHERE supplier_garnish_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_supplier_customer
  ON public.service_orders (supplier_customer_id)
  WHERE supplier_customer_id IS NOT NULL;

COMMENT ON COLUMN public.service_orders.supplier_garnish_token IS
  'Token público para o fornecedor confirmar recebimento do pedido de guarnição.';
COMMENT ON COLUMN public.service_orders.supplier_garnish_response IS
  'pending | confirmed';

CREATE OR REPLACE FUNCTION public.get_public_supplier_garnish(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os public.service_orders%ROWTYPE;
  v_company_name TEXT;
  v_supplier_name TEXT;
  v_team_name TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT o.*
  INTO v_os
  FROM public.service_orders o
  WHERE o.supplier_garnish_token = trim(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(c.trade_name, c.name)
  INTO v_company_name
  FROM public.companies c
  WHERE c.id = v_os.company_id;

  IF v_os.supplier_customer_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(cu.ab_name), ''), NULLIF(trim(cu.full_name), ''))
    INTO v_supplier_name
    FROM public.customers cu
    WHERE cu.id = v_os.supplier_customer_id;
  END IF;

  SELECT t.name
  INTO v_team_name
  FROM public.agenda_events ae
  JOIN public.operational_teams t ON t.id = ae.team_id
  WHERE ae.service_order_id = v_os.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'company_name', v_company_name,
    'supplier_garnish_response', v_os.supplier_garnish_response,
    'supplier_garnish_sent_at', v_os.supplier_garnish_sent_at,
    'can_respond', (
      v_os.supplier_garnish_response = 'pending'
      AND v_os.supplier_garnish_sent_at IS NOT NULL
      AND v_os.status <> 'cancelled'
    ),
    'order', jsonb_build_object(
      'service_order_id', v_os.id,
      'service_order_number', v_os.service_order_number,
      'event_date', v_os.event_date,
      'start_time', v_os.start_time,
      'end_time', v_os.end_time,
      'pickup_time', v_os.supplier_garnish_pickup_time,
      'address', NULLIF(
        trim(
          concat_ws(
            ', ',
            NULLIF(trim(COALESCE(v_os.address_line, '')), ''),
            NULLIF(trim(COALESCE(v_os.city, '')), ''),
            NULLIF(trim(COALESCE(v_os.state, '')), '')
          )
        ),
        ''
      ),
      'team_name', v_team_name,
      'supplier_name', v_supplier_name,
      'guest_count', v_os.billable_guest_count,
      'status', v_os.status
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_supplier_garnish(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os public.service_orders%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  SELECT * INTO v_os
  FROM public.service_orders
  WHERE supplier_garnish_token = trim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_os.supplier_garnish_sent_at IS NULL THEN
    RAISE EXCEPTION 'Pedido ainda não foi enviado ao fornecedor';
  END IF;

  IF v_os.supplier_garnish_response <> 'pending' THEN
    RAISE EXCEPTION 'Pedido já confirmado';
  END IF;

  IF v_os.status = 'cancelled' THEN
    RAISE EXCEPTION 'Ordem de serviço cancelada';
  END IF;

  UPDATE public.service_orders
  SET
    supplier_garnish_response = 'confirmed',
    supplier_garnish_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_os.id;

  RETURN jsonb_build_object(
    'supplier_garnish_response', 'confirmed',
    'supplier_garnish_confirmed_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_supplier_garnish(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_garnish(TEXT) TO anon, authenticated;
