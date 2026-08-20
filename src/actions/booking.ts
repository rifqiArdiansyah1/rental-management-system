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
