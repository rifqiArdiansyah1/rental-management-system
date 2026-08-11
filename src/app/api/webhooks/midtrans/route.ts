import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import crypto from 'crypto'
import { PaymentStatus, BookingStatus } from '@prisma/client'

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // 1. Signature Validation
    const { 
      order_id, 
      status_code, 
      gross_amount, 
      signature_key,
      transaction_status,
      fraud_status
    } = body

    const hash = crypto.createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`)
      .digest('hex')

    if (hash !== signature_key) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 2. Extract Booking ID from order_id (Format: bookingId-timestamp)
    // Find the payment record based on order_id (gatewayReference)
    const payment = await prisma.payment.findUnique({
      where: { gatewayReference: order_id }
    })

    if (!payment) {
      // If we don't know this order, just return 200 to acknowledge receipt
      return NextResponse.json({ message: 'Order ID not found in system' }, { status: 200 })
    }

    const bookingId = payment.bookingId

    // 3. Process Status
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (transaction_status === 'capture' && fraud_status === 'challenge') {
        // Pending challenge, ignore for MVP or set to pending
        return NextResponse.json({ message: 'Challenge ignored' }, { status: 200 })
      }

      // ATOMIC UPDATE: Only update if booking is still pending_payment
      const updateResult = await prisma.booking.updateMany({
        where: { 
          id: bookingId,
          status: BookingStatus.pending_payment 
        },
        data: { status: BookingStatus.confirmed }
      })

      if (updateResult.count === 0) {
        // RACE CONDITION: The booking is no longer pending_payment.
        // It might have been cancelled by the Cron Job.
        const currentBooking = await prisma.booking.findUnique({ where: { id: bookingId } })
        console.error(`[LATE SETTLEMENT ANOMALY] Received settlement for Booking ${bookingId} but status is ${currentBooking?.status}. Manual review/refund required.`)
        
        // We still update the Payment record to success so we know we received the money.
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.success }
        })
        
        return NextResponse.json({ message: 'Anomaly logged' }, { status: 200 })
      } else {
        // Successfully updated booking, update payment as well
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.success }
        })

        // Fetch details for Email
        const fullBooking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { 
            customer: true, 
            vehicle: { include: { category: true } } 
          }
        })

        if (fullBooking) {
          try {
            const { sendBookingConfirmedEmail } = await import('@/utils/email')
            await sendBookingConfirmedEmail({
              toEmail: fullBooking.customer.email,
              customerName: fullBooking.customer.name,
              bookingId: fullBooking.id,
              vehicleName: fullBooking.vehicle.category.name,
              startDate: fullBooking.startDate.toLocaleDateString('id-ID'),
              endDate: fullBooking.endDate.toLocaleDateString('id-ID'),
              totalPrice: `Rp ${Number(fullBooking.totalPrice).toLocaleString('id-ID')}`
            })
          } catch (emailError: any) {
            console.error('[EMAIL ERROR] Failed to send booking confirmation:', emailError.message)
            // Error is isolated. Webhook will still return 200 OK.
          }
        }
      }

    } else if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      // ATOMIC UPDATE: Mark as cancelled. This releases the vehicle.
      const updateResult = await prisma.booking.updateMany({
        where: { 
          id: bookingId,
          status: BookingStatus.pending_payment 
        },
        data: { status: BookingStatus.cancelled }
      })

      // Update payment to failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed }
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Webhook Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
