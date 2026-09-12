-- =============================================================================
-- Atomic Finance workflows.
-- Keeps the payment ledger, refund state, cancellation state and checkout/agenda
-- closure in a single database transaction per operation.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_document_sequences_branch_id
  ON public.inventory_document_sequences(branch_id);

-- ---------------------------------------------------------------------------
-- Manual Zelle / bank receipt confirmation + invoice ledger update.
-- Browser never supplies the amount: it is derived while the invoice is locked.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_manual_invoice_payment(
  p_company_id uuid,
  p_invoice_id uuid,
  p_provider text,
  p_purpose text,
  p_confirmation_reference text,
  p_confirmation_note text,
  p_actor_user_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_existing public.invoice_payments%ROWTYPE;
  v_payment public.invoice_payments%ROWTYPE;
  v_remaining numeric(12,2);
  v_amount numeric(12,2);
  v_payment_total numeric(12,2);
  v_refund_total numeric(12,2);
  v_net numeric(12,2);
  v_status text;
  v_now timestamptz := now();
BEGIN
  IF p_provider NOT IN ('zelle', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_manual_provider';
  END IF;
  IF p_purpose NOT IN ('deposit', 'balance', 'full') THEN
    RAISE EXCEPTION 'invalid_purpose';
  END IF;
  IF length(trim(COALESCE(p_confirmation_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'confirmation_reference_required';
  END IF;
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;
  IF length(trim(COALESCE(p_idempotency_key, ''))) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_invoice.status = 'canceled' THEN RAISE EXCEPTION 'invoice_canceled'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoice_cancellations
    WHERE company_id = p_company_id
      AND invoice_id = p_invoice_id
      AND status IN ('requested', 'pending_refund')
  ) THEN
    RAISE EXCEPTION 'invoice_cancellation_pending';
  END IF;

  SELECT * INTO v_existing
  FROM public.invoice_payments
  WHERE company_id = p_company_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'payment_id', v_existing.id,
      'amount', v_existing.amount,
      'invoice_id', v_invoice.id,
      'quote_id', v_invoice.quote_id,
      'invoice_status', v_invoice.status,
      'paid_total', v_invoice.paid_total,
      'deposit_amount', v_invoice.deposit_amount
    );
  END IF;

  v_remaining := greatest(0, round((v_invoice.total - v_invoice.paid_total) * 100) / 100);
  IF v_remaining <= 0 THEN RAISE EXCEPTION 'already_paid'; END IF;

  IF p_purpose = 'deposit' THEN
    v_amount := least(
      v_remaining,
      greatest(0, round((v_invoice.deposit_amount - v_invoice.paid_total) * 100) / 100)
    );
    IF v_amount <= 0 THEN RAISE EXCEPTION 'deposit_already_paid'; END IF;
  ELSE
    v_amount := v_remaining;
  END IF;

  INSERT INTO public.invoice_payments(
    company_id,
    invoice_id,
    provider,
    purpose,
    amount,
    currency_code,
    status,
    idempotency_key,
    confirmation_reference,
    confirmation_note,
    confirmed_by,
    confirmed_at,
    captured_at,
    metadata
  ) VALUES (
    p_company_id,
    p_invoice_id,
    p_provider,
    p_purpose,
    v_amount,
    v_invoice.currency_code,
    'completed',
    p_idempotency_key,
    trim(p_confirmation_reference),
    NULLIF(trim(COALESCE(p_confirmation_note, '')), ''),
    p_actor_user_id,
    v_now,
    v_now,
    jsonb_build_object(
      'manual_reconciliation', true,
      'evidence_type', 'external_reference'
    )
  )
  RETURNING * INTO v_payment;

  SELECT COALESCE(sum(amount), 0) INTO v_payment_total
  FROM public.invoice_payments
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

  SELECT COALESCE(sum(amount), 0) INTO v_refund_total
  FROM public.invoice_refunds
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

  v_net := greatest(0, round((v_payment_total - v_refund_total) * 100) / 100);
  IF v_net + 0.009 >= v_invoice.total THEN
    v_status := 'paid';
  ELSIF v_net > 0 THEN
    v_status := 'partially_paid';
  ELSE
    v_status := CASE WHEN v_invoice.status = 'ready' THEN 'ready' ELSE 'awaiting_deposit' END;
  END IF;

  UPDATE public.invoices
  SET paid_total = v_net,
      status = v_status,
      updated_at = v_now
  WHERE id = p_invoice_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'duplicate', false,
    'payment_id', v_payment.id,
    'amount', v_payment.amount,
    'invoice_id', v_invoice.id,
    'quote_id', v_invoice.quote_id,
    'invoice_status', v_status,
    'paid_total', v_net,
    'deposit_amount', v_invoice.deposit_amount
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.invoice_payments
    WHERE company_id = p_company_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'payment_id', v_existing.id,
        'amount', v_existing.amount,
        'invoice_id', p_invoice_id
      );
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_invoice_payment(uuid, uuid, text, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, uuid, text, text, text, text, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Refund completion + net ledger reconciliation + pending cancellation closure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_invoice_refund_transaction(
  p_company_id uuid,
  p_invoice_id uuid,
  p_refund_id uuid,
  p_provider_refund_id text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.invoice_refunds%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_payment_total numeric(12,2);
  v_refund_total numeric(12,2);
  v_net numeric(12,2);
  v_status text;
  v_cancellation_id uuid;
  v_cancellation_completed boolean := false;
  v_now timestamptz := now();
BEGIN
  IF length(trim(COALESCE(p_provider_refund_id, ''))) < 3 THEN
    RAISE EXCEPTION 'refund_reference_required';
  END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO v_refund
  FROM public.invoice_refunds
  WHERE id = p_refund_id
    AND invoice_id = p_invoice_id
    AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;

  IF v_refund.status = 'canceled' THEN RAISE EXCEPTION 'refund_canceled'; END IF;

  IF v_refund.status <> 'completed' THEN
    UPDATE public.invoice_refunds
    SET status = 'completed',
        provider_refund_id = trim(p_provider_refund_id),
        completed_by = p_actor_user_id,
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_refund_id
      AND invoice_id = p_invoice_id
      AND company_id = p_company_id;
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_payment_total
  FROM public.invoice_payments
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

  SELECT COALESCE(sum(amount), 0) INTO v_refund_total
  FROM public.invoice_refunds
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

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
    AND invoice_id = p_invoice_id
    AND status = 'pending_refund'
  FOR UPDATE
  LIMIT 1;

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
      canceled_at = CASE WHEN v_status = 'canceled' THEN COALESCE(canceled_at, v_now) ELSE canceled_at END,
      updated_at = v_now
  WHERE id = p_invoice_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'duplicate', v_refund.status = 'completed',
    'refund_id', p_refund_id,
    'invoice_id', p_invoice_id,
    'paid_total', v_net,
    'invoice_status', v_status,
    'cancellation_completed', v_cancellation_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_invoice_refund_transaction(uuid, uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_invoice_refund_transaction(uuid, uuid, uuid, text, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Cancellation request + payment-link closure + schedule-hold release + agenda
-- reservation release. A linked service order blocks this flow so operational
-- cancellation remains the owner once execution has begun.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_invoice_and_release_reservation(
  p_company_id uuid,
  p_invoice_id uuid,
  p_reason text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_existing public.invoice_cancellations%ROWTYPE;
  v_payment_total numeric(12,2);
  v_refund_total numeric(12,2);
  v_net numeric(12,2);
  v_status text;
  v_cancellation public.invoice_cancellations%ROWTYPE;
  v_agenda_count integer := 0;
  v_link_count integer := 0;
  v_hold_count integer := 0;
  v_now timestamptz := now();
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'cancellation_reason_required';
  END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;

  IF v_invoice.status = 'canceled' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'completed', 'requires_refund', false);
  END IF;

  SELECT * INTO v_existing
  FROM public.invoice_cancellations
  WHERE company_id = p_company_id
    AND invoice_id = p_invoice_id
    AND status IN ('requested', 'pending_refund')
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'cancellation_id', v_existing.id,
      'status', v_existing.status,
      'requires_refund', v_existing.status = 'pending_refund'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_events
    WHERE company_id = p_company_id
      AND quote_id = v_invoice.quote_id
      AND status <> 'cancelled'
      AND service_order_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service_order_cancellation_required';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_payment_total
  FROM public.invoice_payments
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

  SELECT COALESCE(sum(amount), 0) INTO v_refund_total
  FROM public.invoice_refunds
  WHERE company_id = p_company_id AND invoice_id = p_invoice_id AND status = 'completed';

  v_net := greatest(0, round((v_payment_total - v_refund_total) * 100) / 100);
  v_status := CASE WHEN v_net > 0 THEN 'pending_refund' ELSE 'completed' END;

  UPDATE public.invoice_payment_links
  SET revoked_at = COALESCE(revoked_at, v_now), updated_at = v_now
  WHERE company_id = p_company_id
    AND invoice_id = p_invoice_id
    AND revoked_at IS NULL;
  GET DIAGNOSTICS v_link_count = ROW_COUNT;

  UPDATE public.payment_schedule_holds
  SET status = 'released',
      released_at = COALESCE(released_at, v_now),
      release_reason = COALESCE(release_reason, 'invoice_cancellation_requested'),
      updated_at = v_now
  WHERE company_id = p_company_id
    AND invoice_id = p_invoice_id
    AND status = 'active';
  GET DIAGNOSTICS v_hold_count = ROW_COUNT;

  UPDATE public.agenda_events
  SET status = 'cancelled',
      cancelled_at = COALESCE(cancelled_at, v_now),
      cancelled_by = p_actor_user_id,
      updated_at = v_now,
      notes = CASE
        WHEN length(trim(COALESCE(notes, ''))) > 0
          THEN notes || E'\nCancelado: ' || trim(p_reason)
        ELSE 'Cancelado: ' || trim(p_reason)
      END
  WHERE company_id = p_company_id
    AND quote_id = v_invoice.quote_id
    AND status <> 'cancelled'
    AND service_order_id IS NULL;
  GET DIAGNOSTICS v_agenda_count = ROW_COUNT;

  INSERT INTO public.invoice_cancellations(
    company_id,
    invoice_id,
    quote_id,
    status,
    reason,
    requested_by,
    requested_at,
    agenda_released_at,
    completed_at,
    metadata
  ) VALUES (
    p_company_id,
    p_invoice_id,
    v_invoice.quote_id,
    v_status,
    trim(p_reason),
    p_actor_user_id,
    v_now,
    v_now,
    CASE WHEN v_status = 'completed' THEN v_now ELSE NULL END,
    jsonb_build_object(
      'agenda_rows_cancelled', v_agenda_count,
      'payment_links_revoked', v_link_count,
      'schedule_holds_released', v_hold_count
    )
  ) RETURNING * INTO v_cancellation;

  UPDATE public.invoices
  SET paid_total = v_net,
      status = CASE WHEN v_status = 'completed' THEN 'canceled' ELSE status END,
      canceled_at = CASE WHEN v_status = 'completed' THEN COALESCE(canceled_at, v_now) ELSE canceled_at END,
      updated_at = v_now
  WHERE id = p_invoice_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'duplicate', false,
    'cancellation_id', v_cancellation.id,
    'status', v_status,
    'requires_refund', v_net > 0,
    'paid_total', v_net,
    'agenda_rows_cancelled', v_agenda_count,
    'payment_links_revoked', v_link_count,
    'schedule_holds_released', v_hold_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_invoice_and_release_reservation(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_and_release_reservation(uuid, uuid, text, uuid)
  TO service_role;
