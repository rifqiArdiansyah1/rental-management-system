'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
    phone: formData.get('phone') as string,
  }

  const existingCustomer = await prisma.customer.findUnique({
    where: { email: data.email }
  })

  if (existingCustomer) {
    redirect('/register?message=Email sudah terdaftar. Silakan gunakan email lain atau masuk.')
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        name: data.name,
      }
    }
  })

  if (error) {
    redirect(`/register?message=${encodeURIComponent(error.message)}`)
  }

  // Create row in Prisma Customer table
  if (authData.user) {
    // Karena kita tidak menggunakan Admin API di sisi ini, signUp biasa tidak bisa set app_metadata
    // Sebagai gantinya, pada Next.js app_metadata di set manual pakai Admin API atau trigger.
    // Tapi untuk keperluan Customer, jika app_metadata.role tidak ada, kita bisa anggap sebagai customer default
    
    try {
      await prisma.customer.upsert({
        where: { id: authData.user.id },
        update: {
          name: data.name,
          phone: data.phone,
        },
        create: {
          id: authData.user.id,
          email: data.email,
          name: data.name,
          phone: data.phone,
        }
      })
    } catch (e) {
      console.error(e)
      // gracefully ignore unique constraint errors if double click
    }
  }

  if (!authData.session) {
    redirect('/login?message=Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi.')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
