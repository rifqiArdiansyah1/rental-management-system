'use server'

import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
// @ts-ignore - midtrans-client might not have typescript types
import midtransClient from 'midtrans-client'
import { PaymentStatus } from '@prisma/client'

const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'

// Initialize Snap client
const snap = new midtransClient.Snap({
  isProduction: isProd,
  serverKey: serverKey,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
})

export async function getSnapToken(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // 1. Fetch the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, vehicle: true }
  })

  if (!booking) {
    throw new Error('Booking not found')
  }

  if (booking.customerId !== user.id) {
    throw new Error('Unauthorized access to this booking')
  }

  if (booking.status !== 'pending_payment') {
    throw new Error('Booking is not in pending payment state')
  }

  // 2. Check if a valid payment already exists
  const existingPayment = await prisma.payment.findFirst({
    where: { 
      bookingId: bookingId,
      status: 'pending'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (existingPayment && existingPayment.gatewayReference && existingPayment.snapToken) {
    const paymentAgeMinutes = (Date.now() - existingPayment.createdAt.getTime()) / (1000 * 60)
    if (paymentAgeMinutes < 50) {
      // Reuse the existing token
      return { token: existingPayment.snapToken, orderId: existingPayment.gatewayReference }
    }
  }

  // 3. Generate a Unique Order ID
  const orderId = `${bookingId}-${Date.now()}`
  
  // 4. Gross Amount (Must be integer for Midtrans SHA512 validation)
  const grossAmount = Math.round(Number(booking.totalPrice))

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount
    },
    customer_details: {
      first_name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone
    },
    item_details: [{
      id: booking.vehicleId,
      price: grossAmount,
      quantity: 1,
      name: `Sewa ${booking.vehicle.plateNumber}`
    }],
    expiry: {
      unit: "minutes",
      duration: 60 // 60 minutes expiry
    }
  }

  try {
    const transaction = await snap.createTransaction(parameter)
    const token = transaction.token

    // Save payment record
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        method: 'midtrans_snap',
        amount: grossAmount,
        status: PaymentStatus.pending,
        gatewayReference: orderId, // We use gatewayReference to store the order_id
        snapToken: token,
      }
    })

    return { token, orderId }
  } catch (error: any) {
    console.error('Midtrans Snap Error:', error.message)
    throw new Error('Failed to generate payment token')
  }
}
