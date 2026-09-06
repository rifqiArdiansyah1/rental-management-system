'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { getAuthErrorMessage } from '@/lib/authErrors'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    redirect(
      `/reset-password?message=${encodeURIComponent(
        'Silakan masukkan kata sandi baru dan konfirmasi kata sandi.'
      )}`
    )
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(
      `/reset-password?message=${encodeURIComponent(
        `Kata sandi minimal harus terdiri dari ${MIN_PASSWORD_LENGTH} karakter.`
      )}`
    )
  }

  if (password !== confirmPassword) {
    redirect(
      `/reset-password?message=${encodeURIComponent(
        'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.'
      )}`
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    console.error('Update password error:', error.message)
    const localizedMessage = getAuthErrorMessage(error)
    redirect(`/reset-password?message=${encodeURIComponent(localizedMessage)}`)
  }

  // Putuskan sesi sementara agar pengguna masuk kembali secara sadar dengan kata sandi baru
  await supabase.auth.signOut()

  redirect(
    `/login?message=${encodeURIComponent(
      'Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.'
    )}`
  )
}
