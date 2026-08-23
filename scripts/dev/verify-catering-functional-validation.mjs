/**
 * Verificação da base funcional DEV (wrapper).
 * Equivalente a: node scripts/dev/seed-catering-functional-validation.mjs --verify
 */
import { spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seed = join(__dirname, 'seed-catering-functional-validation.mjs')
const r = spawnSync(process.execPath, [seed, '--verify'], {
  stdio: 'inherit',
  cwd: join(__dirname, '..', '..'),
})
process.exit(r.status ?? 1)
