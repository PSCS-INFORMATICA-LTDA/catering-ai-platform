-- =============================================================================
-- Verified PayPal refund webhook reconciliation.
-- Service-role only: the HTTP route must verify the PayPal webhook signature
-- before calling this RPC. Supports refunds initiated by this app or directly
-- in the PayPal Sandbox dashboard without rewriting the original capture.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_verified_paypal_refund(
  p_company_id uuid,
  p_capture_id text,
  p_provider_refund_id text,
  p_amount numeric,
  p_currency text,
  p_event_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.invoice_payments%ROWTYPE;
  v_refund public.invoice_refunds%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_candidate_count integer := 0;
  v_payment_total numeric(12,2);
  v_refund_total numeric(12,2);
  v_net numeric(12,2);
  v_status text;
  v_cancellation_id uuid;
  v_cancellation_completed boolean := false;
  v_now timestamptz := now();
  v_duplicate boolean := false;
BEGIN
  IF length(trim(COALESCE(p_capture_id, ''))) < 3 THEN
    RAISE EXCEPTION 'paypal_capture_required';
  END IF;
  IF length(trim(COALESCE(p_provider_refund_id, ''))) < 3 THEN
    RAISE EXCEPTION 'refund_reference_required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_amount_invalid';
  END IF;
  IF length(trim(COALESCE(p_currency, ''))) <> 3 THEN
    RAISE EXCEPTION 'refund_currency_invalid';
  END IF;
  IF length(trim(COALESCE(p_event_id, ''))) < 3 THEN
    RAISE EXCEPTION 'paypal_event_id_required';
  END IF;

  SELECT * INTO v_payment
  FROM public.invoice_payments
  WHERE company_id = p_company_id
    AND provider = 'paypal'
    AND provider_capture_id = trim(p_capture_id)
    AND status = 'completed'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'paypal_capture_not_found'; END IF;

  IF upper(v_payment.currency_code) <> upper(trim(p_currency)) THEN
    RAISE EXCEPTION 'refund_currency_mismatch';
  END IF;

  SELECT * INTO v_refund
  FROM public.invoice_refunds
  WHERE company_id = p_company_id
    AND provider_refund_id = trim(p_provider_refund_id)
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_refund.payment_id <> v_payment.id OR v_refund.invoice_id <> v_payment.invoice_id THEN
      RAISE EXCEPTION 'refund_payment_mismatch';
    END IF;
    IF abs(v_refund.amount - round(p_amount * 100) / 100) > 0.009 THEN
      RAISE EXCEPTION 'refund_amount_mismatch';
    END IF;
    v_duplicate := v_refund.status = 'completed';
  ELSE
    SELECT count(*) INTO v_candidate_count
    FROM public.invoice_refunds
    WHERE company_id = p_company_id
      AND invoice_id = v_payment.invoice_id
      AND payment_id = v_payment.id
      AND status IN ('requested', 'processing', 'failed')
      AND upper(currency_code) = upper(trim(p_currency))
      AND abs(amount - round(p_amount * 100) / 100) <= 0.009;

    IF v_candidate_count > 1 THEN
      RAISE EXCEPTION 'refund_match_ambiguous';
    ELSIF v_candidate_count = 1 THEN
      SELECT * INTO v_refund
      FROM public.invoice_refunds
      WHERE company_id = p_company_id
        AND invoice_id = v_payment.invoice_id
        AND payment_id = v_payment.id
        AND status IN ('requested', 'processing', 'failed')
        AND upper(currency_code) = upper(trim(p_currency))
        AND abs(amount - round(p_amount * 100) / 100) <= 0.009
      LIMIT 1
      FOR UPDATE;
    ELSE
      INSERT INTO public.invoice_refunds(
        company_id, invoice_id, payment_id, amount, currency_code, status,
        reason, provider_refund_id, idempotency_key, requested_by, completed_by,
        requested_at, completed_at, metadata
      ) VALUES (
        p_company_id, v_payment.invoice_id, v_payment.id,
        round(p_amount * 100) / 100, upper(trim(p_currency)), 'completed',
        'Verified PayPal Sandbox refund webhook', trim(p_provider_refund_id),
        'paypal:webhook:' || trim(p_event_id), NULL, NULL,
        v_now, v_now,
        jsonb_build_object(
          'provider', 'paypal',
          'source', 'verified_webhook',
          'paypal_event_id', trim(p_event_id),
          'capture_id', trim(p_capture_id)
        )
      )
      RETURNING * INTO v_refund;
    END IF;
  END IF;

  IF v_refund.status <> 'completed' THEN
    UPDATE public.invoice_refunds
    SET status = 'completed',
        provider_refund_id = trim(p_provider_refund_id),
        completed_at = COALESCE(completed_at, v_now),
        updated_at = v_now,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'provider', 'paypal',
          'source', 'verified_webhook',
          'paypal_event_id', trim(p_event_id),
          'capture_id', trim(p_capture_id)
        )
    WHERE id = v_refund.id
    RETURNING * INTO v_refund;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_payment.invoice_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_payment_total
  FROM public.invoice_payments
  WHERE company_id = p_company_id
    AND invoice_id = v_payment.invoice_id
    AND status = 'completed';

  SELECT COALESCE(sum(amount), 0) INTO v_refund_total
  FROM public.invoice_refunds
  WHERE company_id = p_company_id
    AND invoice_id = v_payment.invoice_id
    AND status = 'completed';

  v_net := greatest(0, round((v_payment_total - v_refund_total) * 100) / 100);

  IF v_invoice.status = 'canceled' THEN
    v_status := 'canceled';
  ELSIF v_net + 0.009 >= v_invoice.total THEN
    v_status := 'paid';
  ELSIF v_net > 0 THEN
    v_status := 'partially_paid';
  ELSE
    v_status := CASE WHEN v_invoice.status = 'ready' THEN 'ready' ELSE 'awaiting_deposit' END;
  END IF;

  SELECT id INTO v_cancellation_id
  FROM public.invoice_cancellations
  WHERE company_id = p_company_id
    AND invoice_id = v_payment.invoice_id
    AND status = 'pending_refund'
  LIMIT 1
  FOR UPDATE;

  IF v_cancellation_id IS NOT NULL AND v_net <= 0 THEN
    UPDATE public.invoice_cancellations
    SET status = 'completed', completed_at = v_now, updated_at = v_now
    WHERE id = v_cancellation_id;
    v_status := 'canceled';
    v_cancellation_completed := true;
  END IF;

  UPDATE public.invoices
  SET paid_total = v_net,
      status = v_status,
      canceled_at = CASE
        WHEN v_status = 'canceled' THEN COALESCE(canceled_at, v_now)
        ELSE canceled_at
      END,
      updated_at = v_now
  WHERE id = v_payment.invoice_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'duplicate', v_duplicate,
    'refund_id', v_refund.id,
    'provider_refund_id', v_refund.provider_refund_id,
    'payment_id', v_payment.id,
    'invoice_id', v_payment.invoice_id,
    'amount', v_refund.amount,
    'currency_code', v_refund.currency_code,
    'paid_total', v_net,
    'invoice_status', v_status,
    'cancellation_completed', v_cancellation_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_verified_paypal_refund(uuid, text, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_paypal_refund(uuid, text, text, numeric, text, text)
  TO service_role;
