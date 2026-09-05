import { NextResponse } from 'next/server'
import { isWhatsAppChannelEnabled } from '@/Lib/brasinha/env'

export const dynamic = 'force-dynamic'

function disabled() {
  return new NextResponse('Not Found', { status: 404 })
}

/** Disabled WhatsApp inbound contract. No Meta network calls. */
export async function GET() {
  if (!isWhatsAppChannelEnabled()) return disabled()
  return disabled()
}

export async function POST() {
  if (!isWhatsAppChannelEnabled()) return disabled()
  return disabled()
}
