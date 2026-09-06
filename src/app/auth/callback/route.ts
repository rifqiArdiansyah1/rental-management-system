import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Pastikan target redirect merupakan URL aman
      const redirectUrl = new URL(next, requestUrl.origin)
      return NextResponse.redirect(redirectUrl)
    }

    console.error('Auth code exchange error:', error.message)
  }

  // Jika kode hilang atau token invalid/kedaluwarsa
  const errorRedirect = new URL('/login', requestUrl.origin)
  errorRedirect.searchParams.set(
    'message',
    'Tautan pemulihan kata sandi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
  )
  return NextResponse.redirect(errorRedirect)
}
