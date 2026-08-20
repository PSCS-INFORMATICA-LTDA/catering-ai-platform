-- companies usa company_name (não name)
CREATE OR REPLACE FUNCTION public.get_public_team_member_confirmation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_row public.agenda_event_member_confirmations%ROWTYPE;
  v_evt public.agenda_events%ROWTYPE;
  v_company_name TEXT;
  v_team_name TEXT;
  v_person_name TEXT;
  v_address TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT c.*
  INTO v_row
  FROM public.agenda_event_member_confirmations c
  WHERE c.token_hash = v_hash
    AND c.token_revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_row.token_expires_at IS NOT NULL AND v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('found', true, 'expired', true, 'status', v_row.status);
  END IF;

  SELECT e.* INTO v_evt FROM public.agenda_events e WHERE e.id = v_row.agenda_event_id;
  SELECT COALESCE(c.trade_name, c.company_name) INTO v_company_name
  FROM public.companies c WHERE c.id = v_row.company_id;
  SELECT t.name INTO v_team_name FROM public.operational_teams t WHERE t.id = v_row.team_id;
  SELECT COALESCE(NULLIF(trim(p.ab_name), ''), p.full_name)
  INTO v_person_name
  FROM public.customers p WHERE p.id = v_row.person_id;

  IF v_evt.quote_id IS NOT NULL THEN
    SELECT NULLIF(
      trim(concat_ws(', ',
        NULLIF(trim(COALESCE(ev.address_line, '')), ''),
        NULLIF(trim(COALESCE(ev.city, '')), ''),
        NULLIF(trim(COALESCE(ev.state, '')), '')
      )),
      ''
    )
    INTO v_address
    FROM public.quotes q
    LEFT JOIN public.events ev ON ev.id = q.event_id
    WHERE q.id = v_evt.quote_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'expired', false,
    'company_name', v_company_name,
    'status', v_row.status,
    'can_respond', (
      v_row.status = 'pending'
      AND v_row.token_revoked_at IS NULL
      AND (v_row.token_expires_at IS NULL OR v_row.token_expires_at >= now())
      AND v_evt.status = 'scheduled'
    ),
    'confirmation', jsonb_build_object(
      'id', v_row.id,
      'role_key', v_row.role_key,
      'person_name', v_person_name,
      'team_name', v_team_name,
      'event_title', v_evt.title,
      'event_date', v_evt.event_date,
      'start_time', v_evt.start_time,
      'end_time', v_evt.end_time,
      'client_name', v_evt.client_name,
      'location', v_address
    )
  );
END;
$$;
