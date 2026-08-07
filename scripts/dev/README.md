# scripts/dev — Catering DEV helpers

Ferramentas exclusivas do ambiente **catering-ai-platform-DEV**.

| | |
|---|---|
| Project Ref permitido | `yasprgtlqclwsjcshtls` |
| Project Ref proibido | `eapwtirhevxrqinytans` (PROD) |

Nunca apontar estes scripts para Production.

## Base funcional de validação (fixture v1)

Arquivos:

- `fixtures/catering-functional-validation-v1.json` — IDs estáveis e metadados
- `seed-catering-functional-validation.mjs` — dry-run / apply / verify
- `verify-catering-functional-validation.mjs` — wrapper `--verify`
- `cleanup-catering-functional-validation.mjs` — limpeza opcional (não automática)

### Comandos

```bash
npm run seed:dev:functional:dry    # padrão seguro — sem escrita
npm run seed:dev:functional        # --apply no DEV
npm run verify:dev:functional      # contagens e chaves TEST-DEV-*
```

Equivalente direto:

```bash
node scripts/dev/seed-catering-functional-validation.mjs           # dry-run
node scripts/dev/seed-catering-functional-validation.mjs --apply
node scripts/dev/seed-catering-functional-validation.mjs --verify
```

### O que a base cria

- Empresa principal CDL (mesmo UUID da app: `65fd576f-…`) + branch
- Empresa de isolamento (sem membership do usuário principal)
- 4 categorias (`package_categories`) PT/EN/ES
- 3 pacotes `TEST-DEV-PKG-*` + 1 pacote isolamento
- Itens de pacote + 4 adicionais (pessoa / unidade / taxa / staff)
- Cliente e evento fictícios
- Cotação `TEST-DEV-QUOTE-001` com totais via fórmula espelhada de `Lib/calculateQuoteTotals.ts`

Dados são 100% fictícios. Sem cópia de PII de PROD.

### Idempotência

Upsert por `id` estável + códigos `TEST-DEV-*`. Segunda execução não deve duplicar.

### Membership

Só associa `company_memberships` se existir **exatamente 1** usuário em `auth.users` no DEV. Caso 0 ou >1: `PENDENTE — selecionar usuario DEV para membership`.

### Cleanup futuro

```bash
node scripts/dev/cleanup-catering-functional-validation.mjs --confirm-dev-cleanup
```

Remove apenas IDs do fixture. Não apaga a empresa principal CDL (default da app).

## Datas comemorativas / feriados EUA (pedido mínimo + acréscimo 100%)

Fixture + seed para validar comportamento das cotações em:

- **Feriados federais dos EUA** (New Year’s, MLK, Presidents’ Day, Memorial Day, Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas) + dias observados (sáb→sex, dom→seg)
- **Extras CDL:** 24 e 31 de dezembro
- Controles: dia útil e dezembro regular (mín. $900, sem +100%)

```bash
npm run seed:dev:commemorative-dates:dry   # matrix + plano
npm run seed:dev:commemorative-dates       # --apply no DEV
npm run verify:dev:commemorative-dates     # compara DB vs esperado
npm run report:dev:commemorative-dates     # verify + relatório JSON
npm run test:dev:commercial-minimums      # unitário do motor
```

Pré-requisito: `npm run seed:dev:functional` (empresa/cliente/pacote).

Cotações: `TEST-DEV-QUOTE-HOL-*` — abrir em `/quotes` no Preview DEV.

## Pedido de guarnição ao fornecedor (WhatsApp na OS)

Fixture + seed para validar o painel **Pedido de guarnição (fornecedor)** na OS.
Packing **HC–HK** vem de `commercial_rules.supplier_garnish_kit_packing` (por empresa).
Sem regra ativa, cai no modelo por porções (não herda CDL).

```bash
npm run seed:dev:supplier-garnish-kit-rule:dry
npm run seed:dev:supplier-garnish-kit-rule   # upsert da regra CDL no DEV
```

- 2 fornecedores (`customers.is_supplier`) com telefone
- OSs com equipe Caio + evento de agenda
  - `TEST-DEV-OS-SUP-GAR` — pacote com guarnições inclusas (BBQPRI+)
  - `TEST-DEV-OS-SUP-ADD` — BBQPRI + 2 sides como adicional
  - `TEST-DEV-OS-SUP-MULTI-A` — BBQPRI + **4** sides (40 convidados → 1 kit grande)
  - `TEST-DEV-OS-SUP-MULTI-B` — BBQPRI + **3** sides (25 convidados → 1 kit pequeno)
  - `TEST-DEV-OS-SUP-REAL` — BBQPRI + **4** sides (48 convidados → 1 kit grande)

```bash
npm run seed:dev:supplier-garnish:dry   # plano sem escrita
npm run seed:dev:supplier-garnish       # --apply no DEV
npm run verify:dev:supplier-garnish     # confere OS + agenda + fornecedores
npm run test:dev:supplier-garnish-message  # unitário do texto WhatsApp
```

Arquivos: `fixtures/supplier-garnish-order-v1.json`, `seed-supplier-garnish-order.mjs`.

Validação UI (Preview DEV): `/orders/<serviceOrderId>` → painel de share; fornecedores em Clientes (filtro Fornecedor).

## Seed demo — equipes + agenda (fins de semana)

```bash
node scripts/dev/seed-agenda-teams-demo.mjs --apply
```

Cria 4 equipes (Ricardo, Filipe, Caio, Maicon) com cores e 2 membros cada,
mais 8 eventos (sábado/domingo 08–09/08/2026) no DEV.

## Copiar catálogo + regras comerciais CDL de PROD → DEV

Script principal (recomendado para teste fiel de cotação/billing):

`sync-cdl-commercial-prod-to-dev.mjs`

- **PROD** (`.env.local.PROD-BACKUP`): somente leitura
- **DEV** (`.env.local`): upsert
- Copia: `commercial_rules`, `payment_rules`, `staff_rules`, `quote_text_templates`,
  pacotes, categorias, catálogo, opções, preços, empresa/branch
- Copia imagens para o storage DEV
- **Não** copia clientes, cotações, eventos nem PII
- PROD nunca é escrito

```bash
node scripts/dev/sync-cdl-commercial-prod-to-dev.mjs           # dry-run
node scripts/dev/sync-cdl-commercial-prod-to-dev.mjs --apply   # grava no DEV (+ imagens)
```

Scripts auxiliares:

```bash
node scripts/dev/sync-cdl-packages-prod-to-dev.mjs --apply          # só catálogo/pacotes
node scripts/dev/sync-cdl-package-images-prod-to-dev.mjs --apply   # só imagens
```

## Outros helpers (interativos)

- `set-catering-dev-env.ps1` — `.env.local` + Vercel Dev/Preview
- `rotate-catering-dev-secret.ps1` — rotação de Secret DEV

Executar em PowerShell interativo (fora do agent NonInteractive).
