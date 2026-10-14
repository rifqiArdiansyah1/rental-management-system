'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { VehicleExpenseCategory, UserRole, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. unit/e2e tests)
  }
}

export interface RecordVehicleExpenseInput {
  vehicleId: string
  amount: number
  category: VehicleExpenseCategory
  expenseDate?: string | Date
  vendorName?: string
  invoiceNumber?: string
  receiptUrl?: string
  description?: string
  odometerKm?: number
  actor?: { id: string; role: UserRole; branchId?: string | null }
}

/**
 * Server Action: Mencatat pengeluaran kas perawatan armada (bengkel, sparepart, ban, cuci, pajak).
 * Otorisasi: staff_cabang, admin_cabang, dan admin_pusat (scoped ke cabang kendaraan).
 */
export async function recordVehicleExpenseAction(
  data: RecordVehicleExpenseInput
): Promise<{ success?: boolean; expenseId?: string; error?: string }> {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && data.actor)
      ? data.actor
      : await requireAdminSession()

    if (!data.vehicleId) {
      return { error: 'Kendaraan wajib dipilih.' }
    }

    const amountNum = Number(data.amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return { error: 'Nominal pengeluaran harus berupa angka lebih besar dari 0.' }
    }

    const validCategories = Object.values(VehicleExpenseCategory)
    if (!data.category || !validCategories.includes(data.category)) {
      return { error: 'Kategori pengeluaran tidak valid.' }
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      include: { branch: true }
    })

    if (!vehicle) {
      return { error: 'Kendaraan tidak ditemukan.' }
    }

    if (!vehicle.isActive) {
      return { error: 'Kendaraan nonaktif tidak dapat dicatat pengeluarannya.' }
    }

    const scope = (process.env.NODE_ENV !== 'production' && data.actor)
      ? (data.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: data.actor.branchId! })
      : await getStaffScope()

    assertInScope([vehicle.branchId], scope)

    let parsedExpenseDate = new Date()
    if (data.expenseDate) {
      parsedExpenseDate = typeof data.expenseDate === 'string' ? new Date(data.expenseDate) : data.expenseDate
      if (isNaN(parsedExpenseDate.getTime())) {
        return { error: 'Format tanggal pengeluaran tidak valid.' }
      }
      // Jangan izinkan tanggal di masa depan
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      if (parsedExpenseDate > tomorrow) {
        return { error: 'Tanggal pengeluaran tidak boleh berada di masa depan.' }
      }
    }

    const rawOdo = data.odometerKm
    let validOdometerKm: number | null = null
    if (rawOdo !== undefined && rawOdo !== null && String(rawOdo).trim() !== '') {
      const odoNum = Number(rawOdo)
      if (isNaN(odoNum) || odoNum < 0) {
        return { error: 'Odometer harus berupa angka non-negatif.' }
      }
      validOdometerKm = Math.round(odoNum)
    }

    const createdExpense = await prisma.$transaction(async (tx) => {
      // 1. Catat pengeluaran
      const expense = await tx.vehicleExpense.create({
        data: {
          vehicleId: vehicle.id,
          branchId: vehicle.branchId,
          category: data.category,
          amount: new Prisma.Decimal(amountNum),
          odometerKm: validOdometerKm,
          vendorName: data.vendorName?.trim() || null,
          invoiceNumber: data.invoiceNumber?.trim() || null,
          receiptUrl: data.receiptUrl?.trim() || null,
          description: data.description?.trim() || null,
          expenseDate: parsedExpenseDate,
          recordedById: adminUser.id
        }
      })

      // 2. Jika kategori adalah servis berkala rutin dan odometer diisi, update meter servis armada
      if (data.category === VehicleExpenseCategory.routine_service && validOdometerKm !== null) {
        const nextCurrentKm = (vehicle.currentOdometerKm == null || validOdometerKm > vehicle.currentOdometerKm)
          ? validOdometerKm
          : vehicle.currentOdometerKm

        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            lastServiceOdometerKm: validOdometerKm,
            currentOdometerKm: nextCurrentKm
          }
        })
      }

      return expense
    })

    // 3. Catat ke AuditLog
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: vehicle.branchId,
      action: 'vehicle.expense_recorded',
      entityType: 'VehicleExpense',
      entityId: createdExpense.id,
      metadata: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        category: createdExpense.category,
        amount: amountNum,
        vendorName: createdExpense.vendorName,
        invoiceNumber: createdExpense.invoiceNumber,
        odometerKm: validOdometerKm,
        expenseDate: parsedExpenseDate.toISOString(),
        description: createdExpense.description
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/analytics')
    safeRevalidatePath('/admin/dashboard')

    return { success: true, expenseId: createdExpense.id }
  } catch (error: any) {
    console.error('[EXPENSE_ERROR] recordVehicleExpenseAction failed:', error)
    return { error: error.message || 'Gagal menyimpan pengeluaran armada.' }
  }
}

/**
 * Server Action: Mengambil riwayat pengeluaran armada.
 */
export async function getVehicleExpensesAction(params?: {
  vehicleId?: string
  branchId?: string
  limit?: number
  offset?: number
}) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    let targetBranchId: string | null = null
    if (scope.scope === 'branch') {
      targetBranchId = scope.branchId
    } else if (scope.scope === 'all' && params?.branchId && params.branchId !== 'all') {
      targetBranchId = params.branchId
    }

    const where: Prisma.VehicleExpenseWhereInput = {
      isVoided: false,
      ...(targetBranchId ? { branchId: targetBranchId } : {}),
      ...(params?.vehicleId ? { vehicleId: params.vehicleId } : {})
    }

    const expenses = await prisma.vehicleExpense.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            name: true,
            category: { select: { name: true } }
          }
        },
        branch: { select: { id: true, name: true, city: true } },
        recordedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { expenseDate: 'desc' },
      take: params?.limit || 50,
      skip: params?.offset || 0
    })

    return { success: true, expenses: JSON.parse(JSON.stringify(expenses)) }
  } catch (error: any) {
    return { error: error.message || 'Gagal mengambil data pengeluaran armada.' }
  }
}

/**
 * Server Action: Membatalkan (void) transaksi pengeluaran yang keliru diinput.
 * Otorisasi: Hanya Admin Cabang dan Admin Pusat (staf dilarang untuk mencegah fraud).
 */
export async function voidVehicleExpenseAction(params: {
  expenseId: string
  voidReason: string
  actor?: { id: string; role: UserRole; branchId?: string | null }
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && params.actor)
      ? params.actor
      : await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf tidak memiliki wewenang untuk membatalkan pengeluaran kas.' }
    }

    if (!params.voidReason || params.voidReason.trim().length < 5) {
      return { error: 'Alasan pembatalan (void) wajib diisi minimal 5 karakter.' }
    }

    const expense = await prisma.vehicleExpense.findUnique({
      where: { id: params.expenseId },
      include: { vehicle: true, branch: true }
    })

    if (!expense) {
      return { error: 'Data pengeluaran tidak ditemukan.' }
    }

    if (expense.isVoided) {
      return { error: 'Pengeluaran ini telah dibatalkan sebelumnya.' }
    }

    const scope = (process.env.NODE_ENV !== 'production' && params.actor)
      ? (params.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: params.actor.branchId! })
      : await getStaffScope()

    assertInScope([expense.branchId], scope)

    await prisma.vehicleExpense.update({
      where: { id: expense.id },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidedById: adminUser.id,
        voidReason: params.voidReason.trim()
      }
    })

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: expense.branchId,
      action: 'vehicle.expense_voided',
      entityType: 'VehicleExpense',
      entityId: expense.id,
      metadata: {
        originalAmount: Number(expense.amount),
        vehicleId: expense.vehicleId,
        plateNumber: expense.vehicle.plateNumber,
        category: expense.category,
        voidReason: params.voidReason.trim()
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/analytics')
    safeRevalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error: any) {
    console.error('[EXPENSE_VOID_ERROR] voidVehicleExpenseAction failed:', error)
    return { error: error.message || 'Gagal membatalkan pengeluaran.' }
  }
}
