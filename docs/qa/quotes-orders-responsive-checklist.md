# Checklist Responsivo — Cotações e Ordens (Desktop / Tablet / Mobile)

**Branch:** `chore/quotes-orders-hardening-i18n-tests-dev`
**Data:** 2026-08-05
**Método:** revisão de código (classes utilitárias Tailwind responsivas: `sm:` `md:` `lg:`, `flex-wrap`, `overflow-x-auto`, `grid-cols-*`) + inspeção manual do layout de cada componente. **Não** substitui um passe visual em dispositivos reais/emulados antes de produção — ver seção "Pendências" ao final.

## Breakpoints de referência

| Rótulo | Largura | Uso no app |
|--------|---------|------------|
| Mobile | < 640px | `sm:` como piso |
| Tablet | 640–1024px | `md:` / `lg:` |
| Desktop | > 1024px | `lg:` / `xl:` em diante |

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Classes responsivas presentes e layout revisado — comportamento esperado OK |
| ⚠️ | Layout funcional mas sem breakpoints dedicados (depende de flex/wrap nativo do navegador) — recomenda-se confirmação visual |
| 🔲 | Não aplicável (painel usado dentro de modal/drawer que já é tratado no componente pai) |

## Matriz por componente

| Componente | Desktop | Tablet | Mobile | Observações |
|------------|---------|--------|--------|-------------|
| `components/QuotesDashboard.tsx` | ✅ | ✅ | ✅ | Grid de filtros e cards usa classes responsivas (`sm:`/`md:`); tabela de resultados com scroll horizontal em telas estreitas. |
| `components/orders/OrdersDashboard.tsx` | ✅ | ✅ | ✅ | Maior densidade de classes responsivas do módulo; filtros colapsam em coluna única em mobile, tabela com `overflow-x-auto`. |
| `components/orders/OrderDetailView.tsx` | ✅ | ✅ | ✅ | Seções (histórico/checklist/equipe) empilham verticalmente abaixo de `md:`; botões de ação com `flex-wrap`. |
| `components/quotes/QuoteConvertPanel.tsx` | ✅ | ✅ | ⚠️ | Painel compacto (título + descrição + botão); sem breakpoints dedicados, mas layout de coluna única já é mobile-friendly por padrão. Confirmar visualmente em telas muito estreitas (<360px). |
| `components/quotes/QuoteProposalSharePanel.tsx` | ✅ | ✅ | ⚠️ | Formulário empilhado por padrão (sem grid multi-coluna), portanto funciona em mobile sem breakpoints explícitos; botões de compartilhamento (WhatsApp/SMS/e-mail) devem ser conferidos quanto a `flex-wrap` em telas estreitas. |
| `components/quotes/QuoteTeamAssignmentPanel.tsx` | ✅ | ✅ | ✅ | Contém classes responsivas para campos de data/hora/equipe lado a lado em desktop e empilhados em mobile. |
| `app/quotes/[id]/QuoteDetailView.tsx` | ✅ | ✅ | ⚠️ | Documento de proposta ao cliente; grid de seções com classes responsivas parciais. Como é a tela voltada ao cliente final (link público), recomenda-se teste manual em Safari iOS/Chrome Android antes de divulgação ampla. |
| `app/quotes/[id]/QuotePdfDocument.tsx` | 🔲 | 🔲 | 🔲 | Gerado como PDF (react-pdf), não é HTML responsivo — layout fixo em A4/Letter, fora do escopo de breakpoints web. |
| `components/layout/CateringSidebar.tsx` (nav Agenda/Cotações/Ordens) | ✅ | ✅ | ✅ | Navegação lateral já usa padrão responsivo existente do shell (colapsa/drawer em mobile), reaproveitado sem alterações estruturais — apenas labels agora traduzidos via `getNavLabel`. |

## Cobertura de tabelas com muitas colunas

Tabelas de listagem (`QuotesDashboard`, `OrdersDashboard`) usam `overflow-x-auto` no container, garantindo rolagem horizontal em vez de quebra de layout em telas estreitas — comportamento já existente, preservado nesta rodada de hardening.

## Pendências (fora do escopo desta rodada de hardening)

- Passe visual manual (dispositivo real ou emulador) para os itens marcados ⚠️, especialmente:
  - `QuoteConvertPanel` e `QuoteProposalSharePanel` em telas < 360px.
  - `app/quotes/[id]/QuoteDetailView.tsx` (link público de proposta) em Safari iOS e Chrome Android.
- Nenhuma alteração estrutural de layout/CSS foi feita nesta rodada — apenas i18n (texto) e auditoria (backend). O risco de regressão visual é baixo, mas a confirmação manual acima é recomendada antes de promover para produção.

**Status desta rodada:** revisão de código concluída, sem achados bloqueantes. Classificado como **IMPLEMENTADO EM DEV — HARDENING** (não **VALIDADO**) até o passe visual manual acima ser executado.
