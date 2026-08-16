import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeInternalNext } from '@/Lib/auth/safeNext'

const PUBLIC_PREFIXES = [
  '/login',
  '/auth/',
  '/customer-quote',
  '/quote-request',
  '/proposta/',
  '/designacao-equipe/',
  '/confirmacao-guarnicao/',
  '/confirmacao-equipe/',
  '/conferencia-saida/',
  '/api/public/',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`) || pathname.startsWith(p),
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const pathname = request.nextUrl.pathname
  // Public aliases expected by QA / UX (canonical pages live under /auth/*)
  if (pathname === '/forgot-password') {
    return NextResponse.redirect(new URL('/auth/forgot-password', request.url))
  }
  if (pathname === '/reset-password') {
    return NextResponse.redirect(new URL('/auth/reset-password', request.url))
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isApi = pathname.startsWith('/api/')
  const isPublic = isPublicPath(pathname)

  if (!user && !isPublic) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === '/login') {
    const dest = safeInternalNext(request.nextUrl.searchParams.get('next'), '/quotes')
    return NextResponse.redirect(new URL(dest, request.nextUrl.origin))
  }

  return supabaseResponse
}
