import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/utils/prisma'
import { notifyReturnReminder } from '@/utils/notifications'
import { getVehicleDisplayName } from '@/lib/vehicleHelper'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 1. Verifikasi Secret (Auth-First Guard sebelum akses DB)
  const authHeader = req.headers.get('authorization')
  const expectedSecret1 = `Bearer ${process.env.CRON_SECRET}`
  const expectedSecret2 = `Bearer ${process.env.CRON_MANUAL_SECRET}`

  const isValidAuth =
    (Boolean(process.env.CRON_SECRET) && authHeader === expectedSecret1) ||
    (Boolean(process.env.CRON_MANUAL_SECRET) && authHeader === expectedSecret2)

  if (!isValidAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const url = new URL(req.url)
    const bypassQuietHours =
      url.searchParams.get('bypassQuietHours') === 'true' ||
      process.env.IS_E2E_TEST === 'true' ||
      process.env.NODE_ENV === 'test'

    // 2. Evaluasi Jam Tenang WIB (21:00 - 07:00 WIB)
    const now = new Date()
    // Hitung jam WIB (UTC+7)
    const nowWibHour = (now.getUTCHours() + 7) % 24
    const isQuietHours = nowWibHour >= 21 || nowWibHour < 7

    if (isQuietHours && !bypassQuietHours) {
      const durationMs = Date.now() - startTime

      await prisma.cronHeartbeat.upsert({
        where: { jobName: 'return-reminders' },
        create: {
          jobName: 'return-reminders',
          lastRunAt: new Date(),
          bookingsCancelled: 0,
          status: 'success',
          lastError: null,
          executionTimeMs: durationMs,
        },
        update: {
          lastRunAt: new Date(),
          bookingsCancelled: 0,
          status: 'success',
          lastError: null,
          executionTimeMs: durationMs,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Quiet hours active (21:00 - 07:00 WIB). Return reminders suppressed.',
        remindersSent: 0,
        quietHours: true,
      })
    }

    // 3. Hitung rentang waktu lookahead:
    // Pada jam 20:00 WIB, kirim pengingat untuk pengembalian esok pagi (hingga jam 10:00 WIB / 14 jam ke depan)
    // agar tidak mengganggu istirahat pelanggan di waktu subuh.
    const isEveningLookahead = nowWibHour === 20
    const hoursAhead = isEveningLookahead ? 14 : 3
    const maxEndDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

    // 4. Cari kandidat booking ongoing yang belum dikirimi return reminder
    const candidates = await prisma.booking.findMany({
      where: {
        status: 'ongoing',
        endDate: { lte: maxEndDate },
        returnReminderSentAt: null,
      },
      include: {
        customer: true,
        vehicle: { include: { category: true } },
        returnBranch: true,
      },
    })

    let remindersSent = 0

    // 5. Atomic Claim Pattern: update returnReminderSentAt dalam transaksi
    for (const booking of candidates) {
      let claimSuccess = false

      await prisma.$transaction(async (tx) => {
        const claim = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: 'ongoing',
            returnReminderSentAt: null,
          },
          data: {
            returnReminderSentAt: new Date(),
          },
        })
        claimSuccess = claim.count === 1
      })

      if (claimSuccess) {
        const isOverdue = now.getTime() > new Date(booking.endDate).getTime()
        const formattedEndDate = new Date(booking.endDate).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jakarta',
        })

        await notifyReturnReminder({
          bookingId: booking.id,
          customerName: booking.customer.name,
          customerEmail: booking.customer.email,
          customerPhone: booking.customer.phone,
          vehicleName: getVehicleDisplayName(booking.vehicle, { mode: 'customer' }),
          returnBranchName: booking.returnBranch.name,
          returnBranchAddress: booking.returnBranch.address,
          returnBranchPhone: booking.returnBranch.phone,
          endDate: formattedEndDate,
          isOverdue,
          locale: (booking.locale as any) || 'id',
        })

        remindersSent++
      }
    }

    const durationMs = Date.now() - startTime

    // 6. Catat telemetri ke CronHeartbeat
    await prisma.cronHeartbeat.upsert({
      where: { jobName: 'return-reminders' },
      create: {
        jobName: 'return-reminders',
        lastRunAt: new Date(),
        bookingsCancelled: remindersSent,
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
    console.error('[CRON ERROR] return-reminders failed:', error.message)
    const durationMs = Date.now() - startTime

    try {
      await prisma.cronHeartbeat.upsert({
        where: { jobName: 'return-reminders' },
        create: {
          jobName: 'return-reminders',
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
