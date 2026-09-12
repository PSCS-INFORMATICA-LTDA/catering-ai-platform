-- PayPal Sandbox Checkout V2 — configurable concurrent event capacity
-- Target: Catering AI DEV ONLY (yasprgtlqclwsjcshtls). Never apply to PROD.
-- Incremental migration: the preceding schedule-hold migration is already applied.

-- Provisional CDL DEV baseline requested by Philippe. Caio remains the owner of
-- the definitive operating capacity decision. Other companies fail closed at 1.
UPDATE public.commercial_rules cr
SET rule_value = jsonb_set(
      cr.rule_value,
      '{value}',
      to_jsonb(
        (
          CASE
            WHEN cr.rule_value ? 'value'
              THEN (cr.rule_value->>'value')::jsonb
            ELSE cr.rule_value
          END
          || jsonb_build_object('max_concurrent_events', 3)
        )::text
      ),
      true
    ),
    updated_at = now()
WHERE cr.active = true
  AND cr.rule_key = 'schedule_turnaround_buffer'
  AND cr.company_id = (
    SELECT c.id FROM public.companies c WHERE c.company_code = 'CDL' LIMIT 1
  );

CREATE OR REPLACE FUNCTION private.payment_schedule_policy(p_company_id uuid)
RETURNS TABLE(min_gap_minutes integer, max_concurrent_events integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule_value jsonb;
  v_rule_config jsonb;
  v_gap integer := 0;
  v_capacity integer := 1;
BEGIN
  SELECT cr.rule_value
    INTO v_rule_value
  FROM public.commercial_rules cr
  WHERE cr.company_id = p_company_id
    AND cr.rule_key = 'schedule_turnaround_buffer'
    AND cr.active = true
  LIMIT 1;

  IF v_rule_value IS NOT NULL THEN
    BEGIN
      IF v_rule_value ? 'value' THEN
        v_rule_config := (v_rule_value->>'value')::jsonb;
      ELSE
        v_rule_config := v_rule_value;
      END IF;

      IF COALESCE((v_rule_config->>'enabled')::boolean, true) THEN
        v_gap := GREATEST(
          0,
          LEAST(1440, COALESCE((v_rule_config->>'min_gap_minutes')::integer, 0))
        );
      END IF;

      v_capacity := GREATEST(
        1,
        LEAST(20, COALESCE((v_rule_config->>'max_concurrent_events')::integer, 1))
      );
    EXCEPTION WHEN OTHERS THEN
      v_gap := 0;
      v_capacity := 1;
    END;
  END IF;

  RETURN QUERY SELECT v_gap, v_capacity;
END;
$$;

REVOKE ALL ON FUNCTION private.payment_schedule_policy(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.payment_schedule_policy(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_payment_schedule_hold(
  p_company_id uuid,
  p_invoice_id uuid,
  p_payment_link_id uuid DEFAULT NULL,
  p_hold_seconds integer DEFAULT 900
)
RETURNS TABLE(
  hold_id uuid,
  hold_expires_at timestamptz,
  hold_status text,
  min_gap_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote_id uuid;
  v_event_id uuid;
  v_invoice_status text;
  v_quote_status text;
  v_proposal_response text;
  v_reservation_confirmed_at timestamptz;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_snapshot jsonb;
  v_snapshot_date text;
  v_snapshot_start text;
  v_snapshot_end text;
  v_gap integer := 0;
  v_capacity integer := 1;
  v_used integer := 0;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_hold_id uuid;
  v_existing_expires timestamptz;
  v_existing_gap integer;
  v_candidate_start timestamp;
  v_candidate_end timestamp;
BEGIN
  IF p_hold_seconds < 300 OR p_hold_seconds > 1800 THEN
    RAISE EXCEPTION 'schedule_hold_duration_invalid' USING ERRCODE = 'P0001';
  END IF;

  -- All capacity-changing operations use the same company-scoped lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 271828)
  );

  SELECT
    i.quote_id, i.status, i.snapshot, q.event_id, q.quote_status,
    q.proposal_response, q.reservation_confirmed_at,
    e.event_date, e.start_time, e.end_time
  INTO
    v_quote_id, v_invoice_status, v_snapshot, v_event_id, v_quote_status,
    v_proposal_response, v_reservation_confirmed_at,
    v_event_date, v_start_time, v_end_time
  FROM public.invoices i
  JOIN public.quotes q
    ON q.id = i.quote_id AND q.company_id = i.company_id AND q.active = true
  JOIN public.events e
    ON e.id = q.event_id AND e.company_id = i.company_id AND e.active = true
  WHERE i.id = p_invoice_id
    AND i.company_id = p_company_id
  FOR UPDATE OF i, q, e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'schedule_context_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_invoice_status IN ('paid', 'canceled') THEN
    RAISE EXCEPTION 'invoice_not_payable' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (v_proposal_response = 'accepted' OR v_quote_status IN ('approved', 'accepted')) THEN
    RAISE EXCEPTION 'quote_not_accepted' USING ERRCODE = 'P0001';
  END IF;
  IF v_reservation_confirmed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::timestamptz, 'already_reserved'::text, 0;
    RETURN;
  END IF;
  IF v_event_date IS NULL OR v_start_time IS NULL OR v_end_time IS NULL
     OR v_end_time <= v_start_time THEN
    RAISE EXCEPTION 'schedule_details_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_snapshot_date := v_snapshot #>> '{event,date}';
  v_snapshot_start := v_snapshot #>> '{event,startTime}';
  v_snapshot_end := v_snapshot #>> '{event,endTime}';
  IF v_snapshot_date IS NULL OR v_snapshot_start IS NULL OR v_snapshot_end IS NULL THEN
    RAISE EXCEPTION 'schedule_snapshot_missing' USING ERRCODE = 'P0001';
  END IF;
  IF v_snapshot_date <> v_event_date::text
     OR v_snapshot_start::time <> v_start_time
     OR v_snapshot_end::time <> v_end_time THEN
    RAISE EXCEPTION 'schedule_snapshot_mismatch' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.min_gap_minutes, p.max_concurrent_events
    INTO v_gap, v_capacity
  FROM private.payment_schedule_policy(p_company_id) p;

  UPDATE public.payment_schedule_holds
     SET status = 'expired', updated_at = v_now
   WHERE company_id = p_company_id
     AND status = 'active'
     AND expires_at <= v_now;

  -- Repeated clicks reuse the same hold and never consume another capacity slot.
  SELECT h.id, h.expires_at, h.min_gap_minutes
    INTO v_hold_id, v_existing_expires, v_existing_gap
  FROM public.payment_schedule_holds h
  WHERE h.company_id = p_company_id
    AND h.invoice_id = p_invoice_id
    AND h.status = 'active'
    AND h.expires_at > v_now
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_hold_id, v_existing_expires, 'held'::text, v_existing_gap;
    RETURN;
  END IF;

  v_candidate_start := v_event_date::timestamp + v_start_time;
  v_candidate_end := v_event_date::timestamp + v_end_time;

  -- Count each occupied event once. A stale hold for a quote that is already on
  -- the agenda is ignored so it cannot consume two capacity slots.
  SELECT count(*)::integer
    INTO v_used
  FROM (
    SELECT 'agenda:' || ae.id::text AS occupancy_key
    FROM public.agenda_events ae
    WHERE ae.company_id = p_company_id
      AND ae.status IN ('reserved', 'scheduled', 'completed')
      AND (ae.quote_id IS NULL OR ae.quote_id <> v_quote_id)
      AND (ae.event_date::timestamp + ae.start_time)
            < v_candidate_end + pg_catalog.make_interval(mins => v_gap)
      AND (ae.event_date::timestamp + ae.end_time)
            + pg_catalog.make_interval(mins => v_gap) > v_candidate_start

    UNION ALL

    SELECT 'hold:' || h.id::text
    FROM public.payment_schedule_holds h
    WHERE h.company_id = p_company_id
      AND h.status = 'active'
      AND h.expires_at > v_now
      AND h.invoice_id <> p_invoice_id
      AND (h.event_date::timestamp + h.start_time)
            < v_candidate_end
              + pg_catalog.make_interval(mins => GREATEST(v_gap, h.min_gap_minutes))
      AND (h.event_date::timestamp + h.end_time)
            + pg_catalog.make_interval(mins => GREATEST(v_gap, h.min_gap_minutes))
            > v_candidate_start
      AND NOT EXISTS (
        SELECT 1
        FROM public.agenda_events ae
        WHERE ae.company_id = h.company_id
          AND ae.quote_id = h.quote_id
          AND ae.status IN ('reserved', 'scheduled', 'completed')
      )
  ) occupied;

  IF v_used >= v_capacity THEN
    RAISE EXCEPTION 'schedule_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_expires := v_now + pg_catalog.make_interval(secs => p_hold_seconds);
  INSERT INTO public.payment_schedule_holds (
    company_id, invoice_id, quote_id, event_id, payment_link_id, provider,
    event_date, start_time, end_time, min_gap_minutes, status, expires_at
  ) VALUES (
    p_company_id, p_invoice_id, v_quote_id, v_event_id, p_payment_link_id,
    'paypal', v_event_date, v_start_time, v_end_time, v_gap, 'active', v_expires
  )
  RETURNING id INTO v_hold_id;

  RETURN QUERY SELECT v_hold_id, v_expires, 'held'::text, v_gap;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_payment_schedule_hold(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_payment_schedule_hold(uuid, uuid, uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_payment_hold_on_agenda_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_start timestamp;
  v_new_end timestamp;
  v_gap integer := 0;
  v_capacity integer := 1;
  v_used integer := 0;
BEGIN
  IF NEW.status NOT IN ('reserved', 'scheduled', 'completed') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.company_id::text, 271828)
  );

  SELECT p.min_gap_minutes, p.max_concurrent_events
    INTO v_gap, v_capacity
  FROM private.payment_schedule_policy(NEW.company_id) p;

  UPDATE public.payment_schedule_holds
     SET status = 'expired', updated_at = now()
   WHERE company_id = NEW.company_id
     AND status = 'active'
     AND expires_at <= now();

  v_new_start := NEW.event_date::timestamp + NEW.start_time;
  v_new_end := NEW.event_date::timestamp + NEW.end_time;

  SELECT count(*)::integer
    INTO v_used
  FROM (
    SELECT 'agenda:' || ae.id::text AS occupancy_key
    FROM public.agenda_events ae
    WHERE ae.company_id = NEW.company_id
      AND ae.status IN ('reserved', 'scheduled', 'completed')
      AND ae.id <> COALESCE(NEW.id, gen_random_uuid())
      AND (NEW.quote_id IS NULL OR ae.quote_id IS NULL OR ae.quote_id <> NEW.quote_id)
      AND (ae.event_date::timestamp + ae.start_time)
            < v_new_end + pg_catalog.make_interval(mins => v_gap)
      AND (ae.event_date::timestamp + ae.end_time)
            + pg_catalog.make_interval(mins => v_gap) > v_new_start

    UNION ALL

    SELECT 'hold:' || h.id::text
    FROM public.payment_schedule_holds h
    WHERE h.company_id = NEW.company_id
      AND h.status = 'active'
      AND h.expires_at > now()
      AND (NEW.quote_id IS NULL OR h.quote_id <> NEW.quote_id)
      AND (h.event_date::timestamp + h.start_time)
            < v_new_end
              + pg_catalog.make_interval(mins => GREATEST(v_gap, h.min_gap_minutes))
      AND (h.event_date::timestamp + h.end_time)
            + pg_catalog.make_interval(mins => GREATEST(v_gap, h.min_gap_minutes))
            > v_new_start
      AND NOT EXISTS (
        SELECT 1 FROM public.agenda_events ae
        WHERE ae.company_id = h.company_id
          AND ae.quote_id = h.quote_id
          AND ae.status IN ('reserved', 'scheduled', 'completed')
      )
  ) occupied;

  IF v_used >= v_capacity THEN
    RAISE EXCEPTION 'schedule_capacity_reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Existing trigger keeps its identity and now executes the capacity-aware body.

