# i18n + dicionário de dados / textos

**Ambiente:** DEV only (`yasprgtlqclwsjcshtls`)
**Status:** fundação implementada (Git + registry + export + UI read-only)
**Idiomas:** `pt` · `en` · `es`

---

## 1. Três conceitos

| A. Data Dictionary | B. Translation Dictionary | C. Business data |
|--------------------|---------------------------|------------------|
| Entidades/campos/schema | Textos da aplicação | Nomes cadastrados pelo cliente |
| `Lib/dictionary/*` | `Lib/i18n/registry.ts` | `label_pt/en/es` (pacote/item) |
| Plataforma PSCS | Default Git; override tenant **futuro** | Sem autotradução |

Não misturar os três. Não há `company_id` no dicionário global.

---

## 2. Sistema de tradução (estado)

Fontes versionadas (não movidas para banco):

| Fonte | Uso |
|-------|-----|
| `Lib/i18n/authUsers.ts` | login, usuários, perfil |
| `Lib/i18n/chrome.ts` | shell: grupos do menu, itens, EMPRESA, tema |
| `Lib/i18n/quotesOrders.ts` | OS, materiais, lista de cotações, proposta chrome |
| `Lib/quoteTranslations.ts` | wizard (chrome da UI vs preview do documento) |
| `Lib/i18n/dictionaryUi.ts` | tela do dicionário |
| `Lib/i18n/registry.ts` | índice central das chaves |
| `app_users.preferred_language` | **idioma da UI** |
| `quotes.language` | **idioma do documento** |

Registry: `auth.*`, `chrome.*`, `quotesOrders.*`, `quotes.wizard.*`, `dictionary.*`.

Datas da UI usam `formatUiDate` / `toBcp47Locale` (pt-BR · en-US · es) — não `pt-BR` fixo.

---

## 3. Idioma UI vs documento vs OS

| Eixo | Fonte | Comportamento |
|------|--------|----------------|
| Usuário / UI | `preferred_language` via `/api/auth/me` | menus, botões, stepper do wizard, dicionário |
| Cotação / PDF | `quotes.language` | proposta, PDF, e-mail, labels de pacote no documento |
| OS operacional | **A — idioma do usuário** para UI | não troca o backoffice |
| OS documento | **B — preserva `quote.language` no snapshot** | histórico comercial |

Wizard: chrome usa `useAuthLocaleFromMe()`; seletor “Idioma da cotação” grava `quotes.language` sem mudar a UI do operador.

Fallback: locale pedido → pt → en → es → string vazia (**nunca** a chave).

---

## 4. Data Dictionary

- Entidades em `Lib/dictionary/entities.ts`.
- Campos = **colunas reais** via OpenAPI PostgREST (DEV). `max_length` só se o schema tiver (`varchar(n)`). `text`/`numeric` sem precisão no OpenAPI → `null`.
- Semântica (sensitive/financial/translatable) em `fieldSemantics.ts`.
- `INVENTORY_MOVEMENT`: entidade inativa, **0 campos**. **PENDENTE DE MAPEAMENTO JDE.**

Export: `npm.cmd run export:data-dictionary` → `scripts/dev/reports/` (gitignored).

UI: `/settings/dictionary` read-only. Não edita schema.

---

## 5. RBAC / RLS

Permissões: `data_dictionary.view`, `translation_dictionary.view` (owner/admin + platform admin).

**Decisão:** dictionary = **platform metadata**, não tenant-owned. Sem tabela Postgres, sem RLS, sem `company_id` artificial.

Override futuro (não implementado):

```
translation_overrides (company_id, translation_key, locale, value)
resolução: tenant override → default Git → fallback pt
```

---

## 6. Business data

Não traduzir automaticamente nome de cliente/pacote/item.

Pacotes já têm `label_pt/en/es`. Futuro (não criar agora): `catalog_item_translations`, `package_translations`.

---

## 7. Fora de escopo

- CMS de tradução
- Mover strings para banco
- Clone F4111 / P41202 / reservation
- Remodelar `operational_material_rules`
- Production / main
