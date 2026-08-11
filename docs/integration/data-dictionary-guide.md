# Guia — Data Dictionary + traduções (integrações)

**Ambiente:** DEV
**Branch:** `feat/data-dictionary-i18n-foundation-dev`
**Metadata:** plataforma PSCS (Git). **Não** é dado de tenant.

---

## Finalidade

Entregar a integradores (e ao time) um catálogo de:

- entidades e campos reais do schema;
- tipo / tamanho (quando o banco define);
- PK/FK;
- flags: sensível, financeiro, traduzível;
- textos de UI PT/EN/ES.

O dicionário **não** altera colunas, constraints ou migrations.

---

## Três catálogos (não misturar)

| Catálogo | O que é | Onde vive |
|----------|---------|-----------|
| **Data Dictionary** | Descrição técnica dos dados | `Lib/dictionary/*` + schema live (OpenAPI) |
| **Translation Dictionary** | Textos da aplicação | `Lib/i18n/*` + `quoteTranslations.ts` + registry |
| **Business data translation** | Nome de pacote/item/cliente | `label_pt/en/es` já no cadastro; tabelas `*_translations` **futuras** |

---

## Export

```
npm.cmd run export:data-dictionary
```

Gera (gitignored):

- `scripts/dev/reports/data-dictionary.csv` — Excel
- `scripts/dev/reports/data-dictionary.json` — integração

Somente metadata. **Nenhuma linha de cliente/cotação.**

JSON (conceito):

```json
{
  "entity": "SERVICE_ORDER",
  "table": "service_orders",
  "fields": []
}
```

CSV: Module, EntityCode, Table, Column, APIName, DataType, MaxLength, Precision, Scale, Required, PK, FK, Sensitive, Financial, Translatable, …

`MaxLength` / `Precision` / `Scale` vazios = **não definido no schema** (`text`/`numeric` sem limite no OpenAPI). Não inventamos 50/100.

---

## Idiomas

| Eixo | Fonte | Controla |
|------|--------|----------|
| UI do usuário | `app_users.preferred_language` | menus, botões, labels, erros |
| Documento | `quotes.language` | proposta, PDF, e-mail, mensagem ao cliente |
| OS (UI) | idioma do usuário | backoffice da OS |
| OS (histórico) | snapshot da quote | metadata do evento/documento |

Exemplo: operador PT + cotação EN → backoffice PT, PDF EN.

Fallback de texto: locale pedido → `pt` → `en` → `es` → `''` (nunca a chave crua).

---

## Flags

- **sensitive:** e-mail, telefone, documento, token, notas internas. Metadata — **não substitui RBAC**.
- **financial:** preços, totais, descontos, taxas, reserva. Metadata — **não substitui** `orders.financial.view`.

---

## RBAC

`data_dictionary.view` · `translation_dictionary.view`  
Somente **owner / admin** (+ platform admin).

Tela: Configurações → Dicionário de dados (`/settings/dictionary`) — **read-only**.

---

## Integração futura (não nesta rodada)

JSON Schema, OpenAPI mapping, Excel empacotado, API pública versionada.

Override por empresa (`translation_overrides`) — projetado, não implementado.

---

## Estoque / JDE

**PENDENTE DE MAPEAMENTO JDE.** Entidade `INVENTORY_MOVEMENT` existe como reserva, **sem campos**.
