# Catering AI - Manual de configuracao de pagamentos

Revisao: 2026-09-11. Escopo: DEV / Preview. PayPal Live, dinheiro real e PROD nao autorizados.

## Onde encontrar no aplicativo

Em Configuracoes > Pagamentos (`/settings/payments`), abrir **? Como configurar? Manual de pagamentos**. A mesma tela oferece ajuda contextual em Client ID, Client Secret, webhook, comprador Sandbox, Zelle e banco. O conteudo completo esta em portugues, ingles e espanhol e acompanha o idioma do usuario.

Fonte de verdade das tres traducoes: `Lib/payments/paymentSetupHelp.ts`. Interface acessivel: `components/settings/PaymentSetupHelp.tsx`. Nenhuma credencial ou dado bancario de cliente deve ser incluido neste documento ou nos testes.

## Empresa correta primeiro

Confira a empresa ativa no PSCS One. Cada empresa usa suas proprias credenciais e instrucoes de recebimento. Permissoes sao verificadas no servidor; abrir ajuda nao concede acesso administrativo. Ao mudar de empresa, o formulario deve reiniciar com os dados da nova empresa, sem reaproveitar rascunhos de outra.

## PayPal: Client ID e Client Secret

1. O responsavel entra no PayPal Developer: https://developer.paypal.com/dashboard/.
2. Abre Apps & Credentials, confirma Sandbox e seleciona a aplicacao da empresa. Cria uma somente se ainda nao existir.
3. Copia o Client ID e o Secret da mesma aplicacao. Quando necessario, usa Show para visualizar o Secret no PayPal.
4. Cola os valores apenas nos campos protegidos da empresa correta. Nunca em grupos, screenshots, chamados ou repositorios.
5. Para uma configuracao nova, usa Salvar configuracao e Testar conexao.

Client Secret nao e senha do comprador. O aplicativo mostra apenas Configurado/mascarado apos salvar; deixar vazio preserva o segredo. Uma empresa ja validada nao precisa trocar chaves para localizar uma conta compradora de teste.

Fonte oficial: https://developer.paypal.com/api/get-started/.

## Webhook

Apos validar uma configuracao nova, o gestor usa Configurar / atualizar webhook. O aplicativo registra a URL da empresa e preenche o Webhook ID, somente leitura. Para conferir, consulte os webhooks da mesma aplicacao no Developer. Nao copie IDs entre empresas/ambientes nem crie registros duplicados.

Ajuda nao executa configuracao. Conexao validada nao significa pagamento aprovado: ainda sao necessarias verificacoes de captura, webhook, invoice, reserva e agenda.

Fonte oficial: https://developer.paypal.com/api/rest/webhooks/rest/.

## Encontrar o comprador Sandbox

1. No Developer, abrir Testing Tools > Sandbox Accounts (ou Sandbox > Accounts).
2. Localizar **Personal**, o comprador; **Business** e o vendedor.
3. Abrir os tres pontos / Manage Accounts > View/Edit Account.
4. Consultar e-mail e senha de teste. Para redefinir, usar Profile > Change password.
5. Criar Personal somente se nenhuma conta adequada existir.
6. Abrir o link de QA autorizado e usar essa conta no checkout `sandbox.paypal.com`.

O acesso ao Developer e diferente do login comprador. Nunca usar conta/cartao real no checkout de teste. Nao armazenar senha do comprador no Catering AI. Compartilhar acesso, quando necessario, somente por canal privado apropriado.

Fonte oficial: https://developer.paypal.com/sandbox-testing/accounts/.

## Zelle

Confirmar nome do recebedor e telefone/e-mail registrado no banco com o responsavel da empresa. Preencher os campos e instrucoes para recebimento. Nunca cadastrar login bancario, senha, PIN ou codigo de verificacao.

Esse cadastro e de instrucoes; nao conecta automaticamente uma API Zelle nem confirma recebimentos. DEV nao transforma Zelle em Sandbox. Nao enviar dinheiro real para testar.

## Banco, ACH, Wire e cheque

Cadastrar banco, titular, conta e routing ACH; usar o campo separado para routing Wire. Preservar zeros iniciais e conferir o tipo de transferencia com o responsavel. Endereco do beneficiario e cheque nominal a tambem possuem campos separados. EIN nao substitui routing.

Salvar configuracao nao envia transferencia, nao marca invoice paga e nao reserva evento. Cheque informado nao significa compensado. O recebimento depende de conferencia autorizada. Dados reais de cada empresa ficam no cadastro restrito, nao no manual.

## Verificacao tecnica

Executar em Node 22.6+ (Node 24 no Preview):

```sh
node --experimental-strip-types scripts/dev/test-payment-setup-help.mjs
node --experimental-strip-types scripts/dev/test-offline-payment-metadata.mjs
```

Os testes cobrem conteudo PT/EN/ES, links oficiais, ausencia de dados de cliente, disclosure sem chamadas de rede, metadados permitidos, campos opcionais de clientes antigos, preservacao de zeros, limites e guardas de empresa. Nao substituem build, validacao autenticada desktop/mobile, isolamento A/B, nem QA de pagamento de ponta a ponta.

A inicializacao dos provedores usa `ignoreDuplicates` para nao reativar metodos desabilitados a cada visita. O formulario usa `key={companyId}` para limpar estado local ao trocar de empresa.

## Limite de entrega

Manter o PR aberto e sem merge enquanto faltar aprovacao Sandbox do comprador e verificacao de capture, webhook, invoice e reserva/agenda. Nenhuma etapa do manual libera Live/PROD automaticamente.
