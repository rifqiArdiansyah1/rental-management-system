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
  if (!authData.user || !authData.user.app_metadata || !authData.user.app_metadata.role?.includes('admin')) {
    // Kalo bukan admin, sign out dan tolak
    await supabase.auth.signOut()
    redirect('/admin/login?message=Akses ditolak. Bukan akun admin.')
  }

  revalidatePath('/admin', 'layout')
  redirect('/admin')
}
