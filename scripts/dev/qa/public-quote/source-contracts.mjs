import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export const ROOT = resolve(HERE, '..', '..', '..', '..')

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.vercel',
  'coverage',
  'node_modules',
])

export function fromRoot(...parts) {
  return join(ROOT, ...parts)
}

export function normalizeRepoPath(path) {
  return relative(ROOT, path).split(sep).join('/')
}

export function requireFile(relativePath) {
  const absolutePath = fromRoot(...relativePath.split('/'))
  assert.ok(existsSync(absolutePath), `required file is missing: ${relativePath}`)
  return absolutePath
}

export function readSource(relativePath) {
  return readFileSync(requireFile(relativePath), 'utf8')
}

export function listFiles(start = ROOT) {
  const result = []

  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) result.push(child)
    }
  }

  visit(start)
  return result
}

export function listSourceFiles(start = ROOT) {
  return listFiles(start).filter((path) => SOURCE_EXTENSIONS.has(extname(path)))
}

export function sourcesContaining(pattern, files = listSourceFiles()) {
  return files.filter((path) => pattern.test(readFileSync(path, 'utf8')))
}

export function readCorpus(files) {
  return files.map((path) => readFileSync(path, 'utf8')).join('\n')
}

export function assertContains(source, pattern, message) {
  assert.match(source, pattern, message)
}

export function assertNotContains(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message)
}

export function assertTokensInOrder(source, first, second, message) {
  const firstIndex = source.search(first)
  const secondIndex = source.search(second)
  assert.ok(firstIndex >= 0, `${message}: first token was not found`)
  assert.ok(secondIndex >= 0, `${message}: second token was not found`)
  assert.ok(firstIndex < secondIndex, message)
}

function importSpecifiers(source) {
  const imports = []
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) imports.push(match[1])
  }
  return [...new Set(imports)]
}

function resolveLocalImport(importer, specifier) {
  let base
  if (specifier.startsWith('@/')) {
    base = fromRoot(...specifier.slice(2).split('/'))
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(importer), specifier)
  } else {
    return null
  }

  const candidates = [
    base,
    ...[...SOURCE_EXTENSIONS].map((extension) => `${base}${extension}`),
    ...[...SOURCE_EXTENSIONS].map((extension) => join(base, `index${extension}`)),
  ]

  return candidates.find((candidate) => {
    try {
      return existsSync(candidate) && statSync(candidate).isFile()
    } catch {
      return false
    }
  }) ?? null
}

export function reachableLocalModules(entryRelativePath, maxDepth = 12) {
  const entry = requireFile(entryRelativePath)
  const visited = new Set()

  function visit(path, depth) {
    if (visited.has(path) || depth > maxDepth) return
    visited.add(path)
    const source = readFileSync(path, 'utf8')
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveLocalImport(path, specifier)
      if (resolved) visit(resolved, depth + 1)
    }
  }

  visit(entry, 0)
  return visited
}

export function findReachableByContent(entryRelativePath, pattern) {
  return [...reachableLocalModules(entryRelativePath)].filter((path) =>
    pattern.test(readFileSync(path, 'utf8')),
  )
}

export function findPublicQuoteMigrationFiles() {
  const migrationsDir = fromRoot('supabase', 'migrations')
  if (!existsSync(migrationsDir)) return []
  return listFiles(migrationsDir).filter((path) => {
    if (extname(path) !== '.sql') return false
    return /public_quote_enabled|public_self_service|self[_ -]?service[_ -]?quote|quote[_ -]?intake/i.test(
      readFileSync(path, 'utf8'),
    )
  })
}

export function assertNoTrackedSecretExposure(source, label) {
  assertNotContains(
    source,
    /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY)/,
    `${label} exposes a server secret through NEXT_PUBLIC_*`,
  )
  assertNotContains(
    source,
    /(?:service[_ -]?role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"][^'"]+['"]/i,
    `${label} contains an inline service-role value`,
  )
}
