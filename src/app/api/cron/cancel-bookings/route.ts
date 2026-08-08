import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { BookingStatus, PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 1. Verify Secret
  const authHeader = req.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_MANUAL_SECRET}`
  
  if (!process.env.CRON_MANUAL_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 90 minutes threshold
    const threshold = new Date(Date.now() - 90 * 60 * 1000)

    // Find all abandoned bookings
    const abandonedBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.pending_payment,
        createdAt: { lt: threshold }
      },
      select: { id: true }
    })

    const bookingIds = abandonedBookings.map(b => b.id)

    if (bookingIds.length > 0) {
      // 1. Cancel the bookings atomically
      await prisma.booking.updateMany({
        where: {
          id: { in: bookingIds },
          status: BookingStatus.pending_payment
        },
        data: { status: BookingStatus.cancelled }
      })

      // 2. Cascade to Payments
      await prisma.payment.updateMany({
        where: {
          bookingId: { in: bookingIds },
          status: PaymentStatus.pending
        },
        data: { status: PaymentStatus.failed }
      })

      console.log(`[CRON] Successfully cancelled ${bookingIds.length} abandoned bookings.`)
    } else {
      console.log(`[CRON] No abandoned bookings found.`)
    }

    // OBSERVABILITY: Check the oldest pending booking
    const oldestPending = await prisma.booking.findFirst({
      where: { status: BookingStatus.pending_payment },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true }
    })

    if (oldestPending) {
      const ageMinutes = Math.floor((Date.now() - oldestPending.createdAt.getTime()) / (1000 * 60))
      console.log(`[OBSERVABILITY] Oldest pending_payment booking is ${ageMinutes} minutes old (ID: ${oldestPending.id}).`)
      
      if (ageMinutes > 120) {
        console.error(`[ALERT] Found booking ${oldestPending.id} pending for ${ageMinutes} mins! Cron might be failing or threshold logic is wrong.`)
      }
    }

    return NextResponse.json({ 
      success: true, 
      cancelledCount: bookingIds.length 
    })
    
  } catch (error: any) {
    console.error('Cron Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
