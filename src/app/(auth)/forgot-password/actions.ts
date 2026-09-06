'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getAuthErrorMessage } from '@/lib/authErrors'

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()

  if (!email) {
    redirect('/forgot-password?message=' + encodeURIComponent('Silakan masukkan alamat email Anda.') + '&type=error')
  }

  const supabase = await createClient()
  const headerList = await headers()
  const origin = headerList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Jika terkena batas laju pemanggilan (rate limit), berikan notifikasi yang informatif
  if (error) {
    console.error('Password reset request error:', error.message)
    const code = String(error.code || '').toLowerCase()
    const msg = String(error.message || '').toLowerCase()
    if (
      code === 'over_request_rate_limit' ||
      code === 'too_many_requests' ||
      error.status === 429 ||
      msg.includes('rate limit') ||
      msg.includes('security purposes')
    ) {
      redirect(`/forgot-password?message=${encodeURIComponent(getAuthErrorMessage(error))}&type=error`)
    }
  }

  // Perlindungan User Enumeration:
  // Selalu tampilkan pesan sukses yang seragam terlepas dari apakah email terdaftar atau tidak
  redirect(
    `/forgot-password?message=${encodeURIComponent(
      'Jika email terdaftar di sistem kami, tautan pemulihan kata sandi telah dikirim. Silakan periksa kotak masuk atau folder spam Anda.'
    )}&type=success`
  )
}
