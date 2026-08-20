import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  assertHoneypot,
  assertRequestOrigin,
  MAX_PUBLIC_QUOTE_IMAGE_BYTES,
  PUBLIC_QUOTE_IMAGE_TYPES,
  PublicQuoteHttpError,
  publicErrorResponse,
} from '@/Lib/publicQuote/security'
import {
  consumePublicQuoteRateLimit,
  loadPublicQuoteSession,
  loadPublicQuoteSessionTenant,
} from '@/Lib/publicQuote/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }
const BUCKET = 'public-quote-grill'

function imageExtension(type: string) {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return null
}

function hasExpectedSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (type === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  }
  if (type === 'image/webp') {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (declaredLength > MAX_PUBLIC_QUOTE_IMAGE_BYTES + 512 * 1024) {
      throw new PublicQuoteHttpError(413, 'invalid_payload')
    }

    const session = await loadPublicQuoteSession(request)
    await loadPublicQuoteSessionTenant(session)
    await consumePublicQuoteRateLimit(
      request,
      session.company_id,
      'upload',
      20,
      60 * 60,
    )

    const form = await request.formData()
    assertHoneypot(form.get('website'))
    const photo = form.get('photo')
    if (
      !(photo instanceof File) ||
      photo.size < 16 ||
      photo.size > MAX_PUBLIC_QUOTE_IMAGE_BYTES ||
      !PUBLIC_QUOTE_IMAGE_TYPES.has(photo.type)
    ) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }
    const extension = imageExtension(photo.type)
    const signature = new Uint8Array(await photo.slice(0, 12).arrayBuffer())
    if (!extension || !hasExpectedSignature(photo.type, signature)) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }

    const storagePath = `${session.company_id}/${session.id}/${randomUUID()}.${extension}`
    const supabase = getSupabaseServerClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, photo, {
        contentType: photo.type,
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadError) throw new PublicQuoteHttpError(500, 'server_error')

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 10 * 60)
    if (signedError || !signed?.signedUrl) {
      throw new PublicQuoteHttpError(500, 'server_error')
    }

    return NextResponse.json(
      {
        photo: {
          reference: `${BUCKET}/${storagePath}`,
          previewUrl: signed.signedUrl,
        },
      },
      { headers: NO_STORE },
    )
  } catch (error) {
    const result = publicErrorResponse(error)
    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE,
    })
  }
}
