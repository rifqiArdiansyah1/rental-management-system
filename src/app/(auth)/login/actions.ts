'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { getAuthErrorMessage } from '@/lib/authErrors'

export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/'

  if (!email || !password) {
    redirect('/login?message=' + encodeURIComponent('Silakan masukkan email dan kata sandi Anda.'))
  }

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Login error:', error.message)
    const localizedMessage = getAuthErrorMessage(error)
    redirect(`/login?message=${encodeURIComponent(localizedMessage)}`)
  }

  // 🛡️ Technical Guard: Cegah akun staf / admin mengautentikasi melalui portal customer
  if (authData.user) {
    const staffRole = authData.user.app_metadata?.role
    const validAdminRoles = ['staff_cabang', 'admin_cabang', 'admin_pusat']

    const isStaff =
      (staffRole && validAdminRoles.includes(staffRole)) ||
      Boolean(await prisma.user.findUnique({ where: { id: authData.user.id } }))

    if (isStaff) {
      // Segera batalkan/putuskan sesi dari cookie customer
      await supabase.auth.signOut()
      redirect(
        `/login?message=${encodeURIComponent(
          'Akun ini terdaftar sebagai staf internal. Silakan masuk melalui Portal Staf di /admin/login.'
        )}`
      )
    }

    // Pastikan profil customer ada di basis data Prisma (upsert jika belum ada)
    const customer = await prisma.customer.findUnique({
      where: { id: authData.user.id },
    })

    if (!customer) {
      const customerName = authData.user.user_metadata?.name || email.split('@')[0]
      const customerPhone = authData.user.user_metadata?.phone || ''
      await prisma.customer.upsert({
        where: { id: authData.user.id },
        update: {},
        create: {
          id: authData.user.id,
          name: customerName,
          email: email,
          phone: customerPhone,
        },
      })
    }
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo.startsWith('/') ? redirectTo : '/')
}
