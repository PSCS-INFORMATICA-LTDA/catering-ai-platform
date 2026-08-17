-- =============================================================================
-- Public Self-Service Quote V1
-- Target for this rollout: Supabase DEV ONLY (yasprgtlqclwsjcshtls).
-- NEVER apply this rollout directly to Production (eapwtirhevxrqinytans).
--
-- Additive intake/session foundation plus two narrow service-role RPCs:
-- rate limiting and atomic quote finalization. The browser never receives
-- table grants, a service key, a raw persisted token, or a writable RPC.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- commercial_rules must be unique inside a tenant (or inside the global
-- fallback set), not globally across every tenant.
ALTER TABLE public.commercial_rules
  DROP CONSTRAINT IF EXISTS commercial_rules_rule_key_key;

DROP INDEX IF EXISTS public.commercial_rules_rule_key_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_rules_company_key_active_uidx
  ON public.commercial_rules (company_id, rule_key)
  WHERE active IS TRUE AND company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_rules_global_key_active_uidx
  ON public.commercial_rules (rule_key)
  WHERE active IS TRUE AND company_id IS NULL;

-- Semantic package themes. No CSS or arbitrary color values are stored here.
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS card_theme_key text NOT NULL DEFAULT 'slate';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_card_theme_key_check'
      AND conrelid = 'public.packages'::regclass
  ) THEN
    ALTER TABLE public.packages
      ADD CONSTRAINT packages_card_theme_key_check
      CHECK (card_theme_key IN (
        'gold', 'bronze', 'navy', 'emerald', 'burgundy', 'slate'
      ));
  END IF;
END $$;

-- Initial CDL mapping is data-only and still uses generic semantic tokens.
UPDATE public.packages AS p
SET card_theme_key = CASE
  WHEN upper(trim(p.package_key)) LIKE 'BBQTRAD%' THEN 'bronze'
  WHEN upper(trim(p.package_key)) LIKE 'BBQSEL%' THEN 'emerald'
  WHEN upper(trim(p.package_key)) LIKE 'BBQCHO%' THEN 'burgundy'
  WHEN upper(trim(p.package_key)) LIKE 'BBQPRI%' THEN 'gold'
  WHEN upper(trim(p.package_key)) LIKE '%PERS%' THEN 'navy'
  ELSE 'slate'
END
FROM public.companies AS c
WHERE p.company_id = c.id
  AND lower(c.slug) = 'cdl';

CREATE TABLE IF NOT EXISTS public.company_public_quote_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  allowed_languages text[] NOT NULL DEFAULT ARRAY['pt']::text[],
  allowed_countries text[] NOT NULL DEFAULT ARRAY['US']::text[],
  hero_image_url text,
  landing_copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_version text NOT NULL DEFAULT 'v1',
  privacy_url text,
  support_phone text,
  support_whatsapp_url text,
  primary_color text,
  accent_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_public_quote_languages_check CHECK (
    cardinality(allowed_languages) BETWEEN 1 AND 3
    AND allowed_languages <@ ARRAY['pt', 'en', 'es']::text[]
  ),
  CONSTRAINT company_public_quote_countries_check CHECK (
    cardinality(allowed_countries) BETWEEN 1 AND 20
    AND array_to_string(allowed_countries, ',') ~ '^[A-Z]{2}(,[A-Z]{2})*$'
  ),
  CONSTRAINT company_public_quote_landing_copy_check CHECK (
    jsonb_typeof(landing_copy) = 'object'
  ),
  CONSTRAINT company_public_quote_consent_copy_check CHECK (
    jsonb_typeof(consent_copy) = 'object'
  ),
  CONSTRAINT company_public_quote_consent_version_check CHECK (
    length(trim(consent_version)) BETWEEN 1 AND 100
  ),
  CONSTRAINT company_public_quote_primary_color_check CHECK (
    primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT company_public_quote_accent_color_check CHECK (
    accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

COMMENT ON TABLE public.company_public_quote_settings IS
  'Tenant-scoped public quote landing, locale, country and consent configuration. enabled is the primary kill switch.';

CREATE TABLE IF NOT EXISTS public.public_quote_intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  locale text NOT NULL,
  token_hash text NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_schema_version integer NOT NULL DEFAULT 1,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  idempotency_key_hash text,
  submission_hash text,
  consent_at timestamptz,
  consent_version text,
  consent_locale text,
  consent_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_quote_intake_locale_check CHECK (locale IN ('pt', 'en', 'es')),
  CONSTRAINT public_quote_intake_token_hash_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT public_quote_intake_draft_check CHECK (
    jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 98304
  ),
  CONSTRAINT public_quote_intake_schema_version_check CHECK (
    draft_schema_version BETWEEN 1 AND 100
  ),
  CONSTRAINT public_quote_intake_step_check CHECK (current_step BETWEEN 0 AND 5),
  CONSTRAINT public_quote_intake_status_check CHECK (
    status IN ('active', 'submitting', 'submitted', 'expired', 'revoked')
  ),
  CONSTRAINT public_quote_intake_idempotency_hash_check CHECK (
    idempotency_key_hash IS NULL OR idempotency_key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT public_quote_intake_submission_hash_check CHECK (
    submission_hash IS NULL OR submission_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS public_quote_intake_token_hash_uidx
  ON public.public_quote_intake_sessions (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS public_quote_intake_quote_uidx
  ON public.public_quote_intake_sessions (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS public_quote_intake_idempotency_uidx
  ON public.public_quote_intake_sessions (company_id, idempotency_key_hash)
  WHERE idempotency_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS public_quote_intake_company_status_idx
  ON public.public_quote_intake_sessions (company_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS public_quote_intake_expiry_idx
  ON public.public_quote_intake_sessions (expires_at)
  WHERE status IN ('active', 'submitting');

COMMENT ON TABLE public.public_quote_intake_sessions IS
  'Opaque public intake sessions. Only a SHA-256 token hash is persisted; customer/event/quote records are created at finalization.';

CREATE TABLE IF NOT EXISTS public.public_quote_rate_limits (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  fingerprint_hash text NOT NULL,
  action text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, fingerprint_hash, action, window_started_at),
  CONSTRAINT public_quote_rate_fingerprint_check CHECK (
    fingerprint_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT public_quote_rate_action_check CHECK (
    action IN ('session', 'autosave', 'preview', 'upload', 'submit')
  ),
  CONSTRAINT public_quote_rate_count_check CHECK (request_count > 0)
);

CREATE INDEX IF NOT EXISTS public_quote_rate_expiry_idx
  ON public.public_quote_rate_limits (expires_at);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_public_quote_settings_updated_at
  ON public.company_public_quote_settings;
CREATE TRIGGER trg_company_public_quote_settings_updated_at
  BEFORE UPDATE ON public.company_public_quote_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_public_quote_intake_sessions_updated_at
  ON public.public_quote_intake_sessions;
CREATE TRIGGER trg_public_quote_intake_sessions_updated_at
  BEFORE UPDATE ON public.public_quote_intake_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_public_quote_rate_limits_updated_at
  ON public.public_quote_rate_limits;
CREATE TRIGGER trg_public_quote_rate_limits_updated_at
  BEFORE UPDATE ON public.public_quote_rate_limits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at_timestamp();

-- Private bucket: reads and writes go through server-side handlers only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-quote-grill',
  'public-quote-grill',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.company_public_quote_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_quote_intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_quote_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_public_quote_settings_select_member
  ON public.company_public_quote_settings;
CREATE POLICY company_public_quote_settings_select_member
  ON public.company_public_quote_settings
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS company_public_quote_settings_insert_admin
  ON public.company_public_quote_settings;
CREATE POLICY company_public_quote_settings_insert_admin
  ON public.company_public_quote_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
  );

DROP POLICY IF EXISTS company_public_quote_settings_update_admin
  ON public.company_public_quote_settings;
CREATE POLICY company_public_quote_settings_update_admin
  ON public.company_public_quote_settings
  FOR UPDATE TO authenticated
  USING (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]))
  WITH CHECK (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]));

DROP POLICY IF EXISTS company_public_quote_settings_delete_admin
  ON public.company_public_quote_settings;
CREATE POLICY company_public_quote_settings_delete_admin
  ON public.company_public_quote_settings
  FOR DELETE TO authenticated
  USING (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]));

-- No anon/authenticated policies exist for sessions or rate buckets.
REVOKE ALL ON TABLE public.company_public_quote_settings FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.public_quote_intake_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.public_quote_rate_limits FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.company_public_quote_settings TO authenticated;
GRANT ALL ON TABLE public.company_public_quote_settings TO service_role;
GRANT ALL ON TABLE public.public_quote_intake_sessions TO service_role;
GRANT ALL ON TABLE public.public_quote_rate_limits TO service_role;

-- RLS already denies anonymous table access, and explicit revokes remove the
-- legacy broad grants from the historical schema dump.
REVOKE ALL ON TABLE
  public.companies,
  public.company_features,
  public.customers,
  public.events,
  public.quotes,
  public.quote_versions,
  public.packages,
  public.package_items,
  public.package_side_items,
  public.package_option_groups,
  public.package_option_group_items,
  public.catalog_items,
  public.catalog_item_prices,
  public.commercial_rules,
  public.quote_additional_items,
  public.quote_package_selections,
  public.media_assets
FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text)
  FROM PUBLIC, anon;

-- Seed configuration disabled. DEV rollout enables both switches only after
-- migration verification, so applying schema never publishes a tenant by
-- accident.
INSERT INTO public.company_public_quote_settings (
  company_id,
  enabled,
  allowed_languages,
  allowed_countries,
  landing_copy,
  consent_copy,
  consent_version,
  support_phone,
  primary_color,
  accent_color
)
SELECT
  c.id,
  false,
  ARRAY['pt', 'en', 'es']::text[],
  ARRAY['US']::text[],
  jsonb_build_object(
    'pt', jsonb_build_object(
      'eyebrow', 'Orçamento online',
      'title', 'Seu evento começa aqui',
      'subtitle', 'Monte uma estimativa personalizada em poucos passos.',
      'intro', 'Conte os detalhes do seu evento. Nossa equipe revisará tudo antes de confirmar.',
      'cta', 'Começar meu orçamento'
    ),
    'en', jsonb_build_object(
      'eyebrow', 'Online quote',
      'title', 'Your event starts here',
      'subtitle', 'Build a personalized estimate in a few guided steps.',
      'intro', 'Tell us about your event. Our team reviews every detail before confirmation.',
      'cta', 'Start my quote'
    ),
    'es', jsonb_build_object(
      'eyebrow', 'Cotización online',
      'title', 'Tu evento comienza aquí',
      'subtitle', 'Crea una estimación personalizada en pocos pasos.',
      'intro', 'Cuéntanos sobre tu evento. Nuestro equipo revisará todo antes de confirmar.',
      'cta', 'Comenzar mi cotización'
    )
  ),
  jsonb_build_object(
    'pt', 'Aceito a Política de Privacidade e autorizo contato sobre esta solicitação.',
    'en', 'I accept the Privacy Policy and authorize contact about this request.',
    'es', 'Acepto la Política de Privacidad y autorizo el contacto sobre esta solicitud.'
  ),
  'public-quote-consent-v1',
  c.phone,
  c.primary_color,
  c.secondary_color
FROM public.companies AS c
WHERE lower(c.slug) = 'cdl'
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.company_features (company_id, feature_key, enabled)
SELECT c.id, 'public_self_service_quote', false
FROM public.companies AS c
WHERE lower(c.slug) = 'cdl'
ON CONFLICT (company_id, feature_key) DO NOTHING;

-- Atomic fixed-window counter. The API sends an HMAC fingerprint, never a raw
-- IP address or user-agent string.
CREATE OR REPLACE FUNCTION public.consume_public_quote_rate_limit(
  p_company_id uuid,
  p_fingerprint text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window timestamptz;
  v_count integer;
BEGIN
  IF p_company_id IS NULL
    OR p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_action NOT IN ('session', 'autosave', 'preview', 'upload', 'submit')
    OR p_limit NOT BETWEEN 1 AND 10000
    OR p_window_seconds NOT BETWEEN 10 AND 86400
  THEN
    RETURN false;
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.public_quote_rate_limits (
    company_id,
    fingerprint_hash,
    action,
    window_started_at,
    request_count,
    expires_at
  )
  VALUES (
    p_company_id,
    p_fingerprint,
    p_action,
    v_window,
    1,
    v_window + make_interval(secs => p_window_seconds * 2)
  )
  ON CONFLICT (company_id, fingerprint_hash, action, window_started_at)
  DO UPDATE SET
    request_count = public.public_quote_rate_limits.request_count + 1,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING request_count INTO v_count;

  DELETE FROM public.public_quote_rate_limits
  WHERE company_id = p_company_id
    AND fingerprint_hash = p_fingerprint
    AND expires_at < now();

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_quote_rate_limit(
  uuid, text, text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_quote_rate_limit(
  uuid, text, text, integer, integer
) TO service_role;

-- Finalizes the whole intake in one database transaction. p_pricing is trusted
-- only because EXECUTE is granted exclusively to service_role; the API computes
-- it with the canonical TypeScript Pricing SSOT immediately before this call.
CREATE OR REPLACE FUNCTION public.finalize_public_quote(
  p_token_hash text,
  p_idempotency_key_hash text,
  p_submission_hash text,
  p_payload jsonb,
  p_pricing jsonb,
  p_consent_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.public_quote_intake_sessions%ROWTYPE;
  v_settings public.company_public_quote_settings%ROWTYPE;
  v_company record;
  v_package_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_event_id uuid;
  v_quote_id uuid;
  v_media_id uuid;
  v_quote_number text;
  v_customer_number text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_phone text;
  v_email text;
  v_event jsonb;
  v_address jsonb;
  v_selection jsonb;
  v_grill jsonb;
  v_breakdown jsonb;
  v_totals jsonb;
  v_package_selections jsonb;
  v_payload_additionals jsonb;
  v_priced_additionals jsonb;
  v_group_id_text text;
  v_item_id_text text;
  v_additional jsonb;
  v_photo_reference text;
  v_storage_path text;
  v_adults integer;
  v_children_under_3 integer;
  v_children_4_to_12 integer;
  v_physical_guests integer;
  v_billable_guests numeric;
  v_mileage_distance numeric;
  v_currency text;
  v_now timestamptz := now();
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
    OR p_submission_hash !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_payload) <> 'object'
    OR jsonb_typeof(p_pricing) <> 'object'
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  SELECT s.*
  INTO v_session
  FROM public.public_quote_intake_sessions AS s
  WHERE s.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_session.status = 'submitted' THEN
    IF v_session.quote_id IS NOT NULL
      AND v_session.idempotency_key_hash = p_idempotency_key_hash
      AND v_session.submission_hash = p_submission_hash
    THEN
      RETURN (
        SELECT jsonb_build_object(
          'ok', true,
          'alreadySubmitted', true,
          'quote', jsonb_build_object(
            'id', q.id,
            'number', q.quote_number,
            'eventName', e.event_name,
            'eventDate', e.event_date,
            'total', q.quote_total,
            'currency', q.currency_code
          )
        )
        FROM public.quotes AS q
        JOIN public.events AS e ON e.id = q.event_id
        WHERE q.id = v_session.quote_id
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  IF v_session.status NOT IN ('active', 'submitting')
    OR v_session.revoked_at IS NOT NULL
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_session.expires_at <= v_now THEN
    UPDATE public.public_quote_intake_sessions
    SET status = 'expired'
    WHERE id = v_session.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT s.*
  INTO v_settings
  FROM public.company_public_quote_settings AS s
  WHERE s.company_id = v_session.company_id
    AND s.enabled IS TRUE;

  IF NOT FOUND
    OR NOT EXISTS (
      SELECT 1
      FROM public.company_features AS f
      WHERE f.company_id = v_session.company_id
        AND f.feature_key = 'public_self_service_quote'
        AND f.enabled IS TRUE
    )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_consent_version IS NULL
    OR trim(p_consent_version) <> v_settings.consent_version
    OR p_payload->>'locale' <> v_session.locale
    OR NOT (v_session.locale = ANY(v_settings.allowed_languages))
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_consent');
  END IF;

  SELECT
    c.company_name,
    c.trade_name,
    COALESCE(NULLIF(trim(c.default_currency), ''), NULLIF(trim(c.currency_code), ''), 'USD') AS currency
  INTO v_company
  FROM public.companies AS c
  WHERE c.id = v_session.company_id
    AND c.active IS TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_currency := v_company.currency;

  v_event := p_payload->'event';
  v_address := v_event->'address';
  v_selection := p_payload->'selection';
  v_grill := p_payload->'grill';
  v_breakdown := p_pricing->'breakdown';
  v_totals := p_pricing->'totals';
  v_package_selections := COALESCE(v_selection->'packageSelections', '{}'::jsonb);
  v_payload_additionals := COALESCE(v_selection->'additionals', '[]'::jsonb);
  v_priced_additionals := COALESCE(p_pricing->'resolvedAdditionals', '[]'::jsonb);

  IF jsonb_typeof(p_payload->'contact') <> 'object'
    OR jsonb_typeof(v_event) <> 'object'
    OR jsonb_typeof(v_address) <> 'object'
    OR jsonb_typeof(v_selection) <> 'object'
    OR jsonb_typeof(v_grill) <> 'object'
    OR jsonb_typeof(v_breakdown) <> 'object'
    OR jsonb_typeof(v_totals) <> 'object'
    OR jsonb_typeof(v_package_selections) <> 'object'
    OR jsonb_typeof(v_payload_additionals) <> 'array'
    OR jsonb_typeof(v_priced_additionals) <> 'array'
    OR COALESCE(v_breakdown->>'engine_version', '') = ''
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  BEGIN
    v_package_id := (v_selection->>'packageId')::uuid;
    v_adults := (v_event->>'adultCount')::integer;
    v_children_under_3 := (v_event->>'childrenUnder3Count')::integer;
    v_children_4_to_12 := (v_event->>'children4To12Count')::integer;
    v_physical_guests := (v_breakdown->'guest_counts'->>'physical_guest_count')::integer;
    v_billable_guests := (v_breakdown->'guest_counts'->>'billable_guest_count')::numeric;
    v_mileage_distance := COALESCE((p_pricing->>'mileageDistance')::numeric, 0);
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END;

  IF v_adults < 1
    OR v_children_under_3 < 0
    OR v_children_4_to_12 < 0
    OR v_physical_guests <> (v_adults + v_children_under_3 + v_children_4_to_12)
    OR v_billable_guests < 1
    OR v_mileage_distance < 0
    OR COALESCE((v_breakdown->>'total')::numeric, -1) < 0
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.packages AS p
    WHERE p.id = v_package_id
      AND p.company_id = v_session.company_id
      AND p.active IS TRUE
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
  END IF;

  -- Every required group for the selected package must have a selection.
  IF EXISTS (
    SELECT 1
    FROM public.package_option_groups AS g
    WHERE g.company_id = v_session.company_id
      AND g.package_id = v_package_id
      AND g.active IS TRUE
      AND g.is_active IS TRUE
      AND COALESCE(g.is_required, g.required, true) IS TRUE
      AND g.min_choices > 0
      AND NOT (v_package_selections ? g.id::text)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
  END IF;

  FOR v_group_id_text, v_item_id_text IN
    SELECT key, value
    FROM jsonb_each_text(v_package_selections)
  LOOP
    BEGIN
      PERFORM 1
      FROM public.package_option_groups AS g
      JOIN public.package_option_group_items AS i
        ON i.option_group_id = g.id
      WHERE g.id = v_group_id_text::uuid
        AND i.id = v_item_id_text::uuid
        AND g.company_id = v_session.company_id
        AND i.company_id = v_session.company_id
        AND g.package_id = v_package_id
        AND g.active IS TRUE
        AND g.is_active IS TRUE
        AND i.active IS TRUE;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
    END;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
    END IF;
  END LOOP;

  -- Browser additions and server-priced lines must describe the same unique
  -- catalog items, all active and customer-visible in this tenant.
  IF jsonb_array_length(v_payload_additionals) <> jsonb_array_length(v_priced_additionals)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_payload_additionals) AS a
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.catalog_items AS ci
        WHERE ci.id = (a->>'itemId')::uuid
          AND ci.company_id = v_session.company_id
          AND ci.active IS TRUE
          AND ci.customer_visible IS TRUE
          AND ci.can_be_additional IS TRUE
          AND COALESCE(ci.operational_item, false) IS FALSE
      )
      OR COALESCE((a->>'quantity')::numeric, 0) <= 0
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_priced_additionals) AS pa
        WHERE pa->>'itemId' = a->>'itemId'
          AND (pa->>'quantity')::numeric = (a->>'quantity')::numeric
      )
    )
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
  END IF;

  v_photo_reference := NULLIF(trim(COALESCE(v_grill->>'photoReference', '')), '');
  IF COALESCE((v_grill->>'hasGrill')::boolean, false) IS TRUE THEN
    IF v_photo_reference IS NULL
      OR v_photo_reference NOT LIKE (
        'public-quote-grill/' || v_session.company_id::text || '/' || v_session.id::text || '/%'
      )
    THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_photo');
    END IF;
    v_storage_path := substring(
      v_photo_reference FROM length('public-quote-grill/') + 1
    );
    IF NOT EXISTS (
      SELECT 1
      FROM storage.objects AS o
      WHERE o.bucket_id = 'public-quote-grill'
        AND o.name = v_storage_path
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_photo');
    END IF;
  ELSIF COALESCE((v_grill->>'rentalRequired')::boolean, false) IS TRUE
    AND COALESCE((v_grill->>'rentalQty')::integer, 0) < 1
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.public_quote_intake_sessions AS other
    WHERE other.company_id = v_session.company_id
      AND other.id <> v_session.id
      AND other.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  SELECT b.id
  INTO v_branch_id
  FROM public.branches AS b
  WHERE b.company_id = v_session.company_id
    AND b.active IS TRUE
  ORDER BY b.is_default DESC NULLS LAST, b.name ASC
  LIMIT 1;

  v_first_name := trim(p_payload->'contact'->>'firstName');
  v_last_name := trim(p_payload->'contact'->>'lastName');
  v_full_name := left(trim(concat_ws(' ', v_first_name, v_last_name)), 255);
  v_phone := regexp_replace(p_payload->'contact'->>'phone', '[^0-9]', '', 'g');
  v_email := NULLIF(left(trim(COALESCE(p_payload->'contact'->>'email', '')), 255), '');

  IF length(v_full_name) < 2 OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  UPDATE public.public_quote_intake_sessions
  SET
    status = 'submitting',
    idempotency_key_hash = p_idempotency_key_hash,
    submission_hash = p_submission_hash,
    consent_at = v_now,
    consent_version = p_consent_version,
    consent_locale = v_session.locale,
    consent_source = 'public_self_service'
  WHERE id = v_session.id;

  SELECT c.id
  INTO v_customer_id
  FROM public.customers AS c
  WHERE c.company_id = v_session.company_id
    AND c.phone_normalized = v_phone
    AND c.active IS TRUE
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    v_customer_number := public.get_next_document_number(
      v_session.company_id,
      'customer'
    );
    BEGIN
      INSERT INTO public.customers (
        company_id,
        ab_number,
        ab_name,
        full_name,
        contact_name,
        phone,
        phone_normalized,
        email,
        preferred_language,
        source,
        active
      ) VALUES (
        v_session.company_id,
        v_customer_number,
        v_full_name,
        v_full_name,
        v_full_name,
        p_payload->'contact'->>'phone',
        v_phone,
        v_email,
        v_session.locale,
        'public_self_service',
        true
      )
      RETURNING id INTO v_customer_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.id
      INTO v_customer_id
      FROM public.customers AS c
      WHERE c.company_id = v_session.company_id
        AND c.phone_normalized = v_phone
        AND c.active IS TRUE
      ORDER BY c.updated_at DESC NULLS LAST
      LIMIT 1;
      IF v_customer_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

  INSERT INTO public.events (
    company_id,
    customer_id,
    event_name,
    event_date,
    event_time,
    start_time,
    end_time,
    event_location,
    address_line,
    city,
    state,
    postal_code,
    country,
    adults,
    children,
    adults_count,
    children_count,
    billable_guests,
    guests,
    total_guests,
    has_grill,
    grill_photo_required,
    grill_rental_required,
    grill_rental_qty,
    grill_notes,
    distance_from_base,
    status,
    active
  ) VALUES (
    v_session.company_id,
    v_customer_id,
    v_full_name,
    (v_event->>'eventDate')::date,
    (v_event->>'startTime')::time,
    (v_event->>'startTime')::time,
    (v_event->>'endTime')::time,
    NULLIF(v_address->>'formattedAddress', ''),
    left(trim(concat_ws(', ', v_address->>'route', NULLIF(v_address->>'number', ''))), 255),
    left(v_address->>'city', 100),
    left(v_address->>'region', 100),
    left(v_address->>'postalCode', 30),
    left(v_address->>'country', 10),
    v_adults,
    v_children_under_3 + v_children_4_to_12,
    v_adults,
    v_children_under_3 + v_children_4_to_12,
    v_billable_guests,
    v_physical_guests,
    v_physical_guests,
    COALESCE((v_grill->>'hasGrill')::boolean, false),
    COALESCE((v_grill->>'hasGrill')::boolean, false),
    COALESCE((v_grill->>'rentalRequired')::boolean, false),
    COALESCE((v_grill->>'rentalQty')::integer, 0),
    NULLIF(left(trim(COALESCE(v_grill->>'notes', '')), 1000), ''),
    v_mileage_distance,
    'draft',
    true
  )
  RETURNING id INTO v_event_id;

  IF v_photo_reference IS NOT NULL THEN
    INSERT INTO public.media_assets (
      company_id,
      entity_type,
      entity_id,
      entity_key,
      media_type,
      storage_path,
      label_pt,
      label_en,
      label_es,
      active
    ) VALUES (
      v_session.company_id,
      'event',
      v_event_id,
      'grill_photo',
      'image',
      v_storage_path,
      'Foto da churrasqueira',
      'Grill photo',
      'Foto de la parrilla',
      true
    )
    RETURNING id INTO v_media_id;

    UPDATE public.events
    SET
      grill_photo_media_id = v_media_id,
      grill_photo_url = 'storage://public-quote-grill/' || v_storage_path
    WHERE id = v_event_id;
  END IF;

  v_quote_number := public.get_next_document_number(
    v_session.company_id,
    'quote'
  );

  INSERT INTO public.quotes (
    company_id,
    branch_id,
    customer_id,
    event_id,
    package_id,
    quote_number,
    quote_status,
    source,
    language,
    currency_code,
    quote_date,
    expiration_date,
    adults_count,
    children_count,
    adult_count,
    children_under_3_count,
    children_4_to_12_count,
    billable_guests,
    billable_guest_count,
    physical_guest_count,
    total_guests,
    package_price_per_person,
    package_total,
    additional_total,
    grill_rental_total,
    mileage_base_location,
    mileage_distance,
    mileage_free_limit,
    mileage_rate,
    mileage_fee,
    event_total_before_discount,
    minimum_order_amount,
    minimum_order_applied,
    holiday_surcharge_amount,
    subtotal,
    discount,
    discount_amount,
    deposit_amount,
    reservation_type,
    reservation_percentage,
    reservation_amount,
    balance_due,
    total_amount,
    quote_total,
    has_grill,
    grill_photo_required,
    grill_rental_required,
    grill_rental_qty,
    grill_notes,
    pricing_breakdown,
    active
  ) VALUES (
    v_session.company_id,
    v_branch_id,
    v_customer_id,
    v_event_id,
    v_package_id,
    v_quote_number,
    'ready_for_review',
    'public_self_service',
    v_session.locale,
    v_currency,
    current_date,
    current_date + 30,
    v_adults,
    v_children_under_3 + v_children_4_to_12,
    v_adults,
    v_children_under_3,
    v_children_4_to_12,
    v_billable_guests,
    v_billable_guests,
    v_physical_guests,
    v_physical_guests,
    (p_pricing->>'packagePricePerPerson')::numeric,
    COALESCE((v_totals->>'packageTotal')::numeric, 0),
    COALESCE((v_totals->>'additionalTotal')::numeric, 0),
    COALESCE((v_totals->>'grillRentalTotal')::numeric, 0),
    NULLIF(v_breakdown->'rules_applied'->>'mileageBaseLocation', ''),
    v_mileage_distance,
    COALESCE((v_totals->>'mileageFreeLimit')::numeric, 0),
    COALESCE((v_totals->>'mileageRate')::numeric, 0),
    COALESCE((v_totals->>'mileageFee')::numeric, 0),
    COALESCE((v_totals->>'quoteSubtotal')::numeric, 0),
    COALESCE((v_totals->>'minimumOrderAmount')::numeric, 0),
    COALESCE((v_totals->>'minimumOrderApplied')::boolean, false),
    COALESCE((v_totals->>'holidaySurchargeAmount')::numeric, 0),
    COALESCE((v_breakdown->>'subtotal')::numeric, 0),
    0,
    0,
    COALESCE((v_breakdown->>'deposit')::numeric, 0),
    'percentage',
    COALESCE((v_totals->>'reservationPercentage')::numeric, 0),
    COALESCE((v_breakdown->>'deposit')::numeric, 0),
    COALESCE((v_breakdown->>'balance')::numeric, 0),
    COALESCE((v_breakdown->>'total')::numeric, 0),
    COALESCE((v_breakdown->>'total')::numeric, 0),
    COALESCE((v_grill->>'hasGrill')::boolean, false),
    COALESCE((v_grill->>'hasGrill')::boolean, false),
    COALESCE((v_grill->>'rentalRequired')::boolean, false),
    COALESCE((v_grill->>'rentalQty')::integer, 0),
    NULLIF(left(trim(COALESCE(v_grill->>'notes', '')), 1000), ''),
    v_breakdown,
    true
  )
  RETURNING id INTO v_quote_id;

  FOR v_group_id_text, v_item_id_text IN
    SELECT key, value
    FROM jsonb_each_text(v_package_selections)
  LOOP
    INSERT INTO public.quote_package_selections (
      company_id,
      branch_id,
      quote_id,
      package_id,
      option_group_id,
      option_item_id
    ) VALUES (
      v_session.company_id,
      v_branch_id,
      v_quote_id,
      v_package_id,
      v_group_id_text::uuid,
      v_item_id_text::uuid
    );
  END LOOP;

  FOR v_additional IN
    SELECT value
    FROM jsonb_array_elements(v_priced_additionals)
  LOOP
    INSERT INTO public.quote_additional_items (
      company_id,
      quote_id,
      additional_item_id,
      quantity,
      unit_price,
      total_price,
      selected
    ) VALUES (
      v_session.company_id,
      v_quote_id,
      (v_additional->>'itemId')::uuid,
      (v_additional->>'quantity')::numeric,
      (v_additional->>'unitPrice')::numeric,
      (v_additional->>'totalPrice')::numeric,
      true
    );
  END LOOP;

  INSERT INTO public.quote_versions (
    company_id,
    quote_id,
    version_number,
    language,
    currency_code,
    package_total,
    additional_total,
    mileage_fee,
    discount_amount,
    reservation_amount,
    balance_due,
    quote_total,
    commercial_snapshot,
    schema_version,
    is_current
  ) VALUES (
    v_session.company_id,
    v_quote_id,
    1,
    v_session.locale,
    v_currency,
    COALESCE((v_totals->>'packageTotal')::numeric, 0),
    COALESCE((v_totals->>'additionalTotal')::numeric, 0),
    COALESCE((v_totals->>'mileageFee')::numeric, 0),
    0,
    COALESCE((v_breakdown->>'deposit')::numeric, 0),
    COALESCE((v_breakdown->>'balance')::numeric, 0),
    COALESCE((v_breakdown->>'total')::numeric, 0),
    jsonb_build_object(
      'schema_version', 1,
      'source', 'public_self_service',
      'event', v_event,
      'selection', v_selection,
      'grill', v_grill,
      'pricing_breakdown', v_breakdown,
      'totals', v_totals,
      'consent', jsonb_build_object(
        'accepted_at', v_now,
        'version', p_consent_version,
        'locale', v_session.locale,
        'source', 'public_self_service'
      )
    ),
    1,
    true
  );

  UPDATE public.public_quote_intake_sessions
  SET
    status = 'submitted',
    draft = p_payload,
    quote_id = v_quote_id,
    current_step = 5,
    consent_at = v_now,
    consent_version = p_consent_version,
    consent_locale = v_session.locale,
    consent_source = 'public_self_service'
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadySubmitted', false,
    'quote', jsonb_build_object(
      'id', v_quote_id,
      'number', v_quote_number,
      'eventName', v_full_name,
      'eventDate', v_event->>'eventDate',
      'total', (v_breakdown->>'total')::numeric,
      'currency', v_currency
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_public_quote(
  text, text, text, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_public_quote(
  text, text, text, jsonb, jsonb, text
) TO service_role;

COMMENT ON FUNCTION public.finalize_public_quote(
  text, text, text, jsonb, jsonb, text
) IS
  'Service-role-only atomic public intake finalization with tenant/catalog validation, customer matching, quote snapshot and idempotency.';
