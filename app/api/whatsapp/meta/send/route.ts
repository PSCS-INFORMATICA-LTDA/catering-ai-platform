import { NextResponse } from 'next/server'
import { isWhatsAppChannelEnabled } from '@/Lib/brasinha/env'
import { whatsappChannel } from '@/Lib/brasinha/channels/whatsapp'

export const dynamic = 'force-dynamic'

/** Disabled WhatsApp send contract. Never calls Meta. */
export async function POST() {
  if (!isWhatsAppChannelEnabled()) {
    return NextResponse.json({ error: 'whatsapp_disabled' }, { status: 404 })
  }
  try {
    await whatsappChannel.send({
      channel: 'whatsapp',
      companyId: '',
      conversationId: '',
      language: 'pt',
      text: '',
      handoffStatus: 'AI_ACTIVE',
      createdAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'whatsapp_disabled' }, { status: 404 })
  }
  return NextResponse.json({ error: 'whatsapp_disabled' }, { status: 404 })
}
