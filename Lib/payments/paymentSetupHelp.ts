/** Static, tenant-neutral help. Never add credentials or customer banking data here. */
export type HelpText = { pt: string; en: string; es: string }
const tr = (pt: string, en: string, es: string): HelpText => ({ pt, en, es })
export const PAYMENT_HELP_REVIEWED_AT = '2026-09-11'
export const paymentHelpLabels = {
  title: tr('Como configurar? Manual de pagamentos', 'How do I set this up? Payment guide', '\u00bfC\u00f3mo configurar? Manual de pagos'),
  sources: tr('Links e documenta\u00e7\u00e3o oficial', 'Links and official documentation', 'Enlaces y documentaci\u00f3n oficial'),
  reviewed: tr('Revisado em', 'Reviewed on', 'Revisado el'),
  warning: tr('DEV: apenas configura\u00e7\u00e3o e PayPal Sandbox. N\u00e3o envie dinheiro real. Abrir esta ajuda n\u00e3o salva nem altera configura\u00e7\u00f5es.', 'DEV: configuration and PayPal Sandbox only. Do not send real money. Opening this help does not save or change settings.', 'DEV: solo configuraci\u00f3n y PayPal Sandbox. No env\u00ede dinero real. Abrir esta ayuda no guarda ni cambia la configuraci\u00f3n.'),
  wireRoutingNumber: tr('Routing para Wire', 'Wire routing number', 'Routing para Wire'),
  paymentAddress: tr('Endere\u00e7o do benefici\u00e1rio', 'Beneficiary address', 'Direcci\u00f3n del beneficiario'),
  checkPayableTo: tr('Cheque nominal a', 'Check payable to', 'Cheque a nombre de'),
}
export const paymentHelpSections = {
  company: {
    title: tr('Empresa e permiss\u00f5es', 'Company and permissions', 'Empresa y permisos'),
    steps: [
      tr('Confira a empresa ativa no PSCS One antes de preencher. Cada empresa usa os pr\u00f3prios dados; nunca copie credenciais de outra empresa.', 'Check the active company in PSCS One first. Each company uses its own details; never copy another company\u2019s credentials.', 'Revise la empresa activa en PSCS One. Cada empresa utiliza sus propios datos; no copie credenciales de otra empresa.'),
      tr('Os campos PayPal s\u00f3 podem ser alterados pelo gestor autorizado. A ajuda n\u00e3o concede permiss\u00e3o. Uma conex\u00e3o j\u00e1 validada n\u00e3o precisa ser reconfigurada para localizar o comprador de teste.', 'Only the authorized manager can change PayPal credentials. Help does not grant permission. An already validated connection does not need reconfiguration to locate a test buyer.', 'Solo el gestor autorizado puede cambiar las credenciales PayPal. La ayuda no otorga permisos. Una conexi\u00f3n validada no necesita reconfiguraci\u00f3n para localizar al comprador de prueba.'),
    ],
    links: [],
  },
  clientId: {
    title: tr('Client ID: onde encontrar?', 'Client ID: where is it?', 'Client ID: \u00bfd\u00f3nde est\u00e1?'),
    steps: [
      tr('Abra o PayPal Developer com o acesso do respons\u00e1vel. Apps & Credentials > Sandbox > selecione a aplica\u00e7\u00e3o da empresa (ou Create App, somente se ainda n\u00e3o existir).', 'Open PayPal Developer with the account owner\u2019s access. Apps & Credentials > Sandbox > select the company app (or Create App only when none exists).', 'Abra PayPal Developer con el acceso del responsable. Apps & Credentials > Sandbox > seleccione la aplicaci\u00f3n de la empresa (o Create App solo si no existe).'),
      tr('Copie o Client ID para este campo. Confirme a conta Business vendedora e o ambiente da aplica\u00e7\u00e3o. N\u00e3o use EIN, Merchant ID, e-mail ou senha como Client ID.', 'Copy the Client ID here. Check the app\u2019s Business seller account and environment. Do not use an EIN, Merchant ID, email or password as a Client ID.', 'Copie el Client ID aqu\u00ed. Compruebe la cuenta Business vendedora y el ambiente. No use EIN, Merchant ID, correo ni contrase\u00f1a como Client ID.'),
    ],
    links: ['https://developer.paypal.com/dashboard/', 'https://developer.paypal.com/api/get-started/'],
  },
  clientSecret: {
    title: tr('Client Secret: onde encontrar e como proteger?', 'Client Secret: where is it and how is it protected?', 'Client Secret: \u00bfd\u00f3nde est\u00e1 y c\u00f3mo protegerlo?'),
    steps: [
      tr('Na mesma aplica\u00e7\u00e3o Sandbox do Client ID, localize Secret e use Show, quando dispon\u00edvel. Cole apenas no campo Client Secret desta tela protegida.', 'In the same Sandbox app as the Client ID, locate Secret and use Show when available. Paste it only into the Client Secret field on this protected screen.', 'En la misma aplicaci\u00f3n Sandbox del Client ID, localice Secret y use Show cuando est\u00e9 disponible. P\u00e9guelo solo en Client Secret de esta pantalla protegida.'),
      tr('Depois de salvo, o aplicativo mostra apenas Configurado/mascarado, nunca o segredo armazenado. Deixe vazio para manter o atual. Substituir segredo \u00e9 uma a\u00e7\u00e3o do gestor, n\u00e3o uma etapa do teste do comprador.', 'After saving, the app shows only configured/masked status, never the stored secret. Leave blank to keep it. Replacing a secret is a manager action, not a buyer test step.', 'Tras guardar, la aplicaci\u00f3n solo muestra Configurado/enmascarado, nunca el secreto almacenado. D\u00e9jelo vac\u00edo para conservarlo. Reemplazarlo es una acci\u00f3n del gestor, no del comprador de prueba.'),
      tr('N\u00e3o envie secret, senha ou print com credenciais em grupos, chamados ou reposit\u00f3rios. Client Secret n\u00e3o \u00e9 a senha do comprador Sandbox.', 'Never share a secret, password or credential screenshot in groups, tickets or repositories. The Client Secret is not the Sandbox buyer password.', 'No comparta secretos, contrase\u00f1as ni capturas con credenciales en grupos, tickets o repositorios. Client Secret no es la contrase\u00f1a del comprador Sandbox.'),
    ],
    links: ['https://developer.paypal.com/api/get-started/'],
  },
  webhook: {
    title: tr('Webhook URL e Webhook ID', 'Webhook URL and Webhook ID', 'Webhook URL y Webhook ID'),
    steps: [
      tr('Para uma configura\u00e7\u00e3o nova: Salvar configura\u00e7\u00e3o > Testar conex\u00e3o > Configurar / atualizar webhook. Use os bot\u00f5es da tela; esta ajuda n\u00e3o executa essas a\u00e7\u00f5es.', 'For a new setup: Save configuration > Test connection > Configure / update webhook. Use the screen buttons; this help does not execute those actions.', 'Para una configuraci\u00f3n nueva: Guardar configuraci\u00f3n > Probar conexi\u00f3n > Configurar / actualizar webhook. Use los botones de la pantalla; esta ayuda no ejecuta esas acciones.'),
      tr('O aplicativo registra a URL da empresa no PayPal Sandbox e preenche o Webhook ID, que aqui \u00e9 somente leitura. No PayPal, consulte os webhooks da mesma aplica\u00e7\u00e3o para conferir. N\u00e3o crie um webhook duplicado nem use o ID de outra empresa ou ambiente.', 'The app registers the company URL in PayPal Sandbox and fills the read-only Webhook ID. Check webhooks under that same PayPal app. Do not create duplicates or use another company\u2019s or environment\u2019s ID.', 'La aplicaci\u00f3n registra la URL de la empresa en PayPal Sandbox y completa el Webhook ID de solo lectura. Consulte los webhooks de esa misma aplicaci\u00f3n PayPal. No cree duplicados ni use el ID de otra empresa o ambiente.'),
      tr('Conex\u00e3o validada n\u00e3o significa pagamento conclu\u00eddo. A homologa\u00e7\u00e3o exige aprova\u00e7\u00e3o do comprador, captura, webhook verificado, valor/status da invoice e reserva/agenda sem duplicidade. Live continua bloqueado.', 'A validated connection does not mean a completed payment. QA requires buyer approval, capture, verified webhook, invoice amount/status and reservation/calendar synchronization without duplicates. Live remains blocked.', 'Una conexi\u00f3n validada no significa pago completado. QA requiere aprobaci\u00f3n, captura, webhook verificado, importe/estado de invoice y reserva/agenda sin duplicados. Live sigue bloqueado.'),
    ],
    links: ['https://developer.paypal.com/api/rest/webhooks/rest/'],
  },
  buyer: {
    title: tr('Onde encontro o comprador Sandbox?', 'Where do I find the Sandbox buyer?', '\u00bfD\u00f3nde encuentro al comprador Sandbox?'),
    steps: [
      tr('No Developer: Testing Tools > Sandbox Accounts (tamb\u00e9m chamado Sandbox > Accounts). Procure Personal, n\u00e3o Business. Abra os tr\u00eas pontos > View/Edit Account para ver o e-mail e a senha de teste.', 'In Developer: Testing Tools > Sandbox Accounts (also called Sandbox > Accounts). Find Personal, not Business. Open the three-dot menu > View/Edit Account for the test email and password.', 'En Developer: Testing Tools > Sandbox Accounts (tambi\u00e9n Sandbox > Accounts). Busque Personal, no Business. Abra los tres puntos > View/Edit Account para ver el correo y la contrase\u00f1a de prueba.'),
      tr('Senha indispon\u00edvel: Profile > Change password. Sem conta Personal: Create Account > Personal > pa\u00eds do teste. N\u00e3o altere as chaves da aplica\u00e7\u00e3o para resolver acesso do comprador.', 'Password unavailable: Profile > Change password. No Personal account: Create Account > Personal > test country. Do not change app keys to resolve buyer access.', 'Contrase\u00f1a no disponible: Profile > Change password. Sin cuenta Personal: Create Account > Personal > pa\u00eds de prueba. No cambie las claves de la aplicaci\u00f3n para resolver el acceso del comprador.'),
      tr('Abra o link de QA autorizado e use essa conta no checkout sandbox.paypal.com. O login do painel Developer \u00e9 diferente do login comprador. Nunca use conta/cart\u00e3o real no checkout de teste. N\u00e3o salve senha do comprador no Catering AI.', 'Open the authorized QA link and use this account at sandbox.paypal.com checkout. Developer dashboard access differs from buyer login. Never use a real account/card at test checkout. Do not store buyer passwords in Catering AI.', 'Abra el enlace QA autorizado y use esa cuenta en el checkout sandbox.paypal.com. El acceso Developer es distinto del comprador. Nunca use cuenta/tarjeta real en el checkout de prueba. No guarde contrase\u00f1as de compradores en Catering AI.'),
    ],
    links: ['https://developer.paypal.com/dashboard/', 'https://developer.paypal.com/sandbox-testing/accounts/'],
  },
  zelle: {
    title: tr('Como preencher o Zelle?', 'How do I configure Zelle?', '\u00bfC\u00f3mo configurar Zelle?'),
    steps: [
      tr('Confirme com o respons\u00e1vel da empresa o nome do recebedor e o telefone/e-mail cadastrado no banco. Preencha os campos abaixo e as instru\u00e7\u00f5es. N\u00e3o informe login banc\u00e1rio, senha, PIN ou c\u00f3digo de verifica\u00e7\u00e3o.', 'Confirm the recipient name and bank-enrolled phone/email with the company owner. Fill in the fields below and instructions. Never enter bank login, password, PIN or verification codes.', 'Confirme con el responsable el nombre del destinatario y el tel\u00e9fono/correo registrado en el banco. Complete los campos e instrucciones. Nunca introduzca usuario bancario, contrase\u00f1a, PIN ni c\u00f3digos de verificaci\u00f3n.'),
      tr('Este cadastro n\u00e3o conecta uma API do Zelle nem confirma recebimentos automaticamente. A etiqueta DEV n\u00e3o transforma Zelle em Sandbox: n\u00e3o envie dinheiro real para testar. O recebimento depende de confer\u00eancia autorizada.', 'These settings do not connect a Zelle API or automatically confirm receipts. A DEV label does not make Zelle a Sandbox: do not send real money for testing. Receipt requires authorized verification.', 'Este registro no conecta una API Zelle ni confirma cobros autom\u00e1ticamente. La etiqueta DEV no convierte Zelle en Sandbox: no env\u00ede dinero real para probar. El cobro requiere verificaci\u00f3n autorizada.'),
    ],
    links: [],
  },
  bank: {
    title: tr('Banco, ACH, Wire e cheque', 'Bank, ACH, Wire and check', 'Banco, ACH, Wire y cheque'),
    steps: [
      tr('Use somente instru\u00e7\u00f5es verificadas fornecidas pelo respons\u00e1vel da empresa: banco, titular, conta, routing ACH, routing Wire e endere\u00e7o do benefici\u00e1rio. Preserve zeros iniciais. Confirme o routing adequado ao tipo de transfer\u00eancia; n\u00e3o use EIN como routing.', 'Use only verified instructions supplied by the company owner: bank, holder, account, ACH routing, Wire routing and beneficiary address. Preserve leading zeros. Confirm routing for the transfer type; do not use an EIN as routing.', 'Use solo instrucciones verificadas del responsable: banco, titular, cuenta, routing ACH, routing Wire y direcci\u00f3n del beneficiario. Preserve ceros iniciales. Confirme el routing seg\u00fan la transferencia; no use EIN como routing.'),
      tr('Cheque nominal a identifica o benefici\u00e1rio; n\u00e3o representa dep\u00f3sito nem compensa\u00e7\u00e3o. As instru\u00e7\u00f5es devem explicar o m\u00e9todo escolhido, sem misturar ACH com Wire. Nunca cadastre senha ou acesso ao banco.', 'Check payable to identifies the payee; it does not mean a deposit or cleared funds. Instructions must distinguish ACH from Wire. Never enter bank passwords or access credentials.', 'Cheque a nombre de identifica al beneficiario; no significa dep\u00f3sito ni fondos compensados. Las instrucciones deben distinguir ACH de Wire. Nunca registre contrase\u00f1as ni acceso bancario.'),
      tr('Salvar configura\u00e7\u00e3o n\u00e3o envia transfer\u00eancia, n\u00e3o marca invoice paga e n\u00e3o reserva evento. N\u00e3o execute transfer\u00eancia real no DEV. O comprovante n\u00e3o substitui a confer\u00eancia do cr\u00e9dito pelo respons\u00e1vel.', 'Saving settings does not send a transfer, mark an invoice paid or reserve an event. Do not transfer real money in DEV. A receipt screenshot does not replace checking credited funds.', 'Guardar no env\u00eda transferencias, no marca una invoice pagada ni reserva un evento. No transfiera dinero real en DEV. Un comprobante no sustituye la verificaci\u00f3n del abono.'),
    ],
    links: [],
  },
} satisfies Record<string, { title: HelpText; steps: HelpText[]; links: string[] }>
export type PaymentHelpTopic = keyof typeof paymentHelpSections
export function paymentHelpText(locale: string, text: HelpText): string {
  const language = locale.toLowerCase().split(/[-_]/)[0]
  return text[language === 'en' || language === 'es' ? language : 'pt']
}
