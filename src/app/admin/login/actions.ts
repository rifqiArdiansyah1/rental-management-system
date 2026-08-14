'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function adminLogin(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/admin/login?message=Kredensial tidak valid')
  }

  // Double check the role from app_metadata as per defense in depth strategy
  const validAdminRoles = ['staff_cabang', 'admin_cabang', 'admin_pusat']
  if (!authData.user || !authData.user.app_metadata || !validAdminRoles.includes(authData.user.app_metadata.role)) {
    // Kalo bukan admin, sign out dan tolak
    await supabase.auth.signOut()
    redirect('/admin/login?message=Akses ditolak. Bukan akun staf atau admin.')
  }

  revalidatePath('/admin/dashboard', 'layout')
  redirect('/admin/dashboard')
}
