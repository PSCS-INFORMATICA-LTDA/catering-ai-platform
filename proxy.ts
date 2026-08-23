import { type NextRequest } from 'next/server'
import { updateSession } from '@/Lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Static files in /public skip auth. Include mp4 so the public quote
    // how-it-works video is not redirected to /login.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ogg|m4v)$).*)',
  ],
}
