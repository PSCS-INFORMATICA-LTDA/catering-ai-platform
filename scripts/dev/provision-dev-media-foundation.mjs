#!/usr/bin/env node
/**
 * DEV only: seed media.view / media.manage and ensure the public media bucket.
 * Does not run DDL. Does not touch PROD.
 */
import { createClient } from '@supabase/supabase-js'

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

if (url.includes(PROD_REF)) {
  console.error('REFUSING: PROD supabase')
  process.exit(1)
}
if (!url.includes(DEV_REF)) {
  console.error('REFUSING: not DEV supabase')
  process.exit(1)
}

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const permissions = [
  {
    permission_key: 'media.view',
    label_pt: 'Ver mídia e conteúdo',
    label_en: 'View media and content',
    label_es: 'Ver medios y contenido',
    category_key: 'media',
    active: true,
  },
  {
    permission_key: 'media.manage',
    label_pt: 'Gerenciar mídia e conteúdo',
    label_en: 'Manage media and content',
    label_es: 'Gestionar medios y contenido',
    category_key: 'media',
    active: true,
  },
]

const { error: permError } = await supabase
  .from('permissions')
  .upsert(permissions, { onConflict: 'permission_key' })
if (permError) {
  console.error('permissions:', permError.message)
  process.exit(1)
}

const roleKeys = ['owner', 'admin', 'manager']
const permKeys = ['media.view', 'media.manage']
for (const role_key of roleKeys) {
  for (const permission_key of permKeys) {
    const { data: existing } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('role_key', role_key)
      .eq('permission_key', permission_key)
      .maybeSingle()
    if (existing) continue
    const { error } = await supabase
      .from('role_permissions')
      .insert({ role_key, permission_key })
    if (error) {
      console.error('role_permissions:', error.message)
      process.exit(1)
    }
  }
}

const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets()
if (bucketListError) {
  console.error('listBuckets:', bucketListError.message)
  process.exit(1)
}
if (!(buckets ?? []).some((bucket) => bucket.id === 'company-public-media')) {
  const { error } = await supabase.storage.createBucket('company-public-media', {
    public: true,
    fileSizeLimit: 41943040,
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
    ],
  })
  if (error) {
    console.error('createBucket:', error.message)
    process.exit(1)
  }
}

const { data: seededPerms } = await supabase
  .from('permissions')
  .select('permission_key')
  .in('permission_key', permKeys)
const { data: seededRoles } = await supabase
  .from('role_permissions')
  .select('role_key, permission_key')
  .in('permission_key', permKeys)

console.log(
  JSON.stringify(
    {
      ok: true,
      permissions: (seededPerms ?? []).map((row) => row.permission_key),
      rolePermissions: seededRoles,
      bucket: 'company-public-media',
    },
    null,
    2,
  ),
)
