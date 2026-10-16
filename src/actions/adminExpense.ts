'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { VehicleExpenseCategory, UserRole, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  COST_TRACKING_START_DATE,
  ODOMETER_SERVICE_TOLERANCE_KM,
  EXPENSE_BACKDATE_LIMIT_STAFF_DAYS,
  EXPENSE_BACKDATE_LIMIT_ADMIN_DAYS
} from '@/lib/constants'

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
  receiptPath?: string
  description?: string
  odometerKm?: number
  allowDuplicateInvoice?: boolean
  duplicateReason?: string
  actor?: { id: string; role: UserRole; branchId?: string | null }
}

export interface RecordVehicleExpenseResult {
  success?: boolean
  expenseId?: string
  error?: string
  warning?: string
  requiresConfirmation?: boolean
}

/**
 * Server Action: Mencatat pengeluaran kas armada (bengkel, sparepart, ban, cuci, pajak, asuransi).
 * Otorisasi: staff_cabang, admin_cabang, dan admin_pusat (scoped ke cabang kendaraan).
 * Single Write Path dengan Row Lock 'FOR UPDATE' & Pola Non-Blocking Odometer Skip-and-Audit.
 */
export async function recordVehicleExpenseAction(
  data: RecordVehicleExpenseInput
): Promise<RecordVehicleExpenseResult> {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && data.actor)
      ? data.actor
      : await requireAdminSession()

    if (!data.vehicleId) {
      return { error: 'Kendaraan wajib dipilih.' }
    }

    const amountNum = Number(data.amount)
    if (isNaN(amountNum) || amountNum < 0) {
      return { error: 'Nominal pengeluaran harus berupa angka non-negatif.' }
    }

    const validCategories = Object.values(VehicleExpenseCategory)
    if (!data.category || !validCategories.includes(data.category)) {
      return { error: 'Kategori pengeluaran tidak valid.' }
    }

    // Validasi Tanggal Pengeluaran & Batas Backdate
    let parsedExpenseDate = new Date()
    if (data.expenseDate) {
      parsedExpenseDate = typeof data.expenseDate === 'string' ? new Date(data.expenseDate) : data.expenseDate
      if (isNaN(parsedExpenseDate.getTime())) {
        return { error: 'Format tanggal pengeluaran tidak valid.' }
      }
    }

    const now = new Date()
    const diffMs = now.getTime() - parsedExpenseDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    // Anti-future date (toleransi 1 hari untuk perbedaan timezone WIB vs UTC)
    if (diffDays < -1) {
      return { error: 'Tanggal pengeluaran tidak boleh berada di masa depan.' }
    }

    // Batas mundur pencatatan (Backdate guard)
    const maxBackdateDays = adminUser.role === 'staff_cabang'
      ? EXPENSE_BACKDATE_LIMIT_STAFF_DAYS
      : EXPENSE_BACKDATE_LIMIT_ADMIN_DAYS

    if (diffDays > maxBackdateDays) {
      return {
        error: `Tanggal pengeluaran melebihi batas mundur yang diizinkan (${maxBackdateDays} hari untuk peran Anda).`
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

    const scope = (process.env.NODE_ENV !== 'production' && data.actor)
      ? (data.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: data.actor.branchId! })
      : await getStaffScope()

    // Eksekusi Transaksi Atomik dengan Row Lock pada Vehicle
    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Explicit Row Lock 'FOR UPDATE' pada Vehicle
      await tx.$queryRawUnsafe('SELECT id FROM "Vehicle" WHERE id = $1 FOR UPDATE', data.vehicleId)

      const vehicle = await tx.vehicle.findUnique({
        where: { id: data.vehicleId },
        include: { branch: true }
      })

      if (!vehicle) {
        throw new Error('Kendaraan tidak ditemukan.')
      }

      // Pengecualian mutasi: Hanya admin_pusat yang diizinkan mencatat pengeluaran pada armada nonaktif / moved
      if (!vehicle.isActive && adminUser.role !== 'admin_pusat') {
        throw new Error('Kendaraan nonaktif tidak dapat dicatat pengeluarannya kecuali oleh Admin Pusat.')
      }

      // Branch scoping diturunkan server-side dari branchId kendaraan fisik
      assertInScope([vehicle.branchId], scope)

      // 2. Deteksi Nota Ganda (Soft Warning dengan Konfirmasi)
      const trimmedVendor = data.vendorName?.trim()
      const trimmedInvoice = data.invoiceNumber?.trim()
      if (trimmedVendor && trimmedInvoice) {
        const existingInvoice = await tx.vehicleExpense.findFirst({
          where: {
            branchId: vehicle.branchId,
            isVoided: false,
            invoiceNumber: trimmedInvoice,
            vendorName: { equals: trimmedVendor, mode: 'insensitive' }
          },
          select: { id: true, expenseDate: true }
        })

        if (existingInvoice && !data.allowDuplicateInvoice) {
          const formattedDate = existingInvoice.expenseDate.toLocaleDateString('id-ID')
          return {
            requiresConfirmation: true,
            warning: `Nomor nota "${trimmedInvoice}" dari vendor ini sudah pernah dicatat di cabang ini pada tanggal ${formattedDate}. Apakah Anda ingin melanjutkan pencatatan nota yang sama?`,
            error: `Nomor nota "${trimmedInvoice}" sudah pernah dicatat di cabang ini. Konfirmasi untuk melanjutkan.`
          }
        }
      }

      // 3. Pola Non-Blocking Odometer Skip-and-Audit
      // Biaya selalu tersimpan. Jalur ini TIDAK PERNAH memodifikasi currentOdometerKm.
      let isOdometerValid = true
      let anomalyReason: string | null = null
      let odometerWarning: string | null = null

      if (validOdometerKm !== null) {
        // Validasi batas bawah: tidak boleh lebih rendah dari servis sebelumnya
        if (vehicle.lastServiceOdometerKm != null && validOdometerKm < vehicle.lastServiceOdometerKm) {
          isOdometerValid = false
          anomalyReason = `KM servis (${validOdometerKm.toLocaleString('id-ID')} km) lebih rendah dari servis sebelumnya (${vehicle.lastServiceOdometerKm.toLocaleString('id-ID')} km).`
        }
        // Validasi batas atas: hanya diperiksa jika currentOdometerKm != null
        else if (
          vehicle.currentOdometerKm != null &&
          validOdometerKm > (vehicle.currentOdometerKm + ODOMETER_SERVICE_TOLERANCE_KM)
        ) {
          isOdometerValid = false
          anomalyReason = `KM servis (${validOdometerKm.toLocaleString('id-ID')} km) melebihi batas wajar odometer terkini (${vehicle.currentOdometerKm.toLocaleString('id-ID')} + ${ODOMETER_SERVICE_TOLERANCE_KM} km).`
        }
      }

      // Jika servis rutin dan odometer lolos validasi -> update lastServiceOdometerKm saja
      if (data.category === VehicleExpenseCategory.routine_service && validOdometerKm !== null) {
        if (isOdometerValid) {
          await tx.vehicle.update({
            where: { id: vehicle.id },
            data: {
              lastServiceOdometerKm: validOdometerKm
            }
          })
        } else {
          odometerWarning = `Biaya servis berhasil disimpan. Namun ${anomalyReason} Meter servis armada tidak diperbarui dan dicatat sebagai anomali.`
        }
      }

      // 4. Catat baris VehicleExpense
      const expense = await tx.vehicleExpense.create({
        data: {
          vehicleId: vehicle.id,
          branchId: vehicle.branchId,
          category: data.category,
          amount: new Prisma.Decimal(amountNum),
          odometerKm: validOdometerKm,
          vendorName: trimmedVendor || null,
          invoiceNumber: trimmedInvoice || null,
          receiptPath: data.receiptPath?.trim() || null,
          description: data.description?.trim() || null,
          expenseDate: parsedExpenseDate,
          recordedById: adminUser.id
        }
      })

      return {
        expense,
        vehicle,
        isOdometerValid,
        anomalyReason,
        odometerWarning
      }
    })

    if ('requiresConfirmation' in txResult && txResult.requiresConfirmation) {
      return txResult
    }

    const { expense, vehicle, isOdometerValid, anomalyReason, odometerWarning } = txResult as {
      expense: any
      vehicle: any
      isOdometerValid: boolean
      anomalyReason: string | null
      odometerWarning: string | null
    }

    // 5. Catat AuditLog Terstruktur
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: vehicle.branchId,
      action: 'vehicle.expense_recorded',
      entityType: 'VehicleExpense',
      entityId: expense.id,
      metadata: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        category: expense.category,
        amount: amountNum,
        vendorName: expense.vendorName,
        invoiceNumber: expense.invoiceNumber,
        odometerKm: validOdometerKm,
        isOdometerAnomaly: !isOdometerValid,
        odometerAnomalyReason: anomalyReason,
        isPostRelocationExpense: !vehicle.isActive && adminUser.role === 'admin_pusat',
        duplicateConfirmed: Boolean(data.allowDuplicateInvoice),
        duplicateReason: data.duplicateReason?.trim() || null,
        expenseDate: parsedExpenseDate.toISOString(),
        description: expense.description
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/analytics')
    safeRevalidatePath('/admin/dashboard')

    return {
      success: true,
      expenseId: expense.id,
      warning: odometerWarning || undefined
    }
  } catch (error: any) {
    console.error('[EXPENSE_ERROR] recordVehicleExpenseAction failed:', error)
    return { error: error.message || 'Gagal menyimpan pengeluaran armada.' }
  }
}

/**
 * Server Action: Mengambil riwayat pengeluaran armada.
 * Otorisasi: Hanya admin_cabang dan admin_pusat (staf dilarang melihat data finansial).
 */
export async function getVehicleExpensesAction(params?: {
  vehicleId?: string
  branchId?: string
  limit?: number
  offset?: number
}) {
  try {
    const adminUser = await requireAdminSession()

    // Otorisasi Least-Privilege: Staf dilarang mengakses riwayat finansial
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf cabang tidak memiliki akses melihat data finansial pengeluaran armada.' }
    }

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
 * Server Action: Mendapatkan Temporary Signed URL kuitansi privat pengeluaran armada.
 * Otorisasi: Hanya Admin Cabang (dalam scope) dan Admin Pusat (durasi 5 menit).
 */
export async function getVehicleExpenseReceiptSignedUrlAction(expenseId: string): Promise<{
  success?: boolean
  signedUrl?: string
  error?: string
}> {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf tidak memiliki akses melihat kuitansi finansial.' }
    }

    const expense = await prisma.vehicleExpense.findUnique({
      where: { id: expenseId },
      include: { branch: true }
    })

    if (!expense) {
      return { error: 'Data pengeluaran tidak ditemukan.' }
    }

    if (!expense.receiptPath) {
      return { error: 'Kuitansi tidak memiliki berkas lampiran.' }
    }

    const scope = await getStaffScope()
    assertInScope([expense.branchId], scope)

    const bucketName = 'vehicle-receipts'
    let storagePath = expense.receiptPath
    if (storagePath.includes(`/${bucketName}/`)) {
      const parts = storagePath.split(`/${bucketName}/`)
      storagePath = parts[1]
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 300) // 5 menit

    if (error || !data?.signedUrl) {
      console.error('[RECEIPT_SIGNED_URL_ERROR]', error)
      return { error: 'Gagal membuat tautan akses kuitansi privat.' }
    }

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: expense.branchId,
      action: 'vehicle.expense_receipt_viewed',
      entityType: 'VehicleExpense',
      entityId: expense.id,
      metadata: {
        vehicleId: expense.vehicleId,
        invoiceNumber: expense.invoiceNumber
      }
    })

    return { success: true, signedUrl: data.signedUrl }
  } catch (error: any) {
    return { error: error.message || 'Gagal memproses tautan kuitansi.' }
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
