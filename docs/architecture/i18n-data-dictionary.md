# i18n + dicionário de dados / textos

**Ambiente:** DEV only  
**Status:** discovery + recomendação — **não mover traduções para banco nesta rodada**  
**Idiomas do produto:** `pt` · `en` · `es`

---

## 1. Sistema atual

Traduções **versionadas em TypeScript**, espalhadas por módulo:

| Fonte | Uso |
|-------|-----|
| `Lib/i18n/authUsers.ts` | login, usuários, perfil |
| `Lib/i18n/quotesOrders.ts` | OS, materiais, proposta chrome, conferência pública |
| `Lib/quoteTranslations.ts` | wizard de cotação (`getQuoteStrings(language)`) |
| `Lib/i18n/useAuthLocaleFromMe.ts` | locale da UI via `/api/auth/me` → `app_users.preferred_language` |
| Colunas `label_pt` / `label_en` / `label_es` | pacotes, permissões, alguns cadastros |
| `quotes.language` | idioma do **documento** (proposta/PDF/e-mail) |
| `customers.preferred_language` / equipe | idioma de contato/mensagem |

Não há dicionário central, metadata (`max_length`, `display_order`, `integration_name`) nem API de export/import.

---

## 2. Gaps

- Chaves duplicadas / naming inconsistente entre arquivos.
- Wizard usa `quote.language` (documento) também na UI do operador — mistura os dois eixos.
- Sem `max_length` para integração (WhatsApp, PDF, ERP).
- Sem override por tenant (franquia quer label própria).
- Nomes cadastrados (pacote, item, cliente) às vezes têm `label_*`, às vezes um único nome.
- Sem data dictionary para integradores (tabela/coluna/API name).

---

## 3. Idioma da UI vs idioma do documento

| Eixo | Fonte hoje | Deve ser |
|------------------|----------|
| Idioma do usuário (UI) | `app_users.preferred_language` | chrome do backoffice, menus, erros |
| Idioma do cliente/cotação | `quotes.language` | proposta, PDF, e-mail, mensagem compartilhada |

**Requisito Philippe:** operador em PT + cliente recebe cotação em EN, **sem** trocar a UI inteira.

Estado: o wizard ainda pinta steps com `state.language` (= documento). Evolução: UI do wizard no locale do usuário; preview/PDF no `quote.language`.

Fluxo futuro:

```
quote.language → proposal → PDF → e-mail → mensagem compartilhada
independentemente do locale do operador
```

Já parcialmente verdadeiro no PDF (`QuotePdfDocument` usa `quote.language`). Completar na UI do wizard.

---

## 4. Nomes cadastrados pelo cliente

**Não traduzir automaticamente:**

- nome do pacote
- nome do item
- nome do cliente

Só se houver tradução **explícita** (`label_en` já cadastrado, etc.).

Preparar (não criar agora):

- `catalog_item_translations (company_id, item_id, locale, name, description)`
- `package_translations` (ou continuar colunas `label_pt/en/es` no pacote — suficiente para 3 locales)

Fallback: locale pedido → `pt` → nome canônico.

---

## 5. Dicionário de TEXTOS / i18n (não confundir com schema)

Entidade conceitual `translation_dictionary`:

| Campo | Papel |
|-------|--------|
| id | |
| key | código estável (`quotes.materialLeftoverLabel`) |
| module | `auth` \| `quotes` \| `orders` \| `inventory` \| `agenda` … |
| context | UI, PDF, WhatsApp, email |
| pt_br / en_us / es | valores |
| max_length | integração |
| display_order | telas/export |
| data_type | `label` \| `help` \| `error` \| `message` |
| active | |
| description | para tradutor |
| created_at / updated_at | |

Opcional futuro: `integration_name`, `required`.

### Onde viver as traduções?

| Opção | Prós | Contras |
|-------|------|---------|
| A. só banco | editável em runtime | deploy sem review; drift; cold start |
| B. só arquivos versionados | PR/review, i18n type-safe | franquia não customiza |
| **C. híbrido (recomendado)** | git = default PSCS; banco = override por `company_id` | dois lugares para olhar |

**Recomendação SaaS:** **C — arquivos versionados + override opcional por empresa.**

- Default: TS/JSON no repo (fonte PSCS).
- Override: `translation_overrides (company_id, key, locale, value)` — futuro.
- Resolução: override tenant → arquivo → fallback `pt`.
- Não migrar as chaves atuais para banco nesta fase.

Versionamento: git (chaves novas = PR). Banco só override. Export/import futuro: CSV/JSON das chaves + overrides.

---

## 6. Dicionário de DADOS / schema (separado)

Não misturar com textos de UI.

Conceito (documentação/integradores — **não criar tudo no banco ainda**):

### `data_dictionary_entities`

Quote, ServiceOrder, CatalogItem, InventoryMovement, Event, …

Campos: `code`, `db_table`, `api_name`, `description`, `module`, `sensitive`, `financial`.

### `data_dictionary_fields`

| Campo | Papel |
|-------|--------|
| entity_code | |
| code / field_name | |
| db_table / db_column | |
| API name | |
| description | |
| type / length / precision / scale | |
| required | |
| PK / FK | |
| display_order | |
| sensitive / financial / translatable | |
| integration notes | |

Podem **relacionar** (`translatable=true` → chave no dicionário de textos), mas são catálogos distintos.

Entrega inicial recomendada: Markdown/YAML versionado em `docs/dictionary/` gerado a partir do schema — não tabela obrigatória.

---

## 7. Metadata para integração

Cada chave/campo (quando aplicável):

`code/key`, `description`, `module`, `field_name`, `data_type`, `max_length`, `decimal_places`, `display_order`, `required`, `locale`, `translation`, `integration_name`, `active`.

---

## 8. Recomendação de arquitetura (decisão Philippe)

1. **Manter** dicts TS como fonte da UI/PDF.
2. **Separar** locale do usuário × `quote.language` no wizard (quando for implementar).
3. **Não** criar `translation_dictionary` no Postgres agora.
4. Quando houver integrador: YAML de data dictionary + CSV de chaves i18n com `max_length`.
5. Override por tenant só quando houver segunda empresa real além de CDL.
6. Traduções de catálogo só com cadastro explícito.

---

## 9. Fora de escopo agora

- Mover todas as strings para banco
- Criar tabelas definitivas por suposição
- Autotraduzir nomes de cliente/pacote/item
- Production / main
