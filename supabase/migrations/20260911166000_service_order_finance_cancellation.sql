-- =============================================================================
-- Service Order cancellation -> agenda + invoice cancellation coordination.
-- Does not move money. If net money was received, the invoice cancellation is
-- left pending_refund for an authorized finance user to execute/confirm refund.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_service_order_with_finance(
  p_company_id uuid,
  p_service_order_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_cancellation public.invoice_cancellations%ROWTYPE;
  v_payment_total numeric(12,2) := 0;
  v_refund_total numeric(12,2) := 0;
  v_net numeric(12,2) := 0;
  v_finance_status text := NULL;
  v_agenda_count integer := 0;
  v_link_count integer := 0;
  v_hold_count integer := 0;
  v_now timestamptz := now();
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'cancellation_reason_required';
  END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = p_service_order_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_order_not_found'; END IF;

  IF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'service_order_terminal';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'service_order_id', v_order.id,
      'service_order_status', v_order.status,
      'quote_id', v_order.quote_id
    );
  END IF;

  UPDATE public.service_orders
  SET status = 'cancelled',
      cancel_reason = trim(p_reason),
      cancelled_at = COALESCE(cancelled_at, v_now),
      notes = CASE WHEN p_notes IS NULL THEN notes ELSE p_notes END,
      updated_at = v_now
  WHERE id = v_order.id AND company_id = p_company_id;

  UPDATE public.agenda_events
  SET status = 'cancelled',
      cancelled_at = COALESCE(cancelled_at, v_now),
      cancelled_by = p_actor_user_id,
      updated_at = v_now,
      notes = CASE
        WHEN length(trim(COALESCE(notes, ''))) > 0
          THEN notes || E'\nCancelado com OS: ' || trim(p_reason)
        ELSE 'Cancelado com OS: ' || trim(p_reason)
      END
  WHERE company_id = p_company_id
    AND service_order_id = v_order.id
    AND status <> 'cancelled';
  GET DIAGNOSTICS v_agenda_count = ROW_COUNT;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE company_id = p_company_id
    AND quote_id = v_order.quote_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.invoice_payment_links
    SET revoked_at = COALESCE(revoked_at, v_now), updated_at = v_now
    WHERE company_id = p_company_id
      AND invoice_id = v_invoice.id
      AND revoked_at IS NULL;
    GET DIAGNOSTICS v_link_count = ROW_COUNT;

    UPDATE public.payment_schedule_holds
    SET status = 'released',
        released_at = COALESCE(released_at, v_now),
        release_reason = COALESCE(release_reason, 'service_order_cancelled'),
        updated_at = v_now
    WHERE company_id = p_company_id
      AND invoice_id = v_invoice.id
      AND status = 'active';
    GET DIAGNOSTICS v_hold_count = ROW_COUNT;

    SELECT COALESCE(sum(amount), 0) INTO v_payment_total
    FROM public.invoice_payments
    WHERE company_id = p_company_id
      AND invoice_id = v_invoice.id
      AND status = 'completed';

    SELECT COALESCE(sum(amount), 0) INTO v_refund_total
    FROM public.invoice_refunds
    WHERE company_id = p_company_id
      AND invoice_id = v_invoice.id
      AND status = 'completed';

    v_net := greatest(0, round((v_payment_total - v_refund_total) * 100) / 100);
    v_finance_status := CASE WHEN v_net > 0 THEN 'pending_refund' ELSE 'completed' END;

    SELECT * INTO v_cancellation
    FROM public.invoice_cancellations
    WHERE company_id = p_company_id
      AND invoice_id = v_invoice.id
      AND status IN ('requested', 'pending_refund')
    ORDER BY requested_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.invoice_cancellations
      SET status = v_finance_status,
          reason = trim(p_reason),
          completed_at = CASE WHEN v_finance_status = 'completed' THEN COALESCE(completed_at, v_now) ELSE NULL END,
          agenda_released_at = COALESCE(agenda_released_at, v_now),
          updated_at = v_now,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'source', 'service_order_cancellation',
            'service_order_id', v_order.id
          )
      WHERE id = v_cancellation.id
      RETURNING * INTO v_cancellation;
    ELSE
      INSERT INTO public.invoice_cancellations(
        company_id, invoice_id, quote_id, status, reason, requested_by,
        requested_at, agenda_released_at, completed_at, metadata
      ) VALUES (
        p_company_id, v_invoice.id, v_invoice.quote_id, v_finance_status,
        trim(p_reason), p_actor_user_id, v_now, v_now,
        CASE WHEN v_finance_status = 'completed' THEN v_now ELSE NULL END,
        jsonb_build_object(
          'source', 'service_order_cancellation',
          'service_order_id', v_order.id
        )
      ) RETURNING * INTO v_cancellation;
    END IF;

    IF v_finance_status = 'completed' THEN
      UPDATE public.invoices
      SET status = 'canceled',
          canceled_at = COALESCE(canceled_at, v_now),
          updated_at = v_now
      WHERE id = v_invoice.id AND company_id = p_company_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'service_order_id', v_order.id,
    'service_order_status', 'cancelled',
    'quote_id', v_order.quote_id,
    'invoice_id', CASE WHEN v_invoice.id IS NULL THEN NULL ELSE v_invoice.id END,
    'invoice_cancellation_id', CASE WHEN v_cancellation.id IS NULL THEN NULL ELSE v_cancellation.id END,
    'finance_status', v_finance_status,
    'requires_refund', COALESCE(v_net > 0, false),
    'net_received', v_net,
    'agenda_rows_cancelled', v_agenda_count,
    'payment_links_revoked', v_link_count,
    'schedule_holds_released', v_hold_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_service_order_with_finance(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_finance(uuid, uuid, text, uuid, text)
  TO service_role;
