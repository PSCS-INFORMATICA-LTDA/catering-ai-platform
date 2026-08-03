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

## Outros helpers (interativos)

- `set-catering-dev-env.ps1` — `.env.local` + Vercel Dev/Preview
- `rotate-catering-dev-secret.ps1` — rotação de Secret DEV

Executar em PowerShell interativo (fora do agent NonInteractive).
