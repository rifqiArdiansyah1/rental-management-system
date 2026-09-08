'use server'

import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
// @ts-ignore - midtrans-client might not have typescript types
import midtransClient from 'midtrans-client'
import { PaymentStatus, BookingStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { MIDTRANS_SNAP_EXPIRY_MINUTES, SNAP_TOKEN_REUSE_WINDOW_MINUTES } from '@/lib/constants'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'

const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
const isProd = (process.env.MIDTRANS_IS_PRODUCTION || process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION) === 'true'

// Initialize Snap client
const snap = new midtransClient.Snap({
  isProduction: isProd,
  serverKey: serverKey,
  clientKey: process.env.MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
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
      name: `Sewa ${booking.vehicle.name || booking.vehicle.plateNumber}`
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

/**
 * Synchronizes booking and payment status directly with Midtrans Core API.
 * This guarantees real-time accuracy even when webhooks are delayed or unreachable (e.g. local dev, network lag).
 */
export async function syncPaymentStatus(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      vehicle: { include: { category: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!booking) {
    throw new Error('Booking not found')
  }

  // Allow booking owner or admin to trigger sync
  const admin = await prisma.user.findUnique({ where: { id: user.id } })
  if (booking.customerId !== user.id && !admin) {
    throw new Error('Unauthorized access')
  }

  if (booking.status !== 'pending_payment') {
    return { success: true, status: booking.status }
  }

  const latestPayment = booking.payments[0]
  if (!latestPayment || !latestPayment.gatewayReference) {
    return { success: true, status: booking.status }
  }

  const baseUrl = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64')

  try {
    const res = await fetch(`${baseUrl}/v2/${latestPayment.gatewayReference}/status`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      console.warn(`Midtrans status check returned ${res.status} for ${latestPayment.gatewayReference}`)
      return { success: true, status: booking.status }
    }

    const data = await res.json()
    const transactionStatus = data.transaction_status
    const fraudStatus = data.fraud_status

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (transactionStatus === 'capture' && fraudStatus === 'challenge') {
        return { success: true, status: 'pending_payment', transactionStatus }
      }

      // Atomically update booking and payment
      await prisma.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.pending_payment },
        data: { status: BookingStatus.confirmed }
      })

      await prisma.payment.update({
        where: { id: latestPayment.id },
        data: { status: PaymentStatus.success }
      })

      try {
        const { sendBookingConfirmedEmail } = await import('@/utils/email')
        await sendBookingConfirmedEmail({
          toEmail: booking.customer.email,
          customerName: booking.customer.name,
          bookingId: booking.id,
          vehicleName: booking.vehicle.name || booking.vehicle.category.name,
          startDate: booking.startDate.toLocaleDateString('id-ID'),
          endDate: booking.endDate.toLocaleDateString('id-ID'),
          totalPrice: `Rp ${Number(booking.totalPrice).toLocaleString('id-ID')}`
        })
      } catch (e: any) {
        console.error('[EMAIL ERROR] Failed to send confirmation email on sync:', e.message)
      }

      revalidatePath(`/booking/${bookingId}`)
      revalidatePath('/dashboard')
      revalidatePath('/admin/bookings')

      return { success: true, status: 'confirmed', transactionStatus }
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'expire'
    ) {
      await prisma.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.pending_payment },
        data: { status: BookingStatus.cancelled }
      })

      await prisma.payment.update({
        where: { id: latestPayment.id },
        data: { status: PaymentStatus.failed }
      })

      revalidatePath(`/booking/${bookingId}`)
      revalidatePath('/dashboard')
      revalidatePath('/admin/bookings')

      return { success: true, status: 'cancelled', transactionStatus }
    }

    return { success: true, status: booking.status, transactionStatus }
  } catch (error: any) {
    console.error('Failed to sync payment status with Midtrans:', error.message)
    return { success: false, error: error.message, status: booking.status }
  }
}

/**
 * Menghasilkan Midtrans Snap Token untuk pembayaran denda keterlambatan (midtrans_late_fee).
 * Mendukung akses oleh pelanggan pemilik sewa maupun staf cabang berwenang (dengan branch scoping).
 * Menerapkan jendela idempoten reuse token (SNAP_TOKEN_REUSE_WINDOW_MINUTES).
 */
export async function createLateFeeSnapToken(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // 1. Ambil data booking beserta relasi customer dan unit
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, vehicle: true }
  })

  if (!booking) {
    throw new Error('Pesanan tidak ditemukan')
  }

  // 2. Verifikasi Otorisasi: Customer pemilik pesanan ATAU Staf Admin dalam lingkup cabangnya
  const admin = await prisma.user.findUnique({ where: { id: user.id } })
  if (admin) {
    const scope = await getStaffScope()
    assertInScope([booking.pickupBranchId, booking.returnBranchId], scope)
  } else if (booking.customerId !== user.id) {
    throw new Error('Tidak memiliki wewenang untuk mengakses pesanan ini')
  }

  // 3. Validasi Keberadaan Denda
  if (!booking.lateFeeAmount || Number(booking.lateFeeAmount) <= 0 || booking.lateFeeWaived) {
    throw new Error('Tidak ada tagihan denda keterlambatan untuk pesanan ini')
  }

  // 4. Pastikan denda belum dibayar lunas sebelumnya
  const paidLateFee = await prisma.payment.findFirst({
    where: {
      bookingId,
      method: { in: ['cash_late_fee', 'midtrans_late_fee'] },
      status: PaymentStatus.success,
    }
  })

  if (paidLateFee) {
    throw new Error('Denda keterlambatan sudah dibayar lunas')
  }

  // 5. Cek apakah ada record payment denda pending yang tokennya masih valid (Reuse Idempoten)
  const existingPending = await prisma.payment.findFirst({
    where: {
      bookingId,
      method: 'midtrans_late_fee',
      status: PaymentStatus.pending,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (existingPending && existingPending.gatewayReference && existingPending.snapToken) {
    const paymentAgeMinutes = (Date.now() - existingPending.createdAt.getTime()) / (1000 * 60)
    if (paymentAgeMinutes < SNAP_TOKEN_REUSE_WINDOW_MINUTES) {
      return { token: existingPending.snapToken, orderId: existingPending.gatewayReference }
    }
  }

  // 6. Buat Order ID dan Snap Token baru
  const orderId = `LATE-${booking.id.slice(0, 8).toUpperCase()}-${Date.now()}`
  const grossAmount = Math.round(Number(booking.lateFeeAmount))

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
    item_details: [{
      id: `LATE-FEE-${booking.id.slice(0, 8)}`,
      price: grossAmount,
      quantity: 1,
      name: `Denda Keterlambatan Sewa (${booking.lateMinutes || 0} mnt)`
    }],
    expiry: {
      unit: 'minutes',
      duration: MIDTRANS_SNAP_EXPIRY_MINUTES,
    }
  }

  try {
    const transaction = await snap.createTransaction(parameter)
    const token = transaction.token

    if (existingPending && !existingPending.snapToken) {
      // Perbarui record payment yang sebelumnya dibuat oleh modal tanpa token
      await prisma.payment.update({
        where: { id: existingPending.id },
        data: {
          gatewayReference: orderId,
          snapToken: token,
          amount: grossAmount,
        }
      })
    } else {
      // Buat record payment baru
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          method: 'midtrans_late_fee',
          amount: grossAmount,
          status: PaymentStatus.pending,
          gatewayReference: orderId,
          snapToken: token,
        }
      })
    }

    return { token, orderId }
  } catch (error: any) {
    console.error('Midtrans Snap Late Fee Error:', error.message)
    throw new Error('Gagal membuat sesi pembayaran online denda')
  }
}

/**
 * Sinkronisasi status pembayaran denda Midtrans secara real-time langsung ke API Midtrans.
 */
export async function syncLateFeePaymentStatus(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: {
        where: { method: 'midtrans_late_fee' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!booking) {
    throw new Error('Booking not found')
  }

  const latestPayment = booking.payments[0]
  if (!latestPayment || !latestPayment.gatewayReference) {
    return { success: true, status: 'no_payment' }
  }

  if (latestPayment.status === PaymentStatus.success) {
    return { success: true, status: 'success' }
  }

  const baseUrl = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64')

  try {
    const res = await fetch(`${baseUrl}/v2/${latestPayment.gatewayReference}/status`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return { success: true, status: latestPayment.status }
    }

    const data = await res.json()
    const transactionStatus = data.transaction_status

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      await prisma.payment.updateMany({
        where: { id: latestPayment.id, status: PaymentStatus.pending },
        data: { status: PaymentStatus.success }
      })

      revalidatePath(`/dashboard`)
      revalidatePath(`/admin/bookings/${bookingId}`)
      revalidatePath('/admin/bookings')

      return { success: true, status: 'success', transactionStatus }
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'expire'
    ) {
      await prisma.payment.updateMany({
        where: { id: latestPayment.id, status: PaymentStatus.pending },
        data: { status: PaymentStatus.failed }
      })

      revalidatePath(`/dashboard`)
      revalidatePath(`/admin/bookings/${bookingId}`)
      revalidatePath('/admin/bookings')

      return { success: true, status: 'failed', transactionStatus }
    }

    return { success: true, status: latestPayment.status, transactionStatus }
  } catch (error: any) {
    console.error('Failed to sync late fee payment status:', error.message)
    return { success: false, error: error.message }
  }
}

