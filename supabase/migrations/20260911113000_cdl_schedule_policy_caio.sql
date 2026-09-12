-- CDL DEV schedule policy confirmed by Caio on 2026-09-11.
-- Target: Catering AI DEV ONLY (yasprgtlqclwsjcshtls). Never apply to PROD.
-- This is an incremental data migration; prior applied migrations remain immutable.

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
          || jsonb_build_object(
            'max_concurrent_events', 4,
            'operational_teams', 6,
            'min_gap_minutes', 180,
            'distance_affects_capacity', false,
            'event_size_affects_capacity', false,
            'guest_limit_enabled', false,
            'max_guests', null,
            'exception_approval_required', true,
            'exception_approver', 'Caio',
            'capacity_unavailable_message_pt',
              'Olá! Agradecemos muito pelo interesse em contratar a CDL BBQ. Infelizmente, já atingimos nossa capacidade máxima de atendimento para essa data e, para manter o padrão de qualidade dos nossos serviços, não conseguiremos aceitar novas reservas. Será um prazer atendê-los em uma próxima oportunidade. Caso haja flexibilidade na data, podemos verificar outras opções disponíveis. Agradecemos pela compreensão!',
            'captured_payment_resolution', 'full_refund',
            'full_refund_required', true
          )
        )::text
      ),
      true
    ),
    updated_at = now()
WHERE cr.active = true
  AND cr.rule_key = 'schedule_turnaround_buffer'
  AND cr.company_id = (
    SELECT c.id
    FROM public.companies c
    WHERE c.company_code = 'CDL'
    LIMIT 1
  );

DO $$
DECLARE
  v_config jsonb;
BEGIN
  SELECT (cr.rule_value->>'value')::jsonb
    INTO v_config
  FROM public.commercial_rules cr
  WHERE cr.active = true
    AND cr.rule_key = 'schedule_turnaround_buffer'
    AND cr.company_id = (
      SELECT c.id FROM public.companies c WHERE c.company_code = 'CDL' LIMIT 1
    );

  IF v_config IS NULL
     OR (v_config->>'max_concurrent_events')::integer <> 4
     OR (v_config->>'operational_teams')::integer <> 6
     OR (v_config->>'min_gap_minutes')::integer <> 180
     OR (v_config->>'distance_affects_capacity')::boolean <> false
     OR (v_config->>'event_size_affects_capacity')::boolean <> false
     OR (v_config->>'guest_limit_enabled')::boolean <> false
     OR (v_config->>'exception_approver') <> 'Caio'
     OR (v_config->>'captured_payment_resolution') <> 'full_refund'
     OR (v_config->>'full_refund_required')::boolean <> true THEN
    RAISE EXCEPTION 'cdl_schedule_policy_verification_failed' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
