-- =============================================================================
-- Cotação → link público + aceite do cliente (padrão Logistics / LogRx)
-- Ambiente-alvo: DEV. Idempotente.
-- =============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS proposal_token TEXT,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_last_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_response TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS proposal_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_rejected_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_proposal_response_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_proposal_response_check
      CHECK (proposal_response IN ('pending', 'accepted', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_proposal_token
  ON public.quotes (proposal_token)
  WHERE proposal_token IS NOT NULL;

COMMENT ON COLUMN public.quotes.proposal_token IS
  'Token público para link de aceite da cotação (sem login).';
COMMENT ON COLUMN public.quotes.proposal_sent_at IS
  'Data/hora em que a cotação foi registrada como enviada ao cliente.';
COMMENT ON COLUMN public.quotes.proposal_response IS
  'Resposta do cliente: pending, accepted ou rejected.';

-- ---------------------------------------------------------------------------
-- Staff helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._assert_quote_member(p_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.quotes
  WHERE id = p_quote_id
    AND COALESCE(active, true) = true;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF NOT private.is_company_member(v_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta cotação';
  END IF;

  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_quote_proposal_token(p_quote_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  PERFORM public._assert_quote_member(p_quote_id);

  SELECT proposal_token INTO v_token
  FROM public.quotes
  WHERE id = p_quote_id;

  IF v_token IS NULL OR v_token = '' THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.quotes
    SET proposal_token = v_token
    WHERE id = p_quote_id;
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_quote_proposal_sent(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_sent_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_quote_member(p_quote_id);
  v_token := public.ensure_quote_proposal_token(p_quote_id);

  UPDATE public.quotes
  SET
    proposal_sent_at = COALESCE(proposal_sent_at, NOW()),
    quote_status = CASE
      WHEN proposal_response = 'accepted' THEN quote_status
      WHEN COALESCE(quote_status, '') IN ('approved', 'cancelled', 'canceled') THEN quote_status
      ELSE 'sent'
    END,
    proposal_response = CASE
      WHEN proposal_response = 'accepted' THEN proposal_response
      ELSE 'pending'
    END
  WHERE id = p_quote_id;

  SELECT proposal_sent_at INTO v_sent_at
  FROM public.quotes
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'proposal_sent_at', v_sent_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_quote_proposal_follow_up(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_quote_member(p_quote_id);

  UPDATE public.quotes
  SET
    proposal_last_follow_up_at = NOW(),
    proposal_follow_up_count = COALESCE(proposal_follow_up_count, 0) + 1
  WHERE id = p_quote_id
  RETURNING proposal_follow_up_count, proposal_last_follow_up_at
  INTO v_count, v_last_at;

  RETURN jsonb_build_object(
    'proposal_follow_up_count', v_count,
    'proposal_last_follow_up_at', v_last_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Público (anon) via token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_quote_proposal(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.quotes%ROWTYPE;
  v_company_name TEXT;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_customer_email TEXT;
  v_event_date DATE;
  v_event_name TEXT;
  v_package_label TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT q.*
  INTO v_row
  FROM public.quotes q
  WHERE q.proposal_token = p_token
    AND COALESCE(q.active, true) = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(c.trade_name, c.name)
  INTO v_company_name
  FROM public.companies c
  WHERE c.id = v_row.company_id;

  SELECT
    COALESCE(cu.full_name, cu.ab_name, cu.contact_name, cu.company_name),
    cu.phone,
    cu.email
  INTO v_customer_name, v_customer_phone, v_customer_email
  FROM public.customers cu
  WHERE cu.id = v_row.customer_id;

  SELECT e.event_date, e.event_name
  INTO v_event_date, v_event_name
  FROM public.events e
  WHERE e.id = v_row.event_id;

  SELECT COALESCE(p.label_pt, p.package_key)
  INTO v_package_label
  FROM public.packages p
  WHERE p.id = v_row.package_id;

  RETURN jsonb_build_object(
    'found', true,
    'company_name', v_company_name,
    'proposal_response', v_row.proposal_response,
    'proposal_sent_at', v_row.proposal_sent_at,
    'can_respond', (
      v_row.proposal_response = 'pending'
      AND v_row.proposal_sent_at IS NOT NULL
    ),
    'quote', jsonb_build_object(
      'id', v_row.id,
      'quote_number', v_row.quote_number,
      'quote_status', v_row.quote_status,
      'quote_total', v_row.quote_total,
      'reservation_amount', v_row.reservation_amount,
      'balance_due', v_row.balance_due,
      'currency_code', COALESCE(v_row.currency_code, 'USD'),
      'package_label', v_package_label,
      'adult_count', v_row.adult_count,
      'children_under_3_count', v_row.children_under_3_count,
      'children_4_to_12_count', v_row.children_4_to_12_count,
      'physical_guest_count', v_row.physical_guest_count,
      'billable_guest_count', v_row.billable_guest_count,
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_email', v_customer_email,
      'event_name', v_event_name,
      'event_date', v_event_date
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_quote_proposal(p_token TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.quotes%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO v_row
  FROM public.quotes
  WHERE proposal_token = p_token
    AND COALESCE(active, true) = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_row.proposal_sent_at IS NULL THEN
    RAISE EXCEPTION 'Proposta ainda não foi enviada ao cliente';
  END IF;

  IF v_row.proposal_response <> 'pending' THEN
    RAISE EXCEPTION 'Proposta já respondida';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.quotes
    SET
      proposal_response = 'accepted',
      proposal_accepted_at = NOW(),
      quote_status = 'approved'
    WHERE id = v_row.id;
  ELSE
    UPDATE public.quotes
    SET
      proposal_response = 'rejected',
      proposal_rejected_at = NOW(),
      quote_status = 'cancelled'
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', (SELECT proposal_response FROM public.quotes WHERE id = v_row.id),
    'quote_status', (SELECT quote_status FROM public.quotes WHERE id = v_row.id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_quote_proposal_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_quote_proposal_sent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_quote_proposal_follow_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_quote_proposal(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_quote_proposal(TEXT, TEXT) TO anon, authenticated;
