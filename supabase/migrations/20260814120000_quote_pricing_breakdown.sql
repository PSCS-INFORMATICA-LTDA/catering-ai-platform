-- =============================================================================
-- quote_pricing_breakdown — Pricing SSOT dual-write (Fase 1)
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NAO aplicar em Production.
--
-- Adiciona pricing_breakdown JSONB em quotes para dual-write com colunas flat.
-- Idempotente. Nao remove colunas existentes.
-- =============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb;

COMMENT ON COLUMN public.quotes.pricing_breakdown IS
  'Breakdown canônico de precificação (PricingBreakdown). Dual-write com colunas financeiras flat. Preferencial para cotações novas.';

CREATE INDEX IF NOT EXISTS idx_quotes_pricing_breakdown_gin
  ON public.quotes
  USING gin (pricing_breakdown);
