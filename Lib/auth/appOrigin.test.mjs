import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getAppOrigin,
  isDeployedEnvironment,
  resolveAppOrigin,
} from './appOrigin.ts'

describe('isDeployedEnvironment', () => {
  it('detects Vercel deployment', () => {
    assert.equal(isDeployedEnvironment({ VERCEL: '1' }), true)
    assert.equal(isDeployedEnvironment({ VERCEL_ENV: 'preview' }), true)
  })

  it('treats local dev as non-deployed', () => {
    assert.equal(isDeployedEnvironment({ NODE_ENV: 'development' }), false)
  })
})

describe('resolveAppOrigin', () => {
  it('uses configured NEXT_PUBLIC_APP_URL in deployed environments', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: 'https://catering-ai-agenda-dev.vercel.app',
      requestOrigin: 'https://evil.example.com',
      vercelUrl: 'catering-ai-agenda-dev.vercel.app',
      isDeployed: true,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.origin, 'https://catering-ai-agenda-dev.vercel.app')
    }
  })

  it('fails closed in deployed environments without configured origin', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: null,
      requestOrigin: 'https://evil.example.com',
      vercelUrl: 'catering-ai-agenda-dev.vercel.app',
      isDeployed: true,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'missing_configured_origin')
  })

  it('ignores malicious request origin in deployed environments when configured', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: 'https://catering-ai-agenda-dev.vercel.app',
      requestOrigin: 'https://attacker.example',
      isDeployed: true,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.origin, 'https://catering-ai-agenda-dev.vercel.app')
    }
  })

  it('allows localhost fallback in local development', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: null,
      requestOrigin: null,
      vercelUrl: null,
      isDeployed: false,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.origin, 'http://localhost:3000')
  })

  it('allows request origin in local development', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: null,
      requestOrigin: 'http://localhost:3001',
      isDeployed: false,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.origin, 'http://localhost:3001')
  })
})

describe('getAppOrigin', () => {
  it('throws in deployed mode without NEXT_PUBLIC_APP_URL', () => {
    const original = { ...process.env }
    try {
      process.env.VERCEL = '1'
      delete process.env.NEXT_PUBLIC_APP_URL
      assert.throws(() => getAppOrigin(), /NEXT_PUBLIC_APP_URL is required/)
    } finally {
      process.env.VERCEL = original.VERCEL
      process.env.NEXT_PUBLIC_APP_URL = original.NEXT_PUBLIC_APP_URL
    }
  })
})
