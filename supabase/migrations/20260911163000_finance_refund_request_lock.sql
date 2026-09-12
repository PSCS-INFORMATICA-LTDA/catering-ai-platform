-- Serialize refund requests against the captured payment so concurrent requests
-- cannot each pass the refundable-balance check and over-reserve the capture.

CREATE OR REPLACE FUNCTION public.request_invoice_refund_transaction(
  p_company_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_actor_user_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.invoice_payments%ROWTYPE;
  v_existing public.invoice_refunds%ROWTYPE;
  v_refund public.invoice_refunds%ROWTYPE;
  v_reserved numeric(12,2);
  v_refundable numeric(12,2);
  v_amount numeric(12,2);
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'refund_reason_required';
  END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  IF length(trim(COALESCE(p_idempotency_key, ''))) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;

  SELECT * INTO v_existing
  FROM public.invoice_refunds
  WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'refund_id', v_existing.id,
      'amount', v_existing.amount,
      'status', v_existing.status
    );
  END IF;

  SELECT * INTO v_payment
  FROM public.invoice_payments
  WHERE id = p_payment_id
    AND invoice_id = p_invoice_id
    AND company_id = p_company_id
    AND status = 'completed'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_requires_completed_payment'; END IF;

  SELECT COALESCE(sum(amount), 0)
  INTO v_reserved
  FROM public.invoice_refunds
  WHERE payment_id = p_payment_id
    AND invoice_id = p_invoice_id
    AND company_id = p_company_id
    AND status IN ('requested', 'processing', 'completed');

  v_refundable := greatest(0, round((v_payment.amount - v_reserved) * 100) / 100);
  v_amount := CASE
    WHEN p_amount IS NULL THEN v_refundable
    ELSE round(p_amount * 100) / 100
  END;

  IF v_amount <= 0 OR v_amount > v_refundable + 0.009 THEN
    RAISE EXCEPTION 'refund_amount_exceeds_available';
  END IF;

  INSERT INTO public.invoice_refunds(
    company_id, invoice_id, payment_id, amount, currency_code, status,
    reason, idempotency_key, requested_by, metadata
  ) VALUES (
    p_company_id, p_invoice_id, p_payment_id, v_amount, v_payment.currency_code,
    'requested', trim(p_reason), p_idempotency_key, p_actor_user_id,
    jsonb_build_object('provider', v_payment.provider)
  )
  RETURNING * INTO v_refund;

  RETURN jsonb_build_object(
    'duplicate', false,
    'refund_id', v_refund.id,
    'amount', v_refund.amount,
    'currency_code', v_refund.currency_code,
    'status', v_refund.status,
    'refundable_after', greatest(0, v_refundable - v_amount)
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.invoice_refunds
    WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'refund_id', v_existing.id,
        'amount', v_existing.amount,
        'status', v_existing.status
      );
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.request_invoice_refund_transaction(uuid, uuid, uuid, numeric, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_invoice_refund_transaction(uuid, uuid, uuid, numeric, text, uuid, text)
  TO service_role;
