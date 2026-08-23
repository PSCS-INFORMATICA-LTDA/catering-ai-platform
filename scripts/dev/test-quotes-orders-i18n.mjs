/**
 * Teste — i18n PT/EN/ES da feature Quotes/Orders (estático, sem rede)
 *
 * 1) Paridade estrutural do dicionário `Lib/i18n/quotesOrders.ts`: toda chave
 *    presente em `pt` deve existir também em `en` e `es` (e vice-versa).
 * 2) Varredura leve nos arquivos já cabeados nesta hardening por frases PT
 *    fixas conhecidas (regressão: se alguém reintroduzir texto hardcoded,
 *    este teste falha).
 *
 * Não acessa rede/DB — pode rodar em qualquer ambiente.
 *
 * Uso:
 *   node scripts/dev/test-quotes-orders-i18n.mjs
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

function fail(msg) {
  console.log(`QUOTES/ORDERS I18N: FAIL — ${msg}`)
  process.exit(1)
}

/** Extrai o corpo de um bloco `<locale>: { ... }` de nível superior do dict. */
function extractLocaleBlock(source, locale) {
  const marker = `\n  ${locale}: {`
  const start = source.indexOf(marker)
  if (start === -1) return null
  let depth = 0
  let i = source.indexOf('{', start)
  const bodyStart = i
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return source.slice(bodyStart + 1, i)
}

/** Extrai as chaves de nível superior (linhas `chave: `) de um bloco de objeto. */
function extractKeys(blockBody) {
  const keys = new Set()
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*):/gm
  let m
  while ((m = re.exec(blockBody))) {
    keys.add(m[1])
  }
  return keys
}

function diff(a, b) {
  return [...a].filter((k) => !b.has(k))
}

async function main() {
  console.log('=== TEST QUOTES/ORDERS I18N ===\n')

  console.log('--- 1) Paridade estrutural pt/en/es ---')
  const dictPath = join(ROOT, 'Lib', 'i18n', 'quotesOrders.ts')
  const dictSource = readFileSync(dictPath, 'utf8')

  const ptBlock = extractLocaleBlock(dictSource, 'pt')
  const enBlock = extractLocaleBlock(dictSource, 'en')
  const esBlock = extractLocaleBlock(dictSource, 'es')
  if (!ptBlock || !enBlock || !esBlock) {
    fail('não foi possível extrair os blocos pt/en/es de Lib/i18n/quotesOrders.ts')
  }

  const ptKeys = extractKeys(ptBlock)
  const enKeys = extractKeys(enBlock)
  const esKeys = extractKeys(esBlock)

  if (ptKeys.size === 0) fail('dicionário pt vazio (regex de extração pode ter falhado)')
  console.log(`  pt=${ptKeys.size} chaves, en=${enKeys.size} chaves, es=${esKeys.size} chaves`)

  const missingInEn = diff(ptKeys, enKeys)
  const missingInEs = diff(ptKeys, esKeys)
  const extraInEn = diff(enKeys, ptKeys)
  const extraInEs = diff(esKeys, ptKeys)

  if (missingInEn.length > 0) fail(`chaves faltando em EN: ${missingInEn.join(', ')}`)
  if (missingInEs.length > 0) fail(`chaves faltando em ES: ${missingInEs.join(', ')}`)
  if (extraInEn.length > 0) fail(`chaves extras em EN (sem PT correspondente): ${extraInEn.join(', ')}`)
  if (extraInEs.length > 0) fail(`chaves extras em ES (sem PT correspondente): ${extraInEs.join(', ')}`)
  console.log('  OK paridade estrutural pt/en/es (mesmo conjunto de chaves)')

  console.log('\n--- 2) Varredura por texto PT hardcoded conhecido ---')
  // Frases que existiam hardcoded antes da hardening i18n e que devem ter
  // sido substituídas por `tQuotesOrders(locale, 'chave')` nos componentes
  // listados. Comentários/strings do próprio dicionário não entram aqui.
  const KNOWN_HARDCODED_PHRASES = [
    'Buscando cotações',
    'Nova cotação',
    'Convertendo…',
    'Converter em Ordem de Serviço',
    'Todos os status',
    'Limpar filtros',
    'Nenhuma cotação encontrada com os filtros',
    'Designar equipe',
    'Enviar cotação ao cliente',
    'Regras comerciais',
    'Resumo financeiro',
    'Voltar às cotações',
    'Editar cotação',
    'Imprimir / PDF',
    'Pacote CDL',
    'Convidados e cobrança',
    'Cliente tem churrasqueira?',
    'Adicionais selecionados',
  ]

  const SCAN_FILES = [
    'components/QuotesDashboard.tsx',
    'components/orders/OrdersDashboard.tsx',
    'components/orders/OrderDetailView.tsx',
    'components/quotes/QuoteConvertPanel.tsx',
    'components/quotes/QuoteProposalSharePanel.tsx',
    'components/quotes/QuoteTeamAssignmentPanel.tsx',
    'app/quotes/[id]/QuoteDetailView.tsx',
    'app/quotes/[id]/QuotePdfDocument.tsx',
    'app/quotes/[id]/QuoteDetailToolbar.tsx',
  ]

  let offenders = 0
  for (const relPath of SCAN_FILES) {
    const filePath = join(ROOT, relPath)
    let source
    try {
      source = readFileSync(filePath, 'utf8')
    } catch {
      fail(`arquivo não encontrado: ${relPath}`)
      return
    }
    for (const phrase of KNOWN_HARDCODED_PHRASES) {
      if (source.includes(phrase)) {
        console.log(`  FAIL ${relPath}: contém texto hardcoded "${phrase}"`)
        offenders += 1
      }
    }
  }
  if (offenders > 0) {
    fail(`${offenders} ocorrência(s) de texto PT hardcoded encontradas nos arquivos cabeados`)
  }
  console.log(`  OK nenhum texto PT hardcoded conhecido encontrado em ${SCAN_FILES.length} arquivo(s)`)

  console.log('\n--- 3) Wiring básico (useAuthLocaleFromMe / tQuotesOrders presentes) ---')
  const WIRED_FILES = SCAN_FILES.filter((f) => f !== 'app/quotes/[id]/QuotePdfDocument.tsx')
  let unwired = 0
  for (const relPath of WIRED_FILES) {
    const source = readFileSync(join(ROOT, relPath), 'utf8')
    const usesLocaleHook =
      source.includes('useAuthLocaleFromMe') || source.includes('quote.language')
    const usesTranslator = source.includes('tQuotesOrders')
    if (!usesLocaleHook || !usesTranslator) {
      console.log(`  FAIL ${relPath}: locale hook=${usesLocaleHook} tQuotesOrders=${usesTranslator}`)
      unwired += 1
    }
  }
  if (unwired > 0) fail(`${unwired} arquivo(s) sem wiring completo de locale/tradução`)
  console.log(`  OK wiring de locale presente em ${WIRED_FILES.length} arquivo(s)`)

  console.log('\nQUOTES/ORDERS I18N: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
