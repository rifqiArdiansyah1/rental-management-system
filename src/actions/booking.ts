'use server'

import { checkVehicleAvailability, createDraftBookingCore, CreateDraftBookingPayload } from '@/lib/booking'

export async function checkVehicleAvailabilityAction(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
  return await checkVehicleAvailability(vehicleId, startDate, endDate)
}

export async function createDraftBookingAction(payload: CreateDraftBookingPayload) {
  // In a real application, you would also verify the user's session here
  // and ensure payload.customerId matches the authenticated user ID.
  
  return await createDraftBookingCore(payload)
}
