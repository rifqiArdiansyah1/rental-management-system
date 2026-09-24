'use server'

import { checkVehicleAvailability, createDraftBookingCore, CreateDraftBookingPayload } from '@/lib/booking'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { RentalType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { TURNOVER_BUFFER_MS, isWithinOperatingHoursWIB } from '@/lib/constants'
import { getLocale } from '@/lib/i18n/server'
import { getActionErrorMessage, ActionErrorCode } from '@/lib/i18n/errors'

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

export type BookingActionResult = {
  success: boolean
  bookingId?: string
  error?: string
  errorCode?: ActionErrorCode
}

export async function createDraftBookingAction(payload: BookingFormPayload): Promise<BookingActionResult> {
  const locale = await getLocale()
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      success: false,
      error: getActionErrorMessage('AUTH_REQUIRED', locale),
      errorCode: 'AUTH_REQUIRED',
    }
  }

  const customerId = user.id

  // Fix for Foreign Key Constraint: Ensure the user exists in the Customer table.
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

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: payload.vehicleId },
    select: {
      branchId: true,
      isActive: true,
      branch: {
        select: { name: true }
      }
    }
  })

  if (!vehicle || !vehicle.isActive) {
    return {
      success: false,
      error: getActionErrorMessage('VEHICLE_NOT_FOUND', locale),
      errorCode: 'VEHICLE_NOT_FOUND',
    }
  }

  if (vehicle.branchId !== payload.branchId) {
    return {
      success: false,
      error: getActionErrorMessage('BRANCH_MISMATCH', locale),
      errorCode: 'BRANCH_MISMATCH',
    }
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
    locale,
  }

  const minStartDate = new Date(Date.now() + TURNOVER_BUFFER_MS)
  if (corePayload.startDate < minStartDate) {
    return {
      success: false,
      error: getActionErrorMessage('BUFFER_VIOLATION', locale),
      errorCode: 'BUFFER_VIOLATION',
    }
  }

  if (!isWithinOperatingHoursWIB(corePayload.startDate) || !isWithinOperatingHoursWIB(corePayload.endDate)) {
    return {
      success: false,
      error: getActionErrorMessage('OPERATING_HOURS_VIOLATION', locale),
      errorCode: 'OPERATING_HOURS_VIOLATION',
    }
  }

  try {
    const booking = await createDraftBookingCore(corePayload)
    return { success: true, bookingId: booking.id }
  } catch (err: any) {
    const msg = String(err?.message || '')
    const isOverlap =
      msg.includes('booking_vehicle_no_overlap') ||
      msg.includes('rentang tanggal') ||
      msg.includes('tidak tersedia') ||
      msg.includes('already reserved')
    const code: ActionErrorCode = isOverlap ? 'BOOKING_OVERLAP' : 'UNKNOWN_ERROR'

    return {
      success: false,
      error: getActionErrorMessage(code, locale),
      errorCode: code,
    }
  }
}

/**
 * Self-service cancellation by customer.
 * Only allowed for bookings in `pending_payment` status (before payment is made).
 * Confirmed/paid bookings must go through adminCancelBooking (Issue #18).
 */
export async function customerCancelBooking(bookingId: string): Promise<BookingActionResult> {
  const locale = await getLocale()
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: getActionErrorMessage('AUTH_REQUIRED', locale),
      errorCode: 'AUTH_REQUIRED',
    }
  }

  // Fetch booking to verify existence, customer ownership, and get vehicleId for precise revalidation
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, status: true, vehicleId: true }
  })

  if (!booking) {
    return {
      success: false,
      error: getActionErrorMessage('BOOKING_NOT_FOUND', locale),
      errorCode: 'BOOKING_NOT_FOUND',
    }
  }

  // Guard: ownership check
  if (booking.customerId !== user.id) {
    return {
      success: false,
      error: getActionErrorMessage('FORBIDDEN_CANCELLATION', locale),
      errorCode: 'FORBIDDEN_CANCELLATION',
    }
  }

  // Atomic Conditional Update:
  // Combine status guard and cancellation write into a single conditional updateMany inside a transaction.
  // This prevents race condition if a payment gateway settlement webhook commits concurrently.
  const cancellationNote = locale === 'en'
    ? 'Cancelled by customer prior to payment.'
    : 'Dibatalkan oleh pelanggan sebelum pembayaran.'

  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.booking.updateMany({
      where: {
        id: bookingId,
        customerId: user.id,
        status: 'pending_payment',
      },
      data: {
        status: 'cancelled',
        cancellationNote,
        cancelledBy: null, // explicit null: customer initiative, not staff
      },
    })

    if (updateResult.count === 0) {
      // The booking was NOT updated. Query current status to give precise friendly error
      // without modifying Payment status under any circumstance!
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      })

      if (current?.status === 'cancelled') {
        return { success: false, errorCode: 'ALREADY_CANCELLED' as ActionErrorCode }
      }
      return { success: false, errorCode: 'CANNOT_CANCEL_STATUS' as ActionErrorCode }
    }

    // Only cascade to Payment if booking was successfully transitioned from pending_payment
    // Note: status 'failed' denotes unpaid-abandoned/cancelled before settlement.
    await tx.payment.updateMany({
      where: {
        bookingId,
        status: 'pending',
      },
      data: { status: 'failed' },
    })

    return { success: true }
  })

  if (!result.success && result.errorCode) {
    return {
      success: false,
      error: getActionErrorMessage(result.errorCode, locale),
      errorCode: result.errorCode,
    }
  }

  // Invalidate paths so that vehicle availability, dashboard, and checkout are immediately fresh
  revalidatePath('/dashboard')
  revalidatePath(`/booking/${bookingId}`)
  revalidatePath('/')
  if (booking.vehicleId) {
    revalidatePath(`/vehicles/${booking.vehicleId}`)
  }
  revalidatePath('/admin/bookings')

  return { success: true }
}
