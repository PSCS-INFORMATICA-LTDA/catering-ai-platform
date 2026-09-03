import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeInternalNext } from '@/Lib/auth/safeNext'
import { isPublicRoutePathname } from '@/Lib/publicRoutes'

function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname === '/forgot-password') {
    return NextResponse.redirect(new URL('/auth/forgot-password', request.url))
  }
  if (pathname === '/reset-password') {
    return NextResponse.redirect(new URL('/auth/reset-password', request.url))
  }

  const isApi = pathname.startsWith('/api/')
  const isPublic = isPublicRoutePathname(pathname)
  const isLogin = pathname === '/login'

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (isPublic && !isLogin) {
    return nextWithPathname(request, pathname)
  }

  if (!url || !anon) {
    return nextWithPathname(request, pathname)
  }

  let supabaseResponse = nextWithPathname(request, pathname)

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = nextWithPathname(request, pathname)
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (user && isLogin) {
    const dest = safeInternalNext(request.nextUrl.searchParams.get('next'), '/quotes')
    return NextResponse.redirect(new URL(dest, request.nextUrl.origin))
  }

  return supabaseResponse
}
