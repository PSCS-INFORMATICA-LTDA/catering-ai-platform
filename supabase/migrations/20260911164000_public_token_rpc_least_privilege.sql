-- =============================================================================
-- Public token RPC least-privilege grants.
-- These functions intentionally support unauthenticated public links, but
-- PostgreSQL's implicit PUBLIC execute grant is broader than the application
-- contract. Remove it and grant only the API roles that actually use the flow.
-- =============================================================================

-- Quote proposal public link
REVOKE EXECUTE ON FUNCTION public.get_public_quote_proposal(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_quote_proposal(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_quote_proposal(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_quote_proposal(text, text) TO anon, authenticated, service_role;

-- Supplier garnish public confirmation
REVOKE EXECUTE ON FUNCTION public.get_public_supplier_garnish(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_supplier_garnish(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_supplier_garnish(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_garnish(text) TO anon, authenticated, service_role;

-- Team assignment public response
REVOKE EXECUTE ON FUNCTION public.get_public_team_assignment(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_team_assignment(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_team_assignment(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_team_assignment(text, text) TO anon, authenticated, service_role;

-- Individual team-member confirmation public response
REVOKE EXECUTE ON FUNCTION public.get_public_team_member_confirmation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_team_member_confirmation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_team_member_confirmation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_team_member_confirmation(text, text) TO anon, authenticated, service_role;

-- Material dispatch public confirmation
REVOKE EXECUTE ON FUNCTION public.get_public_material_dispatch_confirmation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_public_material_dispatch(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_material_dispatch_confirmation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_public_material_dispatch(text, jsonb, text) TO anon, authenticated, service_role;

COMMENT ON TABLE public.inventory_document_sequences IS
  'Internal document-number state. RLS intentionally has no client policy; anon/authenticated have no direct grants and service_role is the only application writer.';
