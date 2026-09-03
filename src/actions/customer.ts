'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'

/**
 * Update customer's own name and phone number.
 * Only the authenticated customer can update their own profile.
 */
export async function updateCustomerProfile(
  name: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Anda harus login untuk memperbarui profil.' }
  }

  // Validation
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()

  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'Nama lengkap minimal 2 karakter.' }
  }

  if (trimmedPhone && trimmedPhone.length < 9) {
    return { success: false, error: 'Nomor telepon minimal 9 digit.' }
  }

  try {
    await prisma.customer.update({
      where: { id: user.id },
      data: {
        name: trimmedName,
        phone: trimmedPhone || '-',
      }
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal memperbarui profil.' }
  }
}
