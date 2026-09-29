'use server'

import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit'
import { notifyEmergencyIncident } from '@/utils/notifications'
import { getVehicleDisplayName } from '@/lib/vehicleHelper'
import { VALID_INCIDENT_CATEGORIES } from '@/lib/constants'
import type { IncidentCategory } from '@/lib/constants'

export interface ReportIncidentParams {
  bookingId: string
  category: string
  description: string
  location?: string | null
}

export interface ResolveIncidentParams {
  incidentId: string
  resolution: string
}

export interface IncidentActionResult {
  success: boolean
  incidentId?: string
  error?: string
  errorCode?: string
}

/**
 * Server Action bagi pelanggan yang sedang menyewa (booking status: 'ongoing')
 * untuk melaporkan insiden/kendala darurat selama perjalanan.
 */
export async function reportEmergencyIncidentAction(
  params: ReportIncidentParams
): Promise<IncidentActionResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Silakan masuk ke akun Anda terlebih dahulu.',
        errorCode: 'AUTH_REQUIRED',
      }
    }

    const { bookingId, category, description, location } = params

    if (!bookingId) {
      return {
        success: false,
        error: 'ID Pesanan wajib disertakan.',
        errorCode: 'INVALID_INPUT',
      }
    }

    const trimmedCategory = category?.trim().toLowerCase()
    if (!trimmedCategory || !VALID_INCIDENT_CATEGORIES.includes(trimmedCategory as any)) {
      return {
        success: false,
        error: 'Kategori insiden tidak valid. Pilih salah satu kategori darurat yang tersedia.',
        errorCode: 'INVALID_CATEGORY',
      }
    }

    const trimmedDescription = description?.trim()
    if (!trimmedDescription || trimmedDescription.length < 5) {
      return {
        success: false,
        error: 'Deskripsi kendala minimal 5 karakter untuk kejelasan tim operasional.',
        errorCode: 'INVALID_DESCRIPTION',
      }
    }

    // 1. Ambil detail booking & verifikasi kepemilikan serta status sewa
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          include: {
            category: true,
          },
        },
        pickupBranch: {
          include: {
            users: {
              where: { isActive: true },
              select: { email: true },
            },
          },
        },
        customer: true,
        driver: true,
      },
    })

    if (!booking) {
      return {
        success: false,
        error: 'Pesanan tidak ditemukan.',
        errorCode: 'NOT_FOUND',
      }
    }

    if (booking.customerId !== user.id) {
      return {
        success: false,
        error: 'Akses ditolak: Anda hanya dapat melaporkan kendala untuk pesanan milik Anda sendiri.',
        errorCode: 'FORBIDDEN',
      }
    }

    if (booking.status !== 'ongoing') {
      return {
        success: false,
        error: 'Laporan darurat perjalanan hanya dapat diajukan untuk sewa yang sedang berlangsung (ongoing).',
        errorCode: 'INVALID_STATUS',
      }
    }

    // 2. Simpan Laporan Insiden ke Database dengan snapshot branchId dari booking.pickupBranchId
    const incident = await prisma.incidentReport.create({
      data: {
        bookingId: booking.id,
        customerId: user.id,
        branchId: booking.pickupBranchId,
        category: trimmedCategory,
        description: trimmedDescription.slice(0, 2000),
        location: location?.trim() ? location.trim().slice(0, 500) : null,
        status: 'open',
      },
    })

    // 3. Dispatch Notifikasi Darurat (Email & WhatsApp Cabang + Sopir jika relevan)
    const vehicleName = getVehicleDisplayName(booking.vehicle)
    const staffEmails = booking.pickupBranch.users.map((u) => u.email).filter(Boolean)

    notifyEmergencyIncident({
      incidentId: incident.id,
      bookingId: booking.id,
      customerId: user.id,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      customerEmail: booking.customer.email,
      branchId: booking.pickupBranchId,
      branchName: booking.pickupBranch.name,
      branchPhone: booking.pickupBranch.phone,
      branchStaffEmails: staffEmails,
      vehicleName,
      plateNumber: booking.vehicle.plateNumber,
      category: incident.category,
      description: incident.description,
      location: incident.location,
      reportedAt: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      driverName: booking.driver?.name,
      driverPhone: booking.driver?.phone,
      withDriver: booking.rentalType === 'with_driver',
    }).catch((err) => {
      console.error('[EMERGENCY NOTIFICATION ERROR]', err)
    })

    // 4. Revalidate cache halaman relevan
    revalidatePath('/contact')
    revalidatePath('/dashboard')
    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${booking.id}`)

    return {
      success: true,
      incidentId: incident.id,
    }
  } catch (error: any) {
    console.error('[REPORT_EMERGENCY_INCIDENT_ERROR]', error)
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan sistem saat mengirim laporan darurat.',
      errorCode: 'INTERNAL_ERROR',
    }
  }
}

/**
 * Server Action bagi staf / admin cabang untuk menyelesaikan laporan insiden.
 */
export async function resolveIncidentAction(
  params: ResolveIncidentParams
): Promise<IncidentActionResult> {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    const { incidentId, resolution } = params

    if (!incidentId) {
      return {
        success: false,
        error: 'ID Insiden wajib disertakan.',
        errorCode: 'INVALID_INPUT',
      }
    }

    const trimmedResolution = resolution?.trim()
    if (!trimmedResolution || trimmedResolution.length < 5) {
      return {
        success: false,
        error: 'Catatan resolusi penanganan minimal 5 karakter.',
        errorCode: 'INVALID_RESOLUTION',
      }
    }

    // 1. Ambil detail insiden
    const incident = await prisma.incidentReport.findUnique({
      where: { id: incidentId },
      include: {
        booking: true,
      },
    })

    if (!incident) {
      return {
        success: false,
        error: 'Laporan insiden tidak ditemukan.',
        errorCode: 'NOT_FOUND',
      }
    }

    // 2. Wewenang cabang (assertInScope)
    assertInScope([incident.branchId], scope)

    // 3. Update status insiden menjadi 'resolved'
    const updated = await prisma.incidentReport.update({
      where: { id: incident.id },
      data: {
        status: 'resolved',
        resolution: trimmedResolution.slice(0, 2000),
        resolvedAt: new Date(),
      },
    })

    // 4. Catat Audit Log
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: incident.branchId,
      action: 'incident.resolve',
      entityType: 'IncidentReport',
      entityId: incident.id,
      metadata: {
        bookingId: incident.bookingId,
        previousStatus: incident.status,
        resolution: trimmedResolution,
      },
    })

    // 5. Revalidate cache
    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${incident.bookingId}`)
    revalidatePath('/contact')

    return {
      success: true,
      incidentId: updated.id,
    }
  } catch (error: any) {
    console.error('[RESOLVE_INCIDENT_ERROR]', error)
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan sistem saat menyelesaikan insiden.',
      errorCode: 'INTERNAL_ERROR',
    }
  }
}
