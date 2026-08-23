/**
 * Copia arquivos de imagem dos pacotes/catálogo CDL de PROD → storage DEV
 * e atualiza image_url + image_status no DEV.
 *
 * Uso:
 *   node scripts/dev/sync-cdl-package-images-prod-to-dev.mjs           # dry-run
 *   node scripts/dev/sync-cdl-package-images-prod-to-dev.mjs --apply
 *
 * PROD: somente leitura (.env.local.PROD-BACKUP)
 * DEV:  escrita (.env.local)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const BUCKET = 'package-images'
const apply = process.argv.includes('--apply')

function load(name) {
  const env = readFileSync(join(ROOT, name), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

function refOf(url) {
  return (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
}

function extFromUrl(url, contentType) {
  const path = (url.split('?')[0] || '').toLowerCase()
  if (path.endsWith('.png')) return 'png'
  if (path.endsWith('.webp')) return 'webp'
  if (path.endsWith('.jpeg') || path.endsWith('.jpg')) return 'jpg'
  if ((contentType || '').includes('png')) return 'png'
  if ((contentType || '').includes('webp')) return 'webp'
  return 'jpg'
}

async function ensureBucket(dev) {
  const { data: buckets } = await dev.storage.listBuckets()
  const exists = (buckets || []).some((b) => b.name === BUCKET)
  if (exists) return
  const { error } = await dev.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
  })
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`createBucket: ${error.message}`)
  }
}

async function copyImage(dev, sourceUrl, objectPath) {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`download ${res.status} ${sourceUrl}`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  const { error } = await dev.storage.from(BUCKET).upload(objectPath, buf, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw new Error(`upload ${objectPath}: ${error.message}`)
  const { data } = dev.storage.from(BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

async function syncTable(dev, table, rows, idField = 'id') {
  let ok = 0
  let skip = 0
  let fail = 0
  for (const row of rows) {
    const src = (row.image_url || '').trim()
    if (!src) {
      skip++
      continue
    }
    // já no DEV
    if (src.includes(DEV_REF)) {
      if (apply && row.image_status !== 'ready') {
        await dev
          .from(table)
          .update({ image_status: 'ready' })
          .eq(idField, row.id)
      }
      skip++
      continue
    }
    const ext = extFromUrl(src)
    const objectPath = `cdl-prod-sync/${table}/${row.id}.${ext}`
    console.log(`  → ${table} ${row.package_key || row.item_key || row.id}`)
    if (!apply) {
      ok++
      continue
    }
    try {
      const publicUrl = await copyImage(dev, src, objectPath)
      const patch = { image_url: publicUrl, image_status: 'ready' }
      const { error } = await dev.from(table).update(patch).eq(idField, row.id)
      if (error) throw new Error(error.message)
      ok++
    } catch (err) {
      fail++
      console.warn(`    FAIL: ${err.message}`)
    }
  }
  return { ok, skip, fail }
}

async function main() {
  console.log(`\n=== sync-cdl-package-images (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`)
  const prodEnv = load('.env.local.PROD-BACKUP')
  const devEnv = load('.env.local')
  if (refOf(devEnv.url) !== DEV_REF || refOf(prodEnv.url) !== PROD_REF) {
    console.error('BLOQUEADO — refs inválidos')
    process.exit(2)
  }
  const prod = createClient(prodEnv.url, prodEnv.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const dev = createClient(devEnv.url, devEnv.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (apply) await ensureBucket(dev)

  const { data: packages, error: pErr } = await prod
    .from('packages')
    .select('id, package_key, image_url, image_status')
    .eq('company_id', CDL)
  if (pErr) throw new Error(pErr.message)

  const { data: catalog, error: cErr } = await prod
    .from('catalog_items')
    .select('id, item_key, image_url, image_status')
    .eq('company_id', CDL)
  if (cErr) throw new Error(cErr.message)

  console.log(
    `PROD packages com imagem: ${(packages || []).filter((r) => r.image_url).length}`,
  )
  console.log(
    `PROD catalog_items com imagem: ${(catalog || []).filter((r) => r.image_url).length}`,
  )

  console.log('\nPacotes:')
  const pkgRes = await syncTable(dev, 'packages', packages || [])
  console.log('  result', pkgRes)

  console.log('\nCatálogo:')
  const catRes = await syncTable(dev, 'catalog_items', catalog || [])
  console.log('  result', catRes)

  // Reativa status ready nos pacotes BBQ já no DEV (mesmo se URL ainda PROD)
  if (apply) {
    const { error } = await dev
      .from('packages')
      .update({ image_status: 'ready' })
      .eq('company_id', CDL)
      .not('image_url', 'is', null)
    if (error) console.warn('status update warn:', error.message)

    // Desativa fixtures de teste para a lista comercial ficar limpa
    const { error: deactErr } = await dev
      .from('packages')
      .update({ active: false })
      .eq('company_id', CDL)
      .or(
        'package_key.like.TEST-DEV-%,package_key.like.DEV_BBQ_%',
      )
    if (deactErr) console.warn('deactivate test pkgs:', deactErr.message)
  }

  const { data: verify } = await dev
    .from('packages')
    .select('package_key, price_per_person, active, image_url, image_status')
    .eq('company_id', CDL)
    .eq('active', true)
    .order('package_key')

  console.log('\nDEV pacotes active=true:')
  for (const p of verify || []) {
    const host = p.image_url?.includes(DEV_REF)
      ? 'DEV-storage'
      : p.image_url?.includes(PROD_REF)
        ? 'PROD-url'
        : p.image_url
          ? 'other'
          : 'no-img'
    console.log(
      `  ${p.package_key} $${p.price_per_person} [${p.image_status}] ${host}`,
    )
  }

  if (!apply) console.log('\nDry-run OK. Rode com --apply para copiar imagens ao DEV.')
  else console.log('\nImagens sincronizadas no DEV. PROD não foi alterado.')
}

main().catch((e) => {
  console.error('FALHA:', e.message || e)
  process.exit(1)
})
