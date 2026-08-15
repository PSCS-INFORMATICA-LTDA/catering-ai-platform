# Codex Cloud — ambiente de desenvolvimento DEV

**Owner:** Philippe  
**Repositório:** `PSCS-INFORMATICA-LTDA/catering-ai-platform`  
**Ambiente padrão:** DEV  
**Branch-base funcional:** `feat/quote-wizard-v2-dev`  
**PROD:** proibido sem aprovação explícita de Philippe.

## Objetivo

Usar o ChatGPT/Codex como ambiente principal de desenvolvimento do Catering AI, com alterações isoladas por branch, validação automática, PR em Draft e Preview da Vercel antes de qualquer merge.

## Configuração do ambiente Codex

| Item | Valor |
|---|---|
| Nome | `Catering AI Platform DEV` |
| Repositório | `PSCS-INFORMATICA-LTDA/catering-ai-platform` |
| Branch por tarefa | partir de `feat/quote-wizard-v2-dev` |
| Node.js | 22.x |
| Setup script | `npm ci` |
| Maintenance script | `npm ci` |
| Internet durante o agente | desligada por padrão |

O setup não deve iniciar `npm run dev`, pois servidores de longa duração impedem a conclusão da preparação do ambiente.

## Variáveis DEV

Configurar no ambiente Codex apenas as variáveis necessárias ao build e à execução segura do aplicativo:

| Nome | Classificação | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | variável DEV | URL do projeto `yasprgtlqclwsjcshtls` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | variável DEV | chave pública anon do Supabase DEV |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | variável DEV restrita | somente quando o fluxo de mapas for testado |

Não colocar no ambiente executado pelo agente:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_ACCESS_TOKEN`;
- `VERCEL_TOKEN`;
- qualquer credencial ou variável de PROD.

O Codex Cloud remove secrets depois do setup. Não contornar essa proteção escrevendo secrets em `.env.local`, `~/.bashrc` ou qualquer arquivo do container.

## Supabase

- Projeto autorizado: DEV `yasprgtlqclwsjcshtls`.
- Não linkar nem consultar PROD por padrão.
- Não executar `db reset`, `truncate` ou migrations destrutivas.
- Mudanças de banco exigem migration versionada, dry-run/validação e autorização dentro do escopo DEV.
- Operações que exigem service role são executadas por integração autorizada, não pelo runtime do agente.

## Vercel

- O Preview deve ser criado automaticamente quando a branch/PR for publicada no GitHub.
- Nunca executar `vercel --prod`.
- Produção não é promovida automaticamente.
- Philippe e Caio validam o Preview quando a alteração fizer parte do piloto operacional.

## Validação mínima por tarefa

Executar o conjunto proporcional ao escopo:

```bash
npm ci
npm run lint -- <arquivos alterados>
npx tsc --noEmit
npm run build
```

Quando houver um script funcional específico no `package.json`, executá-lo também. Falhas preexistentes fora do escopo devem ser registradas no PR, sem alterações oportunistas.

## Entrega

1. Criar branch própria a partir da baseline DEV.
2. Alterar somente o escopo solicitado.
3. Executar validações.
4. Revisar o diff e confirmar ausência de secrets.
5. Publicar commit e abrir PR em Draft.
6. Aguardar Preview da Vercel.
7. Entregar link, evidências, riscos e pendências.
8. Não fazer merge sem aprovação de Philippe.

