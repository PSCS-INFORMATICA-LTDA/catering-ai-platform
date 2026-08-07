-- Descrições comerciais de pacotes: itens, guarnições e diferenciais.
-- Execute no Supabase SQL Editor após packages-catalog-upgrade.sql.

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS items_description_pt text,
  ADD COLUMN IF NOT EXISTS garnish_description_pt text,
  ADD COLUMN IF NOT EXISTS sides_description_pt text,
  ADD COLUMN IF NOT EXISTS package_highlights_pt text;

-- Traditional (BBQTRAD, BBQTRAD+)
UPDATE public.packages
SET
  items_description_pt = 'Picanha Angus • Linguiça tradicional • Frango sobrecoxa desossada • Pão de alho • Queijo coalho • Milho • Chimichurri • Farofa • Mel • Goiabada • Pimenta de bico • Geleia de pimenta',
  package_highlights_pt = 'Churrasco tradicional CDL • Melhor opção de entrada • Seleção clássica para eventos'
WHERE trim(coalesce(package_key, '')) ILIKE 'BBQTRAD%'
  AND trim(coalesce(package_key, '')) NOT ILIKE '%PERS%';

-- Select (BBQSEL, BBQSEL+)
UPDATE public.packages
SET
  items_description_pt = 'Picanha Angus • Linguiça tradicional • Frango sobrecoxa desossada • Pão de alho • Queijo coalho • Milho • Costela de boi ou costela de porco • Chimichurri • Farofa • Mel • Goiabada • Pimenta de bico • Geleia de pimenta',
  package_highlights_pt = 'Costela de boi ou costela de porco • Opção intermediária com upgrade de proteína'
WHERE trim(coalesce(package_key, '')) ILIKE 'BBQSEL%';

-- Choice (BBQCHO, BBQCHO+)
UPDATE public.packages
SET
  items_description_pt = 'Picanha Angus • Linguiça tradicional • Frango sobrecoxa desossada • Pão de alho • Queijo coalho • Milho • Salmão ou camarão • Costela de boi ou costela de porco • Chimichurri • Farofa • Mel • Goiabada • Pimenta de bico • Geleia de pimenta',
  package_highlights_pt = 'Salmão ou camarão • Costela de boi ou costela de porco • Opção premium sem carré de cordeiro'
WHERE trim(coalesce(package_key, '')) ILIKE 'BBQCHO%';

-- Prime (BBQPRI, BBQPRI+)
UPDATE public.packages
SET
  items_description_pt = 'Picanha Angus • Linguiça tradicional • Frango sobrecoxa desossada • Pão de alho • Queijo coalho • Milho • Carré de cordeiro • Salmão ou camarão • Costela de boi ou costela de porco • Chimichurri • Farofa • Mel • Goiabada • Pimenta de bico • Geleia de pimenta',
  package_highlights_pt = 'Carré de cordeiro • Salmão ou camarão • Costela de boi ou costela de porco • Experiência premium completa'
WHERE trim(coalesce(package_key, '')) ILIKE 'BBQPRI%';

-- Personalizado
UPDATE public.packages
SET
  items_description_pt = 'Itens definidos conforme necessidade do evento.',
  package_highlights_pt = 'Montado conforme necessidade do cliente • Itens definidos manualmente • Ideal para eventos customizados'
WHERE trim(coalesce(package_key, '')) ILIKE '%PERS%';

-- Guarnições — com (+)
UPDATE public.packages
SET
  garnish_description_pt = 'Arroz branco • Feijão preto • Vinagrete • Farofa • Mandioca',
  sides_description_pt = 'Arroz branco • Feijão preto • Vinagrete • Farofa • Mandioca'
WHERE trim(coalesce(package_key, '')) LIKE '%+';

-- Guarnições — sem
UPDATE public.packages
SET
  garnish_description_pt = 'Não inclusas',
  sides_description_pt = 'Não inclusas'
WHERE trim(coalesce(package_key, '')) NOT LIKE '%+'
  AND trim(coalesce(package_key, '')) NOT ILIKE '%PERS%';
