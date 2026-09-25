import { Locale } from '../lib/i18n/types'
import {
  sendBookingConfirmedEmail,
  sendPickupReminderEmail,
  sendRentalStartedEmail,
  sendRentalCompletedEmail,
  sendDocumentStatusEmail,
  sendDriverReassignedEmail,
} from './email'
import {
  sendWhatsAppMessage,
  formatIndonesianPhoneNumber,
  buildBookingConfirmedWAMessage,
  buildPickupReminderWAMessage,
  buildRentalStartedWAMessage,
  buildRentalCompletedWAMessage,
  buildDocumentStatusWAMessage,
  buildDriverReassignedWAMessage,
} from './whatsapp'

function getAppBaseUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export interface NotificationResult {
  emailDispatched: boolean
  whatsappDispatched: boolean
  errors?: string[]
}

/**
 * Helper internal untuk eksekusi non-blocking dual-channel (Email + WhatsApp)
 * menggunakan Promise.allSettled agar kegagalan salah satu channel tidak mengganggu channel lain
 * ataupun melempar Exception ke pemanggil (server action / cron / webhook).
 */
async function dispatchDualChannel(
  channelName: string,
  emailFn: () => Promise<any>,
  whatsappFn?: () => Promise<any>
): Promise<NotificationResult> {
  const tasks: Promise<any>[] = [emailFn()]
  const hasWhatsApp = Boolean(whatsappFn)

  if (whatsappFn) {
    tasks.push(whatsappFn())
  }

  const results = await Promise.allSettled(tasks)
  const emailRes = results[0]
  const waRes = hasWhatsApp ? results[1] : null

  const errors: string[] = []
  let emailDispatched = false
  let whatsappDispatched = false

  if (emailRes.status === 'fulfilled') {
    emailDispatched = true
  } else {
    console.error(`[NOTIFICATION ERROR] [${channelName}] Email delivery failed:`, emailRes.reason)
    errors.push(`Email: ${emailRes.reason?.message || emailRes.reason}`)
  }

  if (waRes) {
    if (waRes.status === 'fulfilled') {
      const val = waRes.value
      if (val && typeof val === 'object' && 'success' in val && !val.success) {
        console.warn(`[NOTIFICATION WARNING] [${channelName}] WhatsApp gateway reported failure:`, val.error)
        errors.push(`WhatsApp: ${val.error}`)
      } else {
        whatsappDispatched = true
      }
    } else {
      console.error(`[NOTIFICATION ERROR] [${channelName}] WhatsApp dispatch threw:`, waRes.reason)
      errors.push(`WhatsApp: ${waRes.reason?.message || waRes.reason}`)
    }
  }

  return {
    emailDispatched,
    whatsappDispatched,
    errors: errors.length > 0 ? errors : undefined,
  }
}

// =========================================================================
// 1. Booking Confirmed (Pembayaran Sukses / Midtrans Settlement)
// =========================================================================
export interface NotifyBookingConfirmedParams {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  vehicleName: string
  pickupBranchName: string
  startDate: string
  endDate: string
  totalPrice: string
  locale?: Locale
}

export async function notifyBookingConfirmed(
  params: NotifyBookingConfirmedParams
): Promise<NotificationResult> {
  const appUrl = getAppBaseUrl()
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'booking_confirmed',
    () =>
      sendBookingConfirmedEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        bookingId: params.bookingId,
        vehicleName: params.vehicleName,
        startDate: params.startDate,
        endDate: params.endDate,
        totalPrice: params.totalPrice,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildBookingConfirmedWAMessage({
            customerName: params.customerName,
            bookingId: params.bookingId,
            vehicleName: params.vehicleName,
            pickupBranchName: params.pickupBranchName,
            startDate: params.startDate,
            endDate: params.endDate,
            totalPrice: params.totalPrice,
            appUrl,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}

// =========================================================================
// 2. Day-H Pickup Reminder (Pengingat Penjemputan Hari-H)
// =========================================================================
export interface NotifyPickupReminderParams {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  vehicleName: string
  pickupBranchName: string
  pickupBranchAddress: string
  pickupBranchPhone: string
  pickupDate: string
  isKycVerified: boolean
  locale?: Locale
}

export async function notifyPickupReminder(
  params: NotifyPickupReminderParams
): Promise<NotificationResult> {
  const appUrl = getAppBaseUrl()
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'pickup_reminder',
    () =>
      sendPickupReminderEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        bookingId: params.bookingId,
        vehicleName: params.vehicleName,
        pickupBranchName: params.pickupBranchName,
        pickupBranchAddress: params.pickupBranchAddress,
        pickupBranchPhone: params.pickupBranchPhone,
        pickupDate: params.pickupDate,
        isKycVerified: params.isKycVerified,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildPickupReminderWAMessage({
            customerName: params.customerName,
            bookingId: params.bookingId,
            vehicleName: params.vehicleName,
            pickupBranchName: params.pickupBranchName,
            pickupBranchPhone: params.pickupBranchPhone,
            pickupBranchAddress: params.pickupBranchAddress,
            pickupDate: params.pickupDate,
            isKycVerified: params.isKycVerified,
            appUrl,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}

// =========================================================================
// 3. Rental Started (Serah Terima Kendaraan / Mulai Sewa)
// =========================================================================
export interface NotifyRentalStartedParams {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  vehicleName: string
  odometerStart?: number | null
  endDate: string
  returnBranchName: string
  returnBranchAddress: string
  returnBranchPhone: string
  locale?: Locale
}

export async function notifyRentalStarted(
  params: NotifyRentalStartedParams
): Promise<NotificationResult> {
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'rental_started',
    () =>
      sendRentalStartedEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        bookingId: params.bookingId,
        vehicleName: params.vehicleName,
        odometerStart: params.odometerStart,
        endDate: params.endDate,
        returnBranchName: params.returnBranchName,
        returnBranchAddress: params.returnBranchAddress,
        returnBranchPhone: params.returnBranchPhone,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildRentalStartedWAMessage({
            customerName: params.customerName,
            bookingId: params.bookingId,
            vehicleName: params.vehicleName,
            odometerStart: params.odometerStart,
            endDate: params.endDate,
            returnBranchName: params.returnBranchName,
            returnBranchPhone: params.returnBranchPhone,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}

// =========================================================================
// 4. Rental Completed (Pengembalian Selesai / Tanda Terima & Ulasan)
// =========================================================================
export interface NotifyRentalCompletedParams {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  vehicleName: string
  odometerEnd?: number | null
  lateMinutes?: number | null
  lateFeeAmount?: string | null
  locale?: Locale
}

export async function notifyRentalCompleted(
  params: NotifyRentalCompletedParams
): Promise<NotificationResult> {
  const appUrl = getAppBaseUrl()
  const reviewUrl = `${appUrl}/booking/${params.bookingId}`
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'rental_completed',
    () =>
      sendRentalCompletedEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        bookingId: params.bookingId,
        vehicleName: params.vehicleName,
        odometerEnd: params.odometerEnd,
        lateMinutes: params.lateMinutes,
        lateFeeAmount: params.lateFeeAmount,
        reviewUrl,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildRentalCompletedWAMessage({
            customerName: params.customerName,
            bookingId: params.bookingId,
            vehicleName: params.vehicleName,
            odometerEnd: params.odometerEnd,
            lateMinutes: params.lateMinutes,
            lateFeeAmount: params.lateFeeAmount,
            reviewUrl,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}

// =========================================================================
// 5. Document Status (KYC Approval / Rejection)
// =========================================================================
export interface NotifyDocumentStatusParams {
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  documentType: string
  status: 'verified' | 'rejected'
  rejectionReason?: string | null
  bookingId?: string
  locale?: Locale
}

export async function notifyDocumentStatus(
  params: NotifyDocumentStatusParams
): Promise<NotificationResult> {
  const appUrl = getAppBaseUrl()
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'document_status',
    () =>
      sendDocumentStatusEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        documentType: params.documentType,
        status: params.status,
        rejectionReason: params.rejectionReason,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildDocumentStatusWAMessage({
            customerName: params.customerName,
            documentType: params.documentType,
            status: params.status,
            rejectionReason: params.rejectionReason,
            appUrl,
            bookingId: params.bookingId,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}

// =========================================================================
// 6. Driver Reassigned (Ganti Penugasan Sopir)
// =========================================================================
export interface NotifyDriverReassignedParams {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  newDriverName: string
  newDriverPhone: string
  vehicleName: string
  locale?: Locale
}

export async function notifyDriverReassigned(
  params: NotifyDriverReassignedParams
): Promise<NotificationResult> {
  const validPhone = formatIndonesianPhoneNumber(params.customerPhone)

  return dispatchDualChannel(
    'driver_reassigned',
    () =>
      sendDriverReassignedEmail({
        toEmail: params.customerEmail,
        customerName: params.customerName,
        bookingId: params.bookingId,
        newDriverName: params.newDriverName,
        newDriverPhone: params.newDriverPhone,
        vehicleName: params.vehicleName,
        locale: params.locale,
      }),
    validPhone
      ? () => {
          const msg = buildDriverReassignedWAMessage({
            customerName: params.customerName,
            bookingId: params.bookingId,
            vehicleName: params.vehicleName,
            newDriverName: params.newDriverName,
            newDriverPhone: params.newDriverPhone,
          })
          return sendWhatsAppMessage(validPhone, msg)
        }
      : undefined
  )
}
