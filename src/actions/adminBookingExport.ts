'use server'

import { requireAdminSession } from '@/actions/admin'
import { getStaffScope } from '@/lib/auth/scope'
import { prisma } from '@/utils/prisma'
import {
  BookingFilterParams,
  buildBookingWhereClause,
  formatWibDateTime,
  formatWibDateOnly
} from '@/lib/bookingFilters'

function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '""'
  const str = String(field).replace(/"/g, '""')
  return `"${str}"`
}

export async function exportBookingsCsv(filterParams: BookingFilterParams) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    // Enforce EXACT same where clause & branch scope
    const where = buildBookingWhereClause(filterParams, scope)

    // Hard safety cap at 5000 rows to protect serverless memory
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: true,
        vehicle: {
          include: { category: true }
        },
        driver: true,
        pickupBranch: true,
        returnBranch: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5000
    })

    const headers = [
      'ID Booking',
      'Nama Pelanggan',
      'Email Pelanggan',
      'No. Telepon',
      'Status KYC',
      'Kendaraan',
      'Plat Nomor',
      'Tipe Rental',
      'Nama Sopir',
      'Cabang Pickup',
      'Cabang Return',
      'Mulai Sewa (WIB)',
      'Selesai Sewa (WIB)',
      'Total Biaya (IDR)',
      'Status Booking',
      'Status Pembayaran',
      'Tanggal Dibuat (WIB)'
    ]

    const rows: string[] = [headers.join(',')]

    for (const b of bookings) {
      const latestPayment = b.payments[0]
      const row = [
        escapeCsvField(b.id),
        escapeCsvField(b.customer?.name || ''),
        escapeCsvField(b.customer?.email || ''),
        escapeCsvField(b.customer?.phone || ''),
        escapeCsvField(b.customer?.verificationStatus || 'pending'),
        escapeCsvField(b.vehicle?.name || b.vehicle?.category?.name || ''),
        escapeCsvField(b.vehicle?.plateNumber || ''),
        escapeCsvField(b.rentalType === 'with_driver' ? 'Dengan Sopir' : 'Lepas Kunci'),
        escapeCsvField(b.driver?.name || (b.rentalType === 'with_driver' ? 'Belum Ditugaskan' : '-')),
        escapeCsvField(b.pickupBranch?.name || ''),
        escapeCsvField(b.returnBranch?.name || ''),
        escapeCsvField(formatWibDateTime(b.startDate)),
        escapeCsvField(formatWibDateTime(b.endDate)),
        escapeCsvField(Number(b.totalPrice)),
        escapeCsvField(b.status.toUpperCase()),
        escapeCsvField(latestPayment ? latestPayment.status.toUpperCase() : 'BELUM ADA'),
        escapeCsvField(formatWibDateTime(b.createdAt))
      ]
      rows.push(row.join(','))
    }

    const csvContent = '\uFEFF' + rows.join('\r\n') // Include UTF-8 BOM for Excel compatibility
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
    const filename = `data-pesanan-${today}.csv`

    return {
      success: true,
      csvContent,
      filename,
      rowCount: bookings.length
    }
  } catch (error: any) {
    console.error('exportBookingsCsv error:', error)
    return {
      error: error.message || 'Gagal mengekspor data pesanan.'
    }
  }
}
