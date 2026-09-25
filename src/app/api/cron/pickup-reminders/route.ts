import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/utils/prisma'
import { BookingStatus } from '@prisma/client'
import { parseWibDateBoundary } from '@/lib/bookingFilters'
import { notifyPickupReminder } from '@/utils/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 1. Verifikasi Secret (Auth-First Guard sebelum membaca basis data)
  const authHeader = req.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_MANUAL_SECRET}`

  if (!process.env.CRON_MANUAL_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    // 2. Tentukan batas waktu hari ini dalam zona waktu WIB (Asia/Jakarta, UTC+7)
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const todayDateStr = nowWib.toISOString().slice(0, 10) // YYYY-MM-DD
    const startOfTodayWib = parseWibDateBoundary(todayDateStr, false)
    const endOfTodayWib = parseWibDateBoundary(todayDateStr, true)

    // 3. Cari kandidat pesanan terkonfirmasi yang jadwal penjemputannya hari ini dan belum dikirimi reminder
    const candidates = await prisma.booking.findMany({
      where: {
        status: BookingStatus.confirmed,
        startDate: {
          gte: startOfTodayWib,
          lte: endOfTodayWib,
        },
        pickupReminderSentAt: null,
      },
      include: {
        customer: true,
        vehicle: true,
        pickupBranch: true,
      },
    })

    let remindersSent = 0

    // 4. Pola Klaim Atomik (Atomic Claim Pattern)
    // Klaim timestamp pickupReminderSentAt terlebih dahulu dalam transaksi atomik.
    // Pengiriman notifikasi HANYA dieksekusi jika klaim berhasil (count === 1).
    for (const booking of candidates) {
      let claimSuccess = false

      await prisma.$transaction(async (tx) => {
        const claim = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.confirmed,
            pickupReminderSentAt: null,
          },
          data: {
            pickupReminderSentAt: new Date(),
          },
        })
        claimSuccess = claim.count === 1
      })

      if (claimSuccess) {
        const isKycVerified = booking.customer.verificationStatus === 'verified'
        const pickupDateStr = new Date(booking.startDate).toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'Asia/Jakarta',
        })

        await notifyPickupReminder({
          bookingId: booking.id,
          customerName: booking.customer.name,
          customerEmail: booking.customer.email,
          customerPhone: booking.customer.phone,
          vehicleName: booking.vehicle.name || booking.vehicle.plateNumber,
          pickupBranchName: booking.pickupBranch.name,
          pickupBranchAddress: booking.pickupBranch.address,
          pickupBranchPhone: booking.pickupBranch.phone,
          pickupDate: pickupDateStr,
          isKycVerified,
          locale: (booking.locale as any) || 'id',
        })

        remindersSent++
      }
    }

    const durationMs = Date.now() - startTime

    // 5. Catat telemetri keberhasilan ke CronHeartbeat
    await prisma.cronHeartbeat.upsert({
      where: { jobName: 'pickup-reminders' },
      create: {
        jobName: 'pickup-reminders',
        lastRunAt: new Date(),
        bookingsCancelled: remindersSent, // Menggunakan kolom integer untuk mencatat jumlah reminder terkirim
        status: 'success',
        lastError: null,
        executionTimeMs: durationMs,
      },
      update: {
        lastRunAt: new Date(),
        bookingsCancelled: remindersSent,
        status: 'success',
        lastError: null,
        executionTimeMs: durationMs,
      },
    })

    revalidatePath('/admin/dashboard')

    return NextResponse.json({
      success: true,
      processedCandidates: candidates.length,
      remindersSent,
      executionTimeMs: durationMs,
    })
  } catch (error: any) {
    console.error('[CRON ERROR] pickup-reminders failed:', error.message)
    const durationMs = Date.now() - startTime

    try {
      await prisma.cronHeartbeat.upsert({
        where: { jobName: 'pickup-reminders' },
        create: {
          jobName: 'pickup-reminders',
          lastRunAt: new Date(),
          bookingsCancelled: 0,
          status: 'failed',
          lastError: error.message || 'Unknown error',
          executionTimeMs: durationMs,
        },
        update: {
          lastRunAt: new Date(),
          status: 'failed',
          lastError: error.message || 'Unknown error',
          executionTimeMs: durationMs,
        },
      })
      revalidatePath('/admin/dashboard')
    } catch (heartbeatErr: any) {
      console.error('Failed to log cron failure heartbeat:', heartbeatErr.message)
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
