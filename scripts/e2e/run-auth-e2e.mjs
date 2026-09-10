import { spawnSync } from 'child_process'

const pkg = '@playwright/test@1.63.0'
const baseArgs = ['exec', '--yes', `--package=${pkg}`, '--']

function run(args, label) {
  const result = spawnSync('npm', [...baseArgs, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error(`${label}=FAIL`)
    process.exit(result.status ?? 1)
  }
  console.log(`${label}=PASS`)
}

if (process.env.QA_E2E_INSTALL_BROWSER === '1') {
  run(['playwright', 'install', 'chromium'], 'PLAYWRIGHT_BROWSER_INSTALL')
}

run(
  ['playwright', 'test', '--config=playwright.config.ts'],
  'E2E_AUTH_PLAYWRIGHT',
)

const report = spawnSync('node', ['scripts/e2e/print-auth-report.mjs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})
process.exit(report.status ?? 0)
