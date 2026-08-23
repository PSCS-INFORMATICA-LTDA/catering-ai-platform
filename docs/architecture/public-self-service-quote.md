# Public Self-Service Quote V1

**Status:** EM IMPLEMENTAÇÃO; após todos os gates, o máximo é PRONTO PARA VALIDAÇÃO em DEV e a aprovação visual de Philippe continua obrigatória  
**Ambiente autorizado:** Supabase DEV `yasprgtlqclwsjcshtls` + Vercel Preview/alias DEV  
**Alias DEV:** `https://catering-ai-agenda-dev.vercel.app`  
**Regra absoluta:** NUNCA PROD — não usar `vercel --prod`, não aplicar migrations no projeto `eapwtirhevxrqinytans` e não copiar dados/segredos entre ambientes.

## Objetivo e limites

O Public Self-Service Quote V1 transforma a entrada de cotação em uma experiência pública, multiempresa e PT/EN/ES. O cliente preenche a solicitação; o backoffice continua responsável por revisar, corrigir, aprovar, enviar, converter e acompanhar.

O V1 preserva estas fronteiras:

- um único núcleo de wizard para entrada pública e entrada interna;
- tenant resolvido no servidor pelo slug público, nunca por `company_id` livre do browser;
- catálogo público projetado por allowlist;
- preço recalculado pelo Pricing SSOT no servidor;
- customer, event e quote reais somente na finalização;
- nenhuma alteração no fluxo Quote → OS, sinal → Agenda, Inventory, supplier garnish, PDF ou proposta pública existente;
- schema aditivo e compatível com o backoffice atual.

## Rotas e composição

Rota canônica para Linktree:

```text
/quote/[companySlug]/[locale]
```

Locales aceitos: `pt`, `en` e `es`. Slug inexistente, desativado ou locale fora da whitelist retorna experiência genérica de indisponibilidade/404 sem confirmar a existência de dados administrativos.

Endpoints públicos do intake:

- `POST /api/public/quote-intake/session` — cria ou retoma a sessão opaca;
- `POST /api/public/quote-intake/preview` — recalcula estimativa no servidor;
- `POST /api/public/quote-intake/upload` — valida e persiste a foto da churrasqueira;
- `POST /api/public/quote-intake/submit` — finaliza a solicitação de forma idempotente.

As quatro rotas são adaptadores estreitos. Regras compartilhadas de validação, tenant, sessão, catálogo e submissão ficam sob `Lib/publicQuote/**`; handlers não mantêm implementações divergentes.

Composição obrigatória:

```text
Authenticated new-quote entry ─┐
                               ├─ QuoteWizardCore
PublicQuoteShell ───────────────┘  ├─ contato
                                  ├─ evento/endereço
                                  ├─ pacote
                                  ├─ adicionais
                                  ├─ churrasqueira
                                  └─ revisar e enviar
```

`PublicQuoteShell` altera somente layout, identidade, mensagens e permissões. Ele não possui state, regras comerciais ou persistence paralelos. A entrada autenticada resolve tenant/idioma pela sessão e abre o mesmo core em modo assistido. A edição administrativa existente continua separada por ser uma operação de revisão, não outro formulário de entrada.

Mapa de implementação:

- `app/quote/[companySlug]/[locale]/page.tsx` — bootstrap server-side sanitizado;
- `app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx` — landing, shell e sucesso;
- `app/quotes/new/QuoteWizard.tsx` — export default `QuoteWizardCore`, núcleo único;
- `app/quotes/new/page.tsx` — entrada autenticada do mesmo núcleo;
- `Lib/publicRoutes.ts` — fonte única dos matchers públicos usados por middleware/shell/provider;
- `Lib/publicQuote/**` — contratos e serviços server-side do intake.

Submissões públicas usam `source = public_self_service`. Quando o lifecycle registrar a origem assistida separadamente, a entrada interna usa `source = assisted_self_service`; essa distinção não muda validação, pricing ou persistence do core.

O shell público não monta sidebar, seletor de empresa, menu compacto, status operacional, logout ou links de backoffice. Ele mostra logo/nome da empresa, progresso, suporte opcional e a atribuição discreta “Powered by Catering AI”.

## Fronteiras de confiança

```text
Browser público
  ├─ slug + locale
  ├─ draft do cliente
  ├─ cookie opaco de intake
  └─ idempotency key
        │
        ▼
API/RPC pública sanitizada
  ├─ resolve empresa habilitada
  ├─ valida sessão, origem e payload
  ├─ aplica rate limit/honeypot
  ├─ valida contato/endereço/upload
  ├─ carrega catálogo público
  ├─ recalcula Pricing SSOT
  └─ finaliza customer + event + quote em transação
        │
        ▼
Supabase DEV com RLS e funções de escopo mínimo
```

O browser não recebe service role, UUID interno como credencial, lista de customers, custo, margem, fornecedor, estoque, notas internas, feature flags administrativas ou metadados de auditoria.

## Configuração pública por empresa

A configuração pública é company-scoped e possui uma única fonte de verdade. A projeção pública contém somente os campos necessários à landing e ao wizard:

- `public_quote_enabled`;
- `public_slug` ou o `companies.slug` canônico quando único e adequado;
- `default_language` e `allowed_languages`;
- logo e nome exibível;
- hero/media pública;
- título, subtítulo e introdução PT/EN/ES;
- países atendidos/default country;
- contato/WhatsApp opcional;
- texto e URL de privacidade/consentimento, com versão;
- cores semânticas aprovadas.

Dados administrativos não são expostos por `SELECT *`. A resposta pública usa DTO explícito e `Cache-Control` compatível com ativação/desativação rápida da feature.

### Temas de pacote

`card_theme_key` aceita somente tokens semânticos:

```text
gold | bronze | navy | emerald | burgundy | slate
```

O banco não armazena CSS arbitrário. A UI traduz a chave para classes/tokens locais e preserva contraste, borda, badge e texto; cor nunca é o único indicador de seleção.

## Sessão pública e retomada

Uma sessão de intake é criada somente depois que o cliente inicia o fluxo. O token enviado ao browser é aleatório e opaco; o banco armazena apenas `token_hash` criptográfico. O cookie é `HttpOnly`, `Secure` no ambiente hospedado, `SameSite=Lax` ou mais restritivo, tem path mínimo e expiração alinhada a `expires_at`.

A sessão contém, no mínimo:

- `company_id` resolvido pelo slug;
- locale validado;
- versão/schema do draft;
- draft sanitizado;
- status e timestamps;
- `expires_at`/`revoked_at`;
- hash da chave de idempotência ou restrição equivalente;
- `quote_id` somente depois da finalização.

`proposal_token` não é reutilizado: ele representa uma proposta já enviada e possui semântica diferente. Retentativas do mesmo submit retornam o mesmo resultado; não criam customer, event ou quote duplicados.

## Segurança HTTP e abuso

Todas as entradas públicas passam por validação server-side. Os controles mínimos são:

- limite de tamanho de JSON e upload;
- MIME permitido e inspeção server-side do arquivo;
- rate limit por combinação segura de sessão/IP/tenant;
- honeypot silencioso;
- idempotency key;
- validação de `Origin`/`Host` quando aplicável;
- mensagens genéricas sem enumeração de customer, telefone ou e-mail;
- logs sem nome, telefone, e-mail, endereço, token cru ou notas;
- expiração/revogação de sessão;
- nenhuma chave `SUPABASE_SERVICE_ROLE_KEY` em `NEXT_PUBLIC_*`.

Falhas esperadas usam códigos estáveis (`invalid_payload`, `expired`, `rate_limited`, `already_submitted`) e não retornam mensagens internas do Postgres.

## RLS, grants e funções públicas

As tabelas administrativas permanecem com RLS habilitada. O papel `anon` não recebe `SELECT` amplo em `companies`, `customers`, `events`, `quotes`, catálogo ou regras comerciais, nem `INSERT ALL` em quotes.

Quando uma função pública `SECURITY DEFINER` for necessária, ela deve:

1. fixar `search_path` explícito;
2. validar slug, feature, locale, token hash, expiração e status;
3. projetar somente colunas públicas;
4. limitar o escopo a uma empresa;
5. bloquear tenant mismatch;
6. ser concedida apenas para as assinaturas necessárias;
7. ter `PUBLIC` revogado quando aplicável;
8. manter mutações finais atômicas e idempotentes.

O padrão recomendado para tokens é o já usado pelas confirmações mais recentes: hash SHA-256, índice único parcial, expiração, revogação e RPC pública estreita. Os fluxos legados de proposta/designação que guardam bearer token em texto não são modelo para o intake.

## Catálogo público

O DTO público pode conter somente:

- pacotes ativos e publicáveis;
- labels, descrições, highlights e guarnições públicas;
- preços necessários para estimativa;
- adicionais ativos para audiência customer;
- imagens públicas autorizadas;
- traduções PT/EN/ES;
- regras comerciais necessárias para copy/estimativa;
- `card_theme_key` validado pela whitelist.

São proibidos no DTO: `cost_price`, margem/markup, fornecedor, inventário, notas internas, itens ocultos, metadata de admin, IDs de outras empresas e segredos. A consulta deve ser set-based para evitar N+1.

## Fluxo funcional

### 1. Landing

A landing mostra marca da empresa, introdução, três passos, tempo estimado e CTAs no topo/fim. Landing não conta como etapa do progresso.

### 2. Contato

Campos públicos: nome, sobrenome, telefone obrigatório e e-mail opcional. Nome/sobrenome aceitam acento, espaço, hífen e apóstrofo; rejeitam valor vazio ou somente numérico. Telefone é normalizado preferencialmente para E.164 com país da configuração. E-mail vazio é válido; e-mail preenchido deve ser válido.

O público nunca pesquisa customers. Na finalização, o servidor procura match seguro por telefone normalizado dentro do mesmo `company_id`. Match ambíguo não sobrescreve cadastro existente.

### 3. Evento e endereço

`event_name` é derivado novamente no servidor de nome + sobrenome. A UI não permite editar esse campo.

O endereço é address-first:

```text
Endereço completo | ZIP/CEP
Número | Cidade | Estado
```

Uma seleção Google canônica preserva `place_id`, endereço formatado, rua, número, cidade, estado, postal code, país e, quando disponíveis, latitude/longitude. Alterar o texto depois da seleção invalida o Place. Se Google estiver indisponível, um fallback manual explícito e validado é permitido; ele não finge possuir Place canônico.

Data não pode estar no passado sem regra autorizada; fim deve ser posterior ao início. Contagens físicas e billable são recalculadas no servidor.

### 4. Pacote e adicionais

Pacotes mantêm seleção, highlights, guarnições, traduções e pricing atuais. Adicionais continuam opcionais, com accordion e quantidades. Estados internos como “Reviewed” não aparecem no modo público.

### 5. Churrasqueira

O cliente responde se há churrasqueira no local. Se houver, envia foto real; preview por `blob:` não é persistência. Upload aceita apenas formatos/tamanho definidos, usa caminho company/session-scoped e associa media somente na finalização.

Se não houver churrasqueira, o cliente escolhe aluguel. Quantidade é obrigatória e maior que zero apenas quando aluguel está ativo. O modo público não mostra “foto recebida?”, checklist interno nem banner de pendência antes da interação.

### 6. Revisar, consentir e enviar

A revisão mostra somente dados do cliente e resumo financeiro/comercial. Consentimento de contato e aceite da política de privacidade são obrigatórios e registram timestamp, locale, source e versão do texto.

Na finalização atômica, o servidor:

1. valida sessão, tenant, locale, expiração, honeypot e idempotência;
2. valida contato, evento, endereço, catálogo, grill, upload e consentimento;
3. resolve/cria customer sem enumeração ou merge destrutivo;
4. cria event com nome derivado;
5. recalcula o Pricing SSOT completo;
6. cria quote e seleções;
7. persiste `pricing_breakdown` e snapshot;
8. associa media;
9. define `source = public_self_service`;
10. usa o status válido de revisão (`ready_for_review`, quando suportado pelo lifecycle);
11. finaliza a sessão e grava o resultado idempotente.

O browser nunca define total, sinal, saldo, desconto, mileage, surcharge ou minimum adjustment finais.

Quando as APIs Google de rota não estiverem autorizadas ou disponíveis no servidor, a solicitação não aceita distância informada pelo browser e não inventa uma cobrança. O servidor usa distância zero apenas na estimativa, grava `mileageStatus = pending_review` no snapshot e a UI avisa que o deslocamento será confirmado pela equipe antes da aprovação. A quote permanece `ready_for_review`; configurar uma chave server-side de Routes API elimina essa pendência.

### 7. Sucesso

Depois do submit, uma view/rota separada mostra número da solicitação, nome, data, resumo e próximos passos. Ela não promete disponibilidade, não expõe IDs internos e não retorna ao wizard. WhatsApp aparece apenas quando configurado.

## Aplicação em DEV

Antes de qualquer comando, o worktree deve estar limpo e sincronizado com a branch-base atual. Confirmar explicitamente:

```powershell
git status --short --branch
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/feat/quote-wizard-v2-dev
npm.cmd run env:dev:check
```

Revisar migrations e destino antes de escrever:

```powershell
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run
```

Aplicação autorizada somente se o link confirmado for `yasprgtlqclwsjcshtls`:

```powershell
npx.cmd supabase db push --linked
```

Nunca executar `db reset`, `truncate`, limpeza ampla ou qualquer comando conectado a `eapwtirhevxrqinytans`.

## Verificação DEV

Gate estático, sem rede e sem mutação:

```powershell
node scripts/dev/test-public-self-service-quote.mjs
node scripts/dev/configure-public-self-service-quote.mjs --verify
node scripts/dev/test-public-quote-runtime.mjs --base-url=http://127.0.0.1:3100
node scripts/dev/test-public-quote-submit.mjs --base-url=http://127.0.0.1:3100
git diff --check
npm.cmd run lint
npm.cmd run build -- --webpack
```

O teste estático verifica rota/locale, core único, DTO público, sessão segura, abuso/idempotência, tenant, Pricing SSOT, address-first, grill, consentimento/sucesso, lifecycle e temas. Ele não prova RLS nem comportamento de browser.

Gate de integração no Supabase DEV:

- slug válido, inválido e feature desativada;
- catálogo sanitizado e sem enumeração;
- company isolation em leitura e submit;
- token hash, expiração e revogação;
- rate limit/honeypot/payload limit;
- customer match/criação/ambiguidade;
- event, quote, seleções, breakdown e snapshot;
- idempotência e submit concorrente;
- upload MIME/tamanho/escopo;
- `source`, language, status e consentimento.

Fixtures devem ser identificáveis, company-scoped, idempotentes e possuir cleanup restrito aos próprios IDs. Testes que escrevem devem abortar se o ref não for DEV. Os dois testes runtime acima usam contato fictício, validam upload/finalização/idempotência e executam cleanup em `finally`.

Gate E2E público, sem login, para `/quote/cdl/pt`, `/quote/cdl/en` e `/quote/cdl/es`:

- landing e CTA;
- contato e validações;
- evento/address-first e fallback;
- pacote/tema/guarnições;
- adicionais opcionais;
- churrasqueira, foto e aluguel;
- revisão, consentimento, submit e sucesso;
- verificação da quote no backoffice/DB DEV;
- invalid slug/locale/session e double-submit.

Gate E2E interno: autenticar no DEV, abrir “Nova cotação”, confirmar o mesmo core, tenant/idioma corretos, criar quote e revisá-la no backoffice.

Gate mobile: iPhone e Android, incluindo teclado de telefone, autocomplete, câmera/arquivo, sticky CTA, sem overflow e touch targets de pelo menos 44 px.

Enquanto não houver runner browser versionado, a validação com browser integrado é evidência manual, não substituto de Playwright/Cypress. Registrar viewport, idioma, URL do Preview, commit e screenshots.

## Deploy DEV

O worktree da feature deve estar explicitamente ligado ao projeto Vercel `catering-ai-platform`; não confiar em inferência do `npx --yes` quando `.vercel/project.json` estiver ausente.

Ordem:

1. registrar commit/branch e deployment atualmente apontado pelo alias DEV;
2. executar todos os gates;
3. criar Vercel Preview sem `--prod`;
4. aguardar estado `READY`;
5. verificar HTTP, assets, rotas PT/EN/ES e E2E no URL imutável;
6. obter aprovação técnica;
7. somente então mover `catering-ai-agenda-dev.vercel.app` para o deployment validado;
8. repetir smoke no alias.

O status máximo antes da revisão visual de Philippe é **PRONTO PARA VALIDAÇÃO**.

## Rollback DEV

Rollback não envolve Production.

1. Desativar `public_quote_enabled` no tenant DEV como kill switch, preservando backoffice e dados.
2. Reatribuir `catering-ai-agenda-dev.vercel.app` ao deployment Preview anterior registrado no gate de deploy.
3. Confirmar HTTP e regressões das rotas internas e propostas públicas existentes.
4. Revogar/finalizar sessões de intake DEV afetadas, se necessário, sem apagar quotes válidas.
5. Preferir migration corretiva forward-only. Como o schema é aditivo, manter tabelas/colunas inativas é mais seguro que `DROP` emergencial.
6. Se rollback SQL for indispensável, revisar dependências, fazer backup DEV e limitar a operação a objetos/fixtures desta feature; nunca usar reset/truncate.

## Checklist de saída

- [ ] worktree limpo e feature branch baseada no HEAD remoto atual;
- [ ] PROD não foi lido para sync nem alterado;
- [ ] rota pública PT/EN/ES sem login;
- [ ] landing e shell sem chrome administrativo;
- [ ] mesmo core na entrada pública e interna;
- [ ] DTO público por allowlist;
- [ ] sessão hash/expiry/revoke/cookie seguro;
- [ ] RLS/grants/RPC revisados;
- [ ] rate limit, honeypot, payload e idempotência;
- [ ] tenant resolvido por slug;
- [ ] address-first e fallback controlado;
- [ ] upload real e seguro;
- [ ] Pricing SSOT server-side;
- [ ] consentimento versionado;
- [ ] `source`/language/status corretos;
- [ ] unit/static, integração, E2E PT/EN/ES, interno e mobile PASS;
- [ ] lint/build PASS;
- [ ] Preview `READY` e smoke PASS;
- [ ] alias DEV movido somente após PASS;
- [ ] deployment anterior registrado para rollback;
- [ ] validação visual de Philippe ainda pendente ou registrada.
