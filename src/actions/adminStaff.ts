'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export async function createStaff(data: {
  name: string
  email: string
  password: string
  role: UserRole
  branchId?: string | null
}) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf Cabang tidak berwenang menambah akun staf.' }
    }

    if (!data.name || data.name.trim().length < 2) {
      return { error: 'Nama staf wajib diisi minimal 2 karakter.' }
    }

    if (!data.email || !data.email.includes('@')) {
      return { error: 'Format email tidak valid.' }
    }

    if (!data.password || data.password.length < 10) {
      return { error: 'Password akun internal wajib minimal 10 karakter.' }
    }

    // Role & Scoping Guard
    let effectiveBranchId: string | null = data.branchId || null

    if (adminUser.role === 'admin_cabang') {
      if (data.role !== 'staff_cabang') {
        return { error: 'Akses ditolak: Admin Cabang hanya berwenang membuat akun Staf Cabang.' }
      }
      if (data.branchId !== adminUser.branchId) {
        return { error: 'Akses ditolak: Admin Cabang hanya dapat membuat staf untuk cabangnya sendiri.' }
      }
      effectiveBranchId = adminUser.branchId
    } else if (adminUser.role === 'admin_pusat') {
      if (data.role === 'admin_pusat') {
        effectiveBranchId = null
      } else if (!effectiveBranchId) {
        return { error: 'Cabang penempatan wajib dipilih untuk Staf Cabang atau Admin Cabang.' }
      }
    }

    const supabaseAdmin = createAdminClient()

    // 1. Create User in Supabase Auth (Auth Server First)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name.trim() },
      app_metadata: {
        role: data.role,
        branch_id: effectiveBranchId
      }
    })

    if (authError) {
      if (
        authError.message?.toLowerCase().includes('already registered') ||
        authError.message?.toLowerCase().includes('duplicate') ||
        (authError as any).status === 422
      ) {
        return { error: 'Email sudah terdaftar di sistem. Gunakan email lain.' }
      }
      return { error: authError.message || 'Gagal membuat akun di server autentikasi.' }
    }

    // 2. Create User Record in Prisma Database
    try {
      const user = await prisma.user.create({
        data: {
          id: authData.user.id,
          email: data.email.trim(),
          name: data.name.trim(),
          role: data.role,
          branchId: effectiveBranchId,
          isActive: true
        },
        include: { branch: true }
      })

      revalidatePath('/admin/staff')
      return { success: true, user: JSON.parse(JSON.stringify(user)) }
    } catch (dbError: any) {
      // Rollback Compensation: delete the created auth user
      console.error('[ROLLBACK] Deleting Supabase auth user due to Prisma insert failure:', dbError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(console.error)

      if (dbError.code === 'P2002') {
        return { error: 'Email sudah terdaftar di sistem database.' }
      }
      return { error: 'Terjadi kesalahan sistem saat menyimpan staf ke database. Pembuatan dibatalkan.' }
    }
  } catch (error: any) {
    console.error('Failed to create staff:', error)
    return { error: error.message || 'Terjadi kesalahan sistem.' }
  }
}

export async function updateStaff(id: string, data: {
  name: string
  role: UserRole
  branchId?: string | null
  password?: string
}) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf Cabang tidak berwenang mengelola akun staf.' }
    }

    if (!data.name || data.name.trim().length < 2) {
      return { error: 'Nama staf wajib diisi minimal 2 karakter.' }
    }

    const target = await prisma.user.findUnique({
      where: { id }
    })

    if (!target) {
      return { error: 'Akun staf tidak ditemukan.' }
    }

    let effectiveBranchId: string | null = data.branchId || null

    // Anti-Privilege Escalation & Hierarchy Checks
    if (adminUser.role === 'admin_cabang') {
      // Target must be in admin's branch and currently staff_cabang
      if (target.branchId !== adminUser.branchId || target.role !== 'staff_cabang') {
        return { error: 'Akses ditolak: Anda hanya dapat mengelola Staf Cabang di cabang Anda sendiri.' }
      }
      // Payload role MUST remain staff_cabang
      if (data.role !== 'staff_cabang') {
        return { error: 'Akses ditolak: Admin Cabang tidak dapat menaikkan peran staf menjadi Admin.' }
      }
      // Payload branchId MUST remain admin's branch
      effectiveBranchId = adminUser.branchId
    } else if (adminUser.role === 'admin_pusat') {
      // Guard Last Admin Pusat: If target is currently admin_pusat and role is changing away from admin_pusat
      if (target.role === 'admin_pusat' && data.role !== 'admin_pusat') {
        const activePusatCount = await prisma.user.count({
          where: { role: 'admin_pusat', isActive: true }
        })
        if (activePusatCount <= 1) {
          return { error: 'Tidak dapat mengubah peran. Minimal harus ada 1 Admin Pusat aktif di sistem.' }
        }
      }

      if (data.role === 'admin_pusat') {
        effectiveBranchId = null
      } else if (!effectiveBranchId) {
        return { error: 'Cabang penempatan wajib dipilih untuk Staf Cabang atau Admin Cabang.' }
      }
    }

    // Password validation (if supplied)
    if (data.password && data.password.trim().length > 0) {
      if (data.password.trim().length < 10) {
        return { error: 'Password baru wajib minimal 10 karakter.' }
      }
    }

    const supabaseAdmin = createAdminClient()

    // 1. Update Supabase Auth user
    const updatePayload: any = {
      user_metadata: { name: data.name.trim() },
      app_metadata: {
        role: data.role,
        branch_id: effectiveBranchId
      }
    }

    if (data.password && data.password.trim().length >= 10) {
      updatePayload.password = data.password.trim()
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload)
    if (authUpdateError) {
      return { error: `Gagal memperbarui autentikasi: ${authUpdateError.message}` }
    }

    // 2. Update Prisma Database
    await prisma.user.update({
      where: { id },
      data: {
        name: data.name.trim(),
        role: data.role,
        branchId: effectiveBranchId
      }
    })

    // 3. Force Session Revocation if role or branch changed (Mitigate JWT staleness)
    if (target.role !== data.role || target.branchId !== effectiveBranchId) {
      await supabaseAdmin.auth.admin.signOut(id).catch(err => {
        console.warn(`[AUTH] Failed to force sign-out user ${id}:`, err?.message)
      })
    }

    revalidatePath('/admin/staff')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to update staff:', error)
    return { error: error.message || 'Terjadi kesalahan sistem.' }
  }
}

export async function softDeleteStaff(id: string, isActive: boolean) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf Cabang tidak berwenang mengubah status akun staf.' }
    }

    // Self-Protection Guard: Cannot deactivate own account
    if (id === adminUser.id) {
      return { error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' }
    }

    const target = await prisma.user.findUnique({
      where: { id }
    })

    if (!target) {
      return { error: 'Akun staf tidak ditemukan.' }
    }

    // Scoping check
    if (adminUser.role === 'admin_cabang') {
      if (target.branchId !== adminUser.branchId || target.role !== 'staff_cabang') {
        return { error: 'Akses ditolak: Anda hanya dapat menonaktifkan Staf Cabang di cabang Anda sendiri.' }
      }
    }

    // Guard Last Admin Pusat: If deactivating an admin_pusat
    if (target.role === 'admin_pusat' && !isActive) {
      const activePusatCount = await prisma.user.count({
        where: { role: 'admin_pusat', isActive: true }
      })
      if (activePusatCount <= 1) {
        return { error: 'Tidak dapat menonaktifkan. Minimal harus ada 1 Admin Pusat aktif di sistem.' }
      }
    }

    const supabaseAdmin = createAdminClient()

    // Update ban state in Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: !isActive ? '876000h' : 'none'
    })

    // Force sign-out on deactivation
    if (!isActive) {
      await supabaseAdmin.auth.admin.signOut(id).catch(err => {
        console.warn(`[AUTH] Failed to force sign-out user ${id}:`, err?.message)
      })
    }

    // Update Prisma status
    await prisma.user.update({
      where: { id },
      data: { isActive }
    })

    revalidatePath('/admin/staff')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to toggle staff active status:', error)
    return { error: error.message || 'Terjadi kesalahan sistem.' }
  }
}
