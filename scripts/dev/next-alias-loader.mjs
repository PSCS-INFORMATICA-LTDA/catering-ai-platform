import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const stub = new URL('./server-only-stub.mjs', import.meta.url).href
const root = process.cwd()

function existingFileUrl(abs) {
  for (const candidate of [`${abs}.ts`, `${abs}.tsx`, `${abs}.js`, `${abs}.mjs`, abs]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href
    }
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: stub, shortCircuit: true }
  }
  if (specifier.startsWith('@/')) {
    const url = existingFileUrl(join(root, specifier.slice(2)))
    if (url) return { url, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL))
    const url = existingFileUrl(join(parentDir, specifier))
    if (url) return { url, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
