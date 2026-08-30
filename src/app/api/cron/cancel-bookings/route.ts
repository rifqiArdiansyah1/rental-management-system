import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/utils/prisma'
import { BookingStatus, PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 1. Verify Secret (Auth-First Guard before any database access or telemetry mutation)
  const authHeader = req.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_MANUAL_SECRET}`
  
  if (!process.env.CRON_MANUAL_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

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
    let bookingsCancelled = 0

    if (bookingIds.length > 0) {
      // 1. Cancel the bookings atomically
      const updateResult = await prisma.booking.updateMany({
        where: {
          id: { in: bookingIds },
          status: BookingStatus.pending_payment
        },
        data: { status: BookingStatus.cancelled }
      })

      bookingsCancelled = updateResult.count

      // 2. Cascade to Payments
      await prisma.payment.updateMany({
        where: {
          bookingId: { in: bookingIds },
          status: PaymentStatus.pending
        },
        data: { status: PaymentStatus.failed }
      })

      console.log(`[CRON] Successfully cancelled ${bookingsCancelled} abandoned bookings.`)
    } else {
      console.log(`[CRON] No abandoned bookings found.`)
    }

    const durationMs = Date.now() - startTime

    // 3. Upsert success telemetry to CronHeartbeat
    await prisma.cronHeartbeat.upsert({
      where: { jobName: 'cancel-bookings' },
      create: {
        jobName: 'cancel-bookings',
        lastRunAt: new Date(),
        bookingsCancelled,
        status: 'success',
        lastError: null,
        executionTimeMs: durationMs
      },
      update: {
        lastRunAt: new Date(),
        bookingsCancelled,
        status: 'success',
        lastError: null,
        executionTimeMs: durationMs
      }
    })

    // OBSERVABILITY: Check the oldest pending booking across the system
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

    // Invalidate dashboard cache immediately so admins see fresh telemetry
    revalidatePath('/admin/dashboard')

    return NextResponse.json({ 
      success: true, 
      cancelledCount: bookingsCancelled,
      executionTimeMs: durationMs
    })
    
  } catch (error: any) {
    console.error('Cron Error:', error.message)
    const durationMs = Date.now() - startTime

    // Record failure telemetry if DB is reachable
    try {
      await prisma.cronHeartbeat.upsert({
        where: { jobName: 'cancel-bookings' },
        create: {
          jobName: 'cancel-bookings',
          lastRunAt: new Date(),
          bookingsCancelled: 0,
          status: 'failed',
          lastError: error.message || 'Unknown error',
          executionTimeMs: durationMs
        },
        update: {
          lastRunAt: new Date(),
          status: 'failed',
          lastError: error.message || 'Unknown error',
          executionTimeMs: durationMs
        }
      })
      revalidatePath('/admin/dashboard')
    } catch (heartbeatError: any) {
      console.error('Failed to log cron failure heartbeat:', heartbeatError.message)
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
