-- =============================================================================
-- Platform security hardening discovered during Finance / PSCS One review.
-- DEV first. Preserve intentional token-based public endpoints while removing
-- unintended direct access to internal SECURITY DEFINER inventory/document RPCs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Inventory document sequences are internal state. They are mutated only by
-- controlled server-side document numbering logic.
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_document_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inventory_document_sequences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.inventory_document_sequences TO service_role;

-- ---------------------------------------------------------------------------
-- Views must honor the querying user's RLS policies instead of view-owner
-- privileges (Postgres 15+ security_invoker views).
-- ---------------------------------------------------------------------------
ALTER VIEW public.inventory_availability SET (security_invoker = true);
ALTER VIEW public.vw_customer_display SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Fix mutable search_path warnings on helper functions.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.resolve_document_prefix(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.customers_ensure_role_flag()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.inventory_movement_code_for_type(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.inventory_document_type_for_movement(text)
  SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Internal SECURITY DEFINER RPCs: server/service-role only.
-- These functions mutate inventory, rebuild balances or allocate document
-- numbers and therefore must not be callable directly from anon/authenticated.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.next_inventory_document_number(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_inventory_document_number(uuid, uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_default_branch(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_branch(uuid, uuid, text, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_default_inventory_location(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_inventory_location(uuid, uuid, text, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_inventory_commitment(uuid, uuid, numeric, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_commitment(uuid, uuid, numeric, uuid, uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_inventory_commitment(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_inventory_commitment(uuid, uuid, text, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_inventory_committed_qty(uuid, uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_inventory_committed_qty(uuid, uuid, uuid, uuid, uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.post_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text,
  uuid, timestamptz, boolean, uuid, uuid, text, integer, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text,
  uuid, timestamptz, boolean, uuid, uuid, text, integer, uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.post_inventory_for_order_dispatch(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_inventory_for_order_dispatch(uuid, uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.post_inventory_for_material_return(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_inventory_for_material_return(uuid, uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.rebuild_inventory_balances(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_inventory_balances(uuid)
  TO service_role;

-- Internal helper used by authenticated quote-proposal functions. It should
-- not be a directly exposed RPC itself.
REVOKE EXECUTE ON FUNCTION public._assert_quote_member(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_quote_member(uuid)
  TO service_role;

-- Staff proposal functions intentionally remain callable by authenticated
-- users because each one executes _assert_quote_member/auth.uid checks. Remove
-- the accidental PUBLIC/anon inheritance and grant only the intended role.
REVOKE EXECUTE ON FUNCTION public.ensure_quote_proposal_token(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_quote_proposal_sent(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_quote_proposal_follow_up(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_quote_proposal_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_quote_proposal_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_quote_proposal_follow_up(uuid) TO authenticated;

-- Token-based public proposal/team/supplier/material endpoints are intentionally
-- left public. Their SECURITY DEFINER status is part of the public-link design;
-- they are reviewed separately and must validate high-entropy tokens internally.
