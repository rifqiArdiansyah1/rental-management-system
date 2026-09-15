import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  // 1. Jalankan updateSession untuk refresh auth token Supabase & proteksi rute /admin
  const response = await updateSession(request)

  // Jika updateSession memicu redirect (misal redirect ke /admin/login), langsung teruskan
  if (response.status >= 300 && response.status < 400) {
    return response
  }

  // 2. Deteksi preferensi bahasa
  const langParam = request.nextUrl.searchParams.get('lang')
  let currentLocale = request.cookies.get('NEXT_LOCALE')?.value

  if (langParam === 'id' || langParam === 'en') {
    currentLocale = langParam
    // Mutasi instance response yang sama agar cookie sesi Supabase tetap utuh
    response.cookies.set('NEXT_LOCALE', currentLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 tahun
      sameSite: 'lax',
    })
  } else if (!currentLocale || (currentLocale !== 'id' && currentLocale !== 'en')) {
    currentLocale = 'id'
    response.cookies.set('NEXT_LOCALE', currentLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  // Teruskan x-locale ke downstream Server Components
  response.headers.set('x-locale', currentLocale)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
