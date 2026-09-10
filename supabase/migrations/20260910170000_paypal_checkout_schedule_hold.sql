-- =============================================================================
-- PayPal Sandbox Checkout V2 — atomic schedule hold
-- Ambiente-alvo: Catering AI DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production nesta fase.
--
-- Purpose:
--   Prevent an accepted quote's event slot from becoming unavailable while the
--   customer is completing PayPal Sandbox approval/capture.
--
-- Ownership: CATERING AI (event/payment orchestration), not PSCS One billing.
--
-- Logical rollback (DEV only):
--   DROP TRIGGER ... on agenda_events/events/quotes;
--   DROP FUNCTION public.acquire_payment_schedule_hold(...);
--   DROP FUNCTION public.release_payment_schedule_hold(...);
--   DROP FUNCTION public.consume_payment_schedule_hold(...);
--   DROP TABLE public.payment_schedule_holds;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_schedule_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  payment_link_id uuid REFERENCES public.invoice_payment_links(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'paypal',
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  min_gap_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_schedule_holds_provider_check CHECK (provider = 'paypal'),
  CONSTRAINT payment_schedule_holds_status_check
    CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  CONSTRAINT payment_schedule_holds_gap_check
    CHECK (min_gap_minutes BETWEEN 0 AND 1440),
  CONSTRAINT payment_schedule_holds_time_check
    CHECK (end_time > start_time)
);

COMMENT ON TABLE public.payment_schedule_holds IS
  'Short-lived, server-only Catering event-slot holds while an online deposit checkout is in progress.';

CREATE UNIQUE INDEX IF NOT EXISTS payment_schedule_holds_active_invoice_uidx
  ON public.payment_schedule_holds(invoice_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payment_schedule_holds_company_window
  ON public.payment_schedule_holds(company_id, event_date, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_holds_quote
  ON public.payment_schedule_holds(company_id, quote_id, status, expires_at);

ALTER TABLE public.payment_schedule_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_schedule_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_schedule_holds TO service_role;

-- No authenticated policies by design. All hold mutations are server-side only.

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
  v_rule_value jsonb;
  v_rule_config jsonb;
  v_gap integer := 0;
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

  -- Serialize every scheduling mutation/hold acquisition for this company.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 271828)
  );

  SELECT
    i.quote_id,
    i.status,
    i.snapshot,
    q.event_id,
    q.quote_status,
    q.proposal_response,
    q.reservation_confirmed_at,
    e.event_date,
    e.start_time,
    e.end_time
  INTO
    v_quote_id,
    v_invoice_status,
    v_snapshot,
    v_event_id,
    v_quote_status,
    v_proposal_response,
    v_reservation_confirmed_at,
    v_event_date,
    v_start_time,
    v_end_time
  FROM public.invoices i
  JOIN public.quotes q
    ON q.id = i.quote_id
   AND q.company_id = i.company_id
   AND q.active = true
  JOIN public.events e
    ON e.id = q.event_id
   AND e.company_id = i.company_id
   AND e.active = true
  WHERE i.id = p_invoice_id
    AND i.company_id = p_company_id
  FOR UPDATE OF i, q, e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'schedule_context_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_invoice_status IN ('paid', 'canceled') THEN
    RAISE EXCEPTION 'invoice_not_payable' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    v_proposal_response = 'accepted'
    OR v_quote_status IN ('approved', 'accepted')
  ) THEN
    RAISE EXCEPTION 'quote_not_accepted' USING ERRCODE = 'P0001';
  END IF;

  -- Once the deposit already reserved the event, no temporary hold is needed.
  IF v_reservation_confirmed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::timestamptz, 'already_reserved'::text, 0;
    RETURN;
  END IF;

  IF v_event_date IS NULL OR v_start_time IS NULL OR v_end_time IS NULL OR v_end_time <= v_start_time THEN
    RAISE EXCEPTION 'schedule_details_invalid' USING ERRCODE = 'P0001';
  END IF;

  -- Invoice is a transaction snapshot. Refuse payment if live scheduling fields
  -- drifted after invoice generation; operator must deliberately regenerate.
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

  -- Read the company's canonical turnaround rule inside the same DB transaction.
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
      ELSE
        v_gap := 0;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fail safe: malformed rule does not invent CDL's 120 minutes, but overlap
      -- protection remains active with gap 0, matching the existing safe default.
      v_gap := 0;
    END;
  END IF;

  UPDATE public.payment_schedule_holds
     SET status = 'expired', updated_at = v_now
   WHERE company_id = p_company_id
     AND status = 'active'
     AND expires_at <= v_now;

  -- Reuse an active hold for the same invoice; do not extend it on repeated clicks.
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

  -- Existing confirmed/reserved agenda always wins over a new payment hold.
  IF EXISTS (
    SELECT 1
    FROM public.agenda_events ae
    WHERE ae.company_id = p_company_id
      AND ae.status IN ('reserved', 'scheduled', 'completed')
      AND (ae.quote_id IS NULL OR ae.quote_id <> v_quote_id)
      AND (ae.event_date::timestamp + ae.start_time)
            < v_candidate_end + pg_catalog.make_interval(mins => v_gap)
      AND (ae.event_date::timestamp + ae.end_time)
            + pg_catalog.make_interval(mins => v_gap) > v_candidate_start
  ) THEN
    RAISE EXCEPTION 'schedule_unavailable' USING ERRCODE = 'P0001';
  END IF;

  -- Another customer's active checkout hold also blocks this window. Use the
  -- larger turnaround buffer if the two holds were created under different rules.
  IF EXISTS (
    SELECT 1
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
  ) THEN
    RAISE EXCEPTION 'schedule_temporarily_held' USING ERRCODE = 'P0001';
  END IF;

  v_expires := v_now + pg_catalog.make_interval(secs => p_hold_seconds);

  INSERT INTO public.payment_schedule_holds (
    company_id,
    invoice_id,
    quote_id,
    event_id,
    payment_link_id,
    provider,
    event_date,
    start_time,
    end_time,
    min_gap_minutes,
    status,
    expires_at
  ) VALUES (
    p_company_id,
    p_invoice_id,
    v_quote_id,
    v_event_id,
    p_payment_link_id,
    'paypal',
    v_event_date,
    v_start_time,
    v_end_time,
    v_gap,
    'active',
    v_expires
  )
  RETURNING id INTO v_hold_id;

  RETURN QUERY SELECT v_hold_id, v_expires, 'held'::text, v_gap;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_payment_schedule_hold(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_payment_schedule_hold(uuid, uuid, uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.release_payment_schedule_hold(
  p_company_id uuid,
  p_invoice_id uuid,
  p_reason text DEFAULT 'released'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 271828)
  );
  UPDATE public.payment_schedule_holds
     SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'released' END,
         released_at = CASE WHEN expires_at > now() THEN now() ELSE released_at END,
         release_reason = LEFT(COALESCE(p_reason, 'released'), 120),
         updated_at = now()
   WHERE company_id = p_company_id
     AND invoice_id = p_invoice_id
     AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_payment_schedule_hold(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_payment_schedule_hold(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_payment_schedule_hold(
  p_company_id uuid,
  p_invoice_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 271828)
  );
  UPDATE public.payment_schedule_holds
     SET status = 'consumed',
         consumed_at = now(),
         updated_at = now()
   WHERE company_id = p_company_id
     AND invoice_id = p_invoice_id
     AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_payment_schedule_hold(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_payment_schedule_hold(uuid, uuid)
  TO service_role;

-- Protect active checkout holds from being bypassed by an operator scheduling
-- a conflicting Agenda event during the PayPal approval window.
CREATE OR REPLACE FUNCTION private.enforce_payment_hold_on_agenda_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_start timestamp;
  v_new_end timestamp;
BEGIN
  IF NEW.status NOT IN ('reserved', 'scheduled', 'completed') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.company_id::text, 271828)
  );

  UPDATE public.payment_schedule_holds
     SET status = 'expired', updated_at = now()
   WHERE company_id = NEW.company_id
     AND status = 'active'
     AND expires_at <= now();

  v_new_start := NEW.event_date::timestamp + NEW.start_time;
  v_new_end := NEW.event_date::timestamp + NEW.end_time;

  IF EXISTS (
    SELECT 1
    FROM public.payment_schedule_holds h
    WHERE h.company_id = NEW.company_id
      AND h.status = 'active'
      AND h.expires_at > now()
      AND (NEW.quote_id IS NULL OR h.quote_id <> NEW.quote_id)
      AND (h.event_date::timestamp + h.start_time)
            < v_new_end + pg_catalog.make_interval(mins => h.min_gap_minutes)
      AND (h.event_date::timestamp + h.end_time)
            + pg_catalog.make_interval(mins => h.min_gap_minutes) > v_new_start
  ) THEN
    RAISE EXCEPTION 'schedule_temporarily_held_for_payment' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_events_payment_hold_guard ON public.agenda_events;
CREATE TRIGGER trg_agenda_events_payment_hold_guard
BEFORE INSERT OR UPDATE OF company_id, event_date, start_time, end_time, status, quote_id
ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION private.enforce_payment_hold_on_agenda_event();

-- Freeze the quoted scheduling facts while an online deposit approval is active.
CREATE OR REPLACE FUNCTION private.enforce_payment_hold_on_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.company_id::text, 271828)
  );

  IF EXISTS (
    SELECT 1
    FROM public.payment_schedule_holds h
    WHERE h.company_id = NEW.company_id
      AND h.event_id = OLD.id
      AND h.status = 'active'
      AND h.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'event_locked_for_payment' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_payment_hold_guard ON public.events;
CREATE TRIGGER trg_events_payment_hold_guard
BEFORE UPDATE OF event_date, start_time, end_time, active
ON public.events
FOR EACH ROW EXECUTE FUNCTION private.enforce_payment_hold_on_event_change();

CREATE OR REPLACE FUNCTION private.enforce_payment_hold_on_quote_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.event_id IS NOT DISTINCT FROM OLD.event_id
     AND NEW.proposal_response IS NOT DISTINCT FROM OLD.proposal_response
     AND NEW.quote_status IS NOT DISTINCT FROM OLD.quote_status
     AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(COALESCE(NEW.company_id, OLD.company_id)::text, 271828)
  );

  IF EXISTS (
    SELECT 1
    FROM public.payment_schedule_holds h
    WHERE h.company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND h.quote_id = OLD.id
      AND h.status = 'active'
      AND h.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'quote_locked_for_payment' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_payment_hold_guard ON public.quotes;
CREATE TRIGGER trg_quotes_payment_hold_guard
BEFORE UPDATE OF event_id, proposal_response, quote_status, active
ON public.quotes
FOR EACH ROW EXECUTE FUNCTION private.enforce_payment_hold_on_quote_change();
