'use server'

import { checkVehicleAvailability, createDraftBookingCore, CreateDraftBookingPayload } from '@/lib/booking'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { RentalType } from '@prisma/client'

export async function checkVehicleAvailabilityAction(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
  return await checkVehicleAvailability(vehicleId, startDate, endDate)
}

export type BookingFormPayload = {
  vehicleId: string
  branchId: string
  startDate: Date
  endDate: Date
  rentalType: RentalType
}

export async function createDraftBookingAction(payload: BookingFormPayload) {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Anda harus login terlebih dahulu untuk melakukan pemesanan.')
  }

  const customerId = user.id

  // Fix for Foreign Key Constraint: Ensure the user exists in the Customer table.
  // This helps if testing with an Admin account or if the register action failed to create the Customer row.
  const existingCustomer = await prisma.customer.findUnique({
    where: { id: customerId }
  })

  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        id: customerId,
        email: user.email!,
        name: user.user_metadata?.name || 'Test User',
        phone: user.user_metadata?.phone || '-',
      }
    })
  }

  const corePayload: CreateDraftBookingPayload = {
    customerId,
    vehicleId: payload.vehicleId,
    // For MVP, pickup and return branch are the same
    pickupBranchId: payload.branchId,
    returnBranchId: payload.branchId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    rentalType: payload.rentalType,
  }

  const minStartDate = new Date(Date.now() + 3 * 60 * 60 * 1000)
  if (corePayload.startDate < minStartDate) {
    return { success: false, error: 'Waktu pengambilan minimal 3 jam dari waktu pemesanan saat ini.' }
  }

  try {
    const booking = await createDraftBookingCore(corePayload)
    // In next phase, redirect to payment. For now, returning booking ID is enough to redirect on client.
    return { success: true, bookingId: booking.id }
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan saat membuat pesanan.' }
  }
}

/**
 * Self-service cancellation by customer.
 * Only allowed for bookings in `pending_payment` status (before payment is made).
 * Confirmed/paid bookings must go through adminCancelBooking (Issue #18).
 */
export async function customerCancelBooking(bookingId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Anda harus login untuk membatalkan pesanan.' }
  }

  // Fetch booking and verify ownership
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, status: true, pickupBranchId: true }
  })

  if (!booking) {
    return { success: false, error: 'Pesanan tidak ditemukan.' }
  }

  // Guard: ownership check
  if (booking.customerId !== user.id) {
    return { success: false, error: 'Anda tidak berhak membatalkan pesanan ini.' }
  }

  // Guard: only pending_payment can be self-cancelled
  if (booking.status !== 'pending_payment') {
    return { success: false, error: 'Hanya pesanan yang belum dibayar yang dapat dibatalkan secara mandiri.' }
  }

  // Cancel the booking
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancellationNote: 'Dibatalkan oleh customer sebelum pembayaran.',
      cancelledBy: user.id,
    }
  })

  return { success: true }
}
