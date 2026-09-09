#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const reportJson = resolve('tests/e2e/auth/.e2e-report.json')
const reportTxt = resolve('tests/e2e/auth/.e2e-report.txt')

if (existsSync(reportTxt)) {
  console.log(readFileSync(reportTxt, 'utf8'))
  process.exit(0)
}

if (existsSync(reportJson)) {
  console.log(readFileSync(reportJson, 'utf8'))
  process.exit(0)
}

console.error('No E2E auth report found. Run npm run test:e2e:auth first.')
process.exit(1)
