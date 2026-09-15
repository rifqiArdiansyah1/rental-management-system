'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { getAuthErrorMessage } from '@/lib/authErrors'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  const { getLocale } = await import('@/lib/i18n/server')
  const locale = await getLocale()
  const isEn = locale === 'en'

  if (!password || !confirmPassword) {
    const msg = isEn
      ? 'Please enter your new password and confirm it.'
      : 'Silakan masukkan kata sandi baru dan konfirmasi kata sandi.'
    redirect(`/reset-password?message=${encodeURIComponent(msg)}`)
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    const msg = isEn
      ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      : `Kata sandi minimal harus terdiri dari ${MIN_PASSWORD_LENGTH} karakter.`
    redirect(`/reset-password?message=${encodeURIComponent(msg)}`)
  }

  if (password !== confirmPassword) {
    const msg = isEn
      ? 'Password confirmation does not match the new password.'
      : 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.'
    redirect(`/reset-password?message=${encodeURIComponent(msg)}`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    console.error('Update password error:', error.message)
    const localizedMessage = getAuthErrorMessage(error, locale)
    redirect(`/reset-password?message=${encodeURIComponent(localizedMessage)}`)
  }

  // Putuskan sesi sementara agar pengguna masuk kembali secara sadar dengan kata sandi baru
  await supabase.auth.signOut()

  const successMsg = isEn
    ? 'Your password has been successfully updated! Please sign in with your new password.'
    : 'Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.'

  redirect(`/login?message=${encodeURIComponent(successMsg)}`)
}
