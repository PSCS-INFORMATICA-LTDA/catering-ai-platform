-- =============================================================================
-- DEV incremental hardening: take get_public_quote_proposal off the public API.
--
-- Do NOT DROP the function.
-- Do NOT CREATE OR REPLACE the function body.
-- Do NOT rebuild the public proposal snapshot engine in PL/pgSQL.
-- Do NOT revoke or rewrite unrelated public-token RPCs
-- (supplier garnish, team assignment, team-member confirmation,
-- material dispatch).
--
-- Canonical public proposal source of truth is Next.js:
--   /proposta/[token]
--   GET /api/public/proposta/[token]
--   GET /api/public/proposta/[token]/pdf
-- Those paths read proposal_shared_version_id → quote_versions →
-- commercial_snapshot / frozen pricing_breakdown.
-- =============================================================================

REVOKE EXECUTE
ON FUNCTION public.get_public_quote_proposal(text)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.get_public_quote_proposal(text)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.get_public_quote_proposal(text)
FROM authenticated;

REVOKE EXECUTE
ON FUNCTION public.get_public_quote_proposal(text)
FROM service_role;

COMMENT ON FUNCTION public.get_public_quote_proposal(text) IS
$comment$
DEPRECATED.
Public proposal source of truth is the pinned quote version served by
the Next.js proposal surface.
Do not expose this RPC publicly.
$comment$;

NOTIFY pgrst, 'reload schema';
