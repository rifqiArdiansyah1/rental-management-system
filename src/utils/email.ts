import { Resend } from 'resend'
import { Locale } from '../lib/i18n/types'
import { LATE_RETURN_GRACE_MINUTES } from '../lib/constants'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build')
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'

export interface BookingConfirmedData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  startDate: string
  endDate: string
  totalPrice: string
  locale?: Locale
}

export async function sendBookingConfirmedEmail(data: BookingConfirmedData) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const isEn = data.locale === 'en'
  const subject = isEn
    ? `Booking Confirmed - ${data.bookingId.substring(0, 8).toUpperCase()}`
    : `Pesanan Dikonfirmasi - ${data.bookingId.substring(0, 8).toUpperCase()}`

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const bodyIntro = isEn
    ? `Thank you for choosing Prestige Motion for your journey. We have confirmed your payment and your reservation is now <strong>Confirmed</strong>.`
    : `Terima kasih telah mempercayakan perjalanan Anda bersama Prestige Motion. Pembayaran Anda telah kami terima dan pesanan Anda kini berstatus <strong>Dikonfirmasi</strong>.`

  const labelBookingId = isEn ? 'Booking ID' : 'ID Pesanan'
  const labelVehicle = isEn ? 'Vehicle' : 'Kendaraan'
  const labelRentalPeriod = isEn ? 'Rental Period' : 'Tanggal Sewa'
  const labelTotal = isEn ? 'Total Paid' : 'Total Pembayaran'
  const toText = isEn ? 'to' : 's/d'

  const bodyNotice = isEn
    ? `Please visit your account dashboard to upload required verification documents (if not yet submitted) and to review vehicle handover details.`
    : `Silakan periksa dasbor akun Anda untuk mengunggah dokumen identitas (jika belum) dan melihat detail instruksi pengambilan armada.`

  const ctaBtn = isEn ? 'Go to My Dashboard' : 'Ke Dasbor Saya'
  const footerCopyright = isEn
    ? `© ${new Date().getFullYear()} Prestige Motion. All rights reserved.`
    : `© ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-w-xl mx-auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${bodyIntro}
            </p>
            
            <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 30px;">
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">${labelBookingId}</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.bookingId}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">${labelVehicle}</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.vehicleName}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">${labelRentalPeriod}</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.startDate} ${toText} ${data.endDate}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">${labelTotal}</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.totalPrice}</strong>
                </td>
              </tr>
            </table>

            <!-- High-Contrast KYC Callout Box -->
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: left;">
              <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 15px; font-weight: bold;">
                ${isEn ? '⚠️ Action Required Before Vehicle Handover' : '⚠️ Tindakan Diperlukan Sebelum Penjemputan Armada'}
              </h3>
              <p style="color: #78350f; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                ${isEn 
                  ? 'Vehicle keys can only be handed over at scheduled pickup time if both your National ID (KTP) and Driver License (SIM) are verified by branch staff.' 
                  : 'Sesuai regulasi persewaan, kunci kendaraan hanya dapat diserahterimakan pada hari-H jika foto KTP & SIM Anda telah diverifikasi oleh staf cabang kami.'}
              </p>
              <div style="text-align: center;">
                <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${data.bookingId}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">
                  ${isEn ? 'Complete Verification Documents' : 'Lengkapi Dokumen Verifikasi Sekarang'}
                </a>
              </div>
            </div>

            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${bodyNotice}
            </p>

            <div style="text-align: center;">
              <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                ${ctaBtn}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              ${footerCopyright}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return resend.emails.send({
    from: `Prestige Motion <${EMAIL_FROM}>`,
    to: data.toEmail,
    subject: subject,
    html: htmlContent,
  })
}

export interface DocumentStatusData {
  toEmail: string
  customerName: string
  documentType?: string | null
  status: 'verified' | 'rejected'
  reason?: string | null
  rejectionReason?: string | null
  locale?: Locale
}

export async function sendDocumentStatusEmail(data: DocumentStatusData) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const effectiveReason = data.rejectionReason || data.reason

  const isEn = data.locale === 'en'
  const isVerified = data.status === 'verified'

  const subject = isEn
    ? isVerified
      ? 'Identity Verification Approved'
      : 'Identity Verification Update Required'
    : isVerified
    ? 'Verifikasi Identitas Berhasil'
    : 'Pembaruan Status Verifikasi Identitas'

  const statusColor = isVerified ? '#059669' : '#dc2626'
  const statusText = isVerified ? (isEn ? 'APPROVED' : 'DITERIMA') : isEn ? 'ACTION REQUIRED' : 'DITOLAK'

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const intro = isEn
    ? `Your submitted identity documentation (National ID/Driver License) has been reviewed by our compliance team. Review result:`
    : `Dokumen identitas (KTP/SIM) yang Anda unggah baru saja ditinjau oleh tim kami. Berikut adalah hasilnya:`

  const adminNoteLabel = isEn ? 'Reviewer Note:' : 'Catatan Admin:'
  const reuploadNotice = isEn
    ? `Please upload an updated or clearer document adhering to the reviewer note via your dashboard so we may proceed with your reservation.`
    : `Mohon untuk mengunggah ulang dokumen yang sesuai dengan catatan di atas melalui dasbor Anda agar pesanan Anda dapat segera kami proses lebih lanjut.`

  const successNotice = isEn
    ? `Thank you for completing your verification. You are all set for your upcoming journey with Prestige Motion.`
    : `Terima kasih telah melengkapi data identitas Anda. Kini Anda siap untuk berkendara bersama kami!`

  const ctaBtn = isEn ? 'Open My Dashboard' : 'Buka Dasbor'
  const footerCopyright = isEn
    ? `© ${new Date().getFullYear()} Prestige Motion. All rights reserved.`
    : `© ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-w-xl mx-auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${intro}
            </p>
            
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; border: 2px solid ${statusColor}; border-radius: 6px;">
              <strong style="color: ${statusColor}; font-size: 20px; letter-spacing: 2px;">${statusText}</strong>
            </div>

            ${
              !isVerified && effectiveReason
                ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px;">
                <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>${adminNoteLabel}</strong> ${effectiveReason}</p>
              </div>
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
                ${reuploadNotice}
              </p>
            `
                : ''
            }

            ${
              isVerified
                ? `
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
                ${successNotice}
              </p>
            `
                : ''
            }

            <div style="text-align: center;">
              <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                ${ctaBtn}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              ${footerCopyright}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  try {
    return resend.emails.send({
      from: `Prestige Motion <${EMAIL_FROM}>`,
      to: data.toEmail,
      subject: subject,
      html: htmlContent,
    })
  } catch (err) {
    console.error('[Email Error] Failed to send document status email:', err)
    return null
  }
}

export interface DriverReassignedData {
  toEmail: string
  customerName: string
  bookingId: string
  oldDriverName?: string
  newDriverName: string
  newDriverPhone: string
  isOngoing?: boolean
  vehicleName?: string
  reason?: string | null
  locale?: Locale
}

export async function sendDriverReassignedEmail(data: DriverReassignedData) {
  try {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.APP_URL?.includes('3001') ||
      !process.env.RESEND_API_KEY ||
      data.toEmail.endsWith('@test.com')
    ) {
      return { id: 'mock-test-email-id' }
    }

    const isEn = data.locale === 'en'
    const shortId = data.bookingId.substring(0, 8).toUpperCase()
    const subject = isEn
      ? data.isOngoing
        ? `[IMPORTANT] Chauffeur Update for Your Active Trip - ${shortId}`
        : `Chauffeur Assignment Update - ${shortId}`
      : data.isOngoing
      ? `[PENTING] Pembaruan Sopir Perjalanan Anda - ${shortId}`
      : `Pembaruan Sopir Pesanan - ${shortId}`

    const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
    const intro = isEn
      ? data.isOngoing
        ? 'We would like to inform you that your ongoing journey has been assigned a <strong>new chauffeur</strong>.'
        : 'There is an update to your assigned chauffeur for your upcoming reservation.'
      : data.isOngoing
      ? 'Kami ingin menginformasikan bahwa terjadi <strong>pergantian sopir</strong> untuk perjalanan yang sedang berlangsung pada pesanan Anda.'
      : 'Terdapat pembaruan informasi penugasan sopir untuk pesanan rental Anda.'

    const newDriverHeading = isEn ? 'New Chauffeur Information' : 'Informasi Sopir Baru'
    const contactLabel = isEn ? 'Contact Number:' : 'Nomor Kontak:'
    const replacedLabel = isEn
      ? `Replaces previous chauffeur: ${data.oldDriverName}`
      : `Menggantikan sopir sebelumnya: ${data.oldDriverName}`
    const reasonLabel = isEn ? 'Reason for Reassignment:' : 'Alasan Pergantian:'
    const ctaBtn = isEn ? 'View Booking Status' : 'Lihat Status Pesanan'
    const footerCopyright = isEn
      ? `© ${new Date().getFullYear()} Prestige Motion. All rights reserved.`
      : `© ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-w-xl mx-auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
                ${intro}
              </p>

              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #1e40af; font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0 0 10px 0;">
                  ${newDriverHeading}
                </p>
                <p style="color: #1e3a8a; font-size: 18px; font-weight: bold; margin: 0 0 6px 0;">
                  ${data.newDriverName}
                </p>
                <p style="color: #1e40af; font-size: 14px; margin: 0;">
                  ${contactLabel} <strong>${data.newDriverPhone}</strong>
                </p>
                ${
                  data.oldDriverName
                    ? `
                  <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0; border-top: 1px dashed #bfdbfe; pt: 8px;">
                    ${replacedLabel}
                  </p>
                `
                    : ''
                }
              </div>

              ${
                data.reason
                  ? `
                <div style="background-color: #f8f9fa; border-left: 4px solid #6b7280; padding: 12px 16px; margin-bottom: 24px;">
                  <p style="color: #4b5563; font-size: 13px; margin: 0;">
                    <strong>${reasonLabel}</strong> ${data.reason}
                  </p>
                </div>
              `
                  : ''
              }

              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${data.bookingId}" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                  ${ctaBtn}
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                ${footerCopyright}
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    return await resend.emails.send({
      from: `Prestige Motion <${EMAIL_FROM}>`,
      to: data.toEmail,
      subject: subject,
      html: htmlContent,
    })
  } catch (err) {
    console.error('[Email Error] Failed to send driver reassigned email:', err)
    return null
  }
}

export interface ReviewInvitationData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  locale?: Locale
}

export async function sendReviewInvitationEmail(data: ReviewInvitationData) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const isEn = data.locale === 'en'
  const subject = isEn
    ? `How was your journey with Prestige Motion? - ${data.bookingId.substring(0, 8).toUpperCase()}`
    : `Bagaimana pengalaman perjalanan Anda bersama Prestige Motion? - ${data.bookingId.substring(0, 8).toUpperCase()}`

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const bodyIntro = isEn
    ? `Your rental for <strong>${data.vehicleName}</strong> has been successfully completed. We hope your journey was seamless and refined in every detail.`
    : `Masa sewa Anda untuk armada <strong>${data.vehicleName}</strong> telah selesai dengan baik. Kami berharap perjalanan Anda berlangsung nyaman, aman, dan memuaskan.`

  const bodyAsk = isEn
    ? `To help us continuously elevate our Quiet Luxury standards and guide future travelers, we would truly appreciate a moment of your time to share your rating and review.`
    : `Untuk membantu kami senantiasa menyempurnakan standar layanan eksklusif kami serta membantu penyewa lainnya, kami sangat menghargai ulasan dan penilaian pengalaman Anda.`

  const ctaBtn = isEn ? 'Share Your Experience' : 'Beri Ulasan Armada'
  const footerCopyright = isEn
    ? `© ${new Date().getFullYear()} Prestige Motion. All rights reserved.`
    : `© ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.`

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reviewUrl = `${baseUrl}/booking/${data.bookingId}`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #0A192F; padding: 30px; text-align: center;">
            <h1 style="color: #C5A059; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 20px;">
              ${bodyIntro}
            </p>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
              ${bodyAsk}
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${reviewUrl}" style="background-color: #C5A059; color: #000000; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(197, 160, 89, 0.3);">
                ${ctaBtn}
              </a>
            </div>

            <p style="color: #71717a; font-size: 13px; line-height: 1.5; text-align: center; margin-top: 25px;">
              ${isEn ? 'You can also access this review form anytime from your Customer Dashboard.' : 'Anda juga dapat mengakses form ulasan ini kapan saja melalui Dasbor Pelanggan Anda.'}
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              ${footerCopyright}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return resend.emails.send({
    from: `Prestige Motion <${EMAIL_FROM}>`,
    to: data.toEmail,
    subject: subject,
    html: htmlContent,
  })
}

export interface PickupReminderEmailData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  pickupBranchName: string
  pickupBranchAddress: string
  pickupBranchPhone: string
  pickupDate: string
  isKycVerified: boolean
  locale?: Locale
}

export async function sendPickupReminderEmail(data: PickupReminderEmailData) {
  if (
    process.env.IS_E2E_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const isEn = data.locale === 'en'
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  const subject = isEn
    ? `Vehicle Pickup Reminder - ${shortId}`
    : `Pengingat Penjemputan Armada - ${shortId}`

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const bodyIntro = isEn
    ? `Today is the scheduled day for your vehicle pickup with Prestige Motion. Our team is ready to welcome you.`
    : `Hari ini adalah jadwal penjemputan armada sewa Anda di Prestige Motion. Tim staf operasional kami siap menyambut kedatangan Anda.`

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const bookingUrl = `${baseUrl}/booking/${data.bookingId}`

  const kycCallout = data.isKycVerified
    ? `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 18px; margin-bottom: 25px;">
        <strong style="color: #065f46; font-size: 14px; display: block; margin-bottom: 6px;">
          ${isEn ? '✅ Identity Verification Complete' : '✅ Dokumen Identitas Terverifikasi'}
        </strong>
        <p style="color: #047857; font-size: 13px; line-height: 1.5; margin: 0;">
          ${isEn
            ? 'Please present your physical National ID (KTP) and Driver License (SIM) upon vehicle handover for a quick security check.'
            : 'Mohon tunjukkan fisik KTP & SIM asli Anda saat serah-terima unit di cabang untuk proses verifikasi kilat.'}
        </p>
      </div>
    `
    : `
      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px; margin-bottom: 25px;">
        <strong style="color: #92400e; font-size: 14px; display: block; margin-bottom: 6px;">
          ${isEn ? '⚠️ Action Required: Identity Documents Pending' : '⚠️ Perhatian: Verifikasi Dokumen Belum Lengkap'}
        </strong>
        <p style="color: #b45309; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0;">
          ${isEn
            ? 'Vehicle keys CANNOT be handed over without verified National ID (KTP) and Driver License (SIM). Please upload your documents now before visiting the branch.'
            : 'Sesuai regulasi keamanan, kunci kendaraan TIDAK DAPAT diserahterimakan sebelum foto KTP & SIM diverifikasi. Silakan lengkapi dokumen Anda sekarang sebelum menuju lokasi cabang.'}
        </p>
        <a href="${bookingUrl}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">
          ${isEn ? 'Upload Documents Now' : 'Unggah Dokumen Sekarang'}
        </a>
      </div>
    `

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${bodyIntro}
            </p>

            ${kycCallout}

            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 25px;">
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Booking Reference' : 'Nomor Pesanan'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">#${shortId}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Reserved Vehicle' : 'Armada Pilihan'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.vehicleName}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Pickup Location' : 'Lokasi Cabang Penjemputan'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.pickupBranchName}</strong><br>
                  <span style="color: #4b5563; font-size: 13px;">${data.pickupBranchAddress}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Branch Contact' : 'Nomor Telepon Cabang'}</span><br>
                  <strong style="color: #111827; font-size: 14px;">${data.pickupBranchPhone}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Pickup Schedule' : 'Waktu Penjemputan'}</span><br>
                  <strong style="color: #111827; font-size: 14px;">${data.pickupDate}</strong>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${bookingUrl}" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                ${isEn ? 'View Booking Details' : 'Lihat Detail Pesanan'}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} Prestige Motion. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return resend.emails.send({
    from: `Prestige Motion <${EMAIL_FROM}>`,
    to: data.toEmail,
    subject: subject,
    html: htmlContent,
  })
}

export interface RentalStartedEmailData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  odometerStart?: number | null
  endDate: string
  returnBranchName: string
  returnBranchAddress: string
  returnBranchPhone: string
  locale?: Locale
}

export async function sendRentalStartedEmail(data: RentalStartedEmailData) {
  if (
    process.env.IS_E2E_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const isEn = data.locale === 'en'
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  const subject = isEn
    ? `Rental Started - ${shortId}`
    : `Sewa Dimulai - ${shortId}`

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const bodyIntro = isEn
    ? `Vehicle handover has been successfully completed. Your rental period for <strong>${data.vehicleName}</strong> is officially underway!`
    : `Serah terima kendaraan telah berhasil dilakukan. Masa sewa armada <strong>${data.vehicleName}</strong> Anda resmi dimulai!`

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const bookingUrl = `${baseUrl}/booking/${data.bookingId}`

  const odoRow = data.odometerStart != null
    ? `
      <tr>
        <td style="border-bottom: 1px solid #e5e7eb;">
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Starting Odometer' : 'Odometer Awal'}</span><br>
          <strong style="color: #111827; font-size: 15px;">${data.odometerStart.toLocaleString('id-ID')} km</strong>
        </td>
      </tr>
    `
    : ''

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${bodyIntro}
            </p>

            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 25px;">
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Booking Reference' : 'Nomor Pesanan'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">#${shortId}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Vehicle' : 'Armada'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.vehicleName}</strong>
                </td>
              </tr>
              ${odoRow}
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Scheduled Return' : 'Batas Waktu Pengembalian'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.endDate}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Return Location' : 'Lokasi Cabang Pengembalian'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.returnBranchName}</strong><br>
                  <span style="color: #4b5563; font-size: 13px;">${data.returnBranchAddress}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Return Branch Contact' : 'Nomor Telepon Cabang'}</span><br>
                  <strong style="color: #111827; font-size: 14px;">${data.returnBranchPhone}</strong>
                </td>
              </tr>
            </table>

            <!-- Grace Period Information -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 25px;">
              <strong style="color: #166534; font-size: 13px; display: block; margin-bottom: 4px;">
                ${isEn ? '⏱️ Return Policy & Grace Period' : '⏱️ Ketentuan Toleransi Pengembalian'}
              </strong>
              <p style="color: #15803d; font-size: 13px; line-height: 1.5; margin: 0;">
                ${isEn
                  ? `A grace period of ${LATE_RETURN_GRACE_MINUTES} minutes is granted beyond your scheduled return time before late return fees apply.`
                  : `Tersedia masa tenggang keterlambatan selama ${LATE_RETURN_GRACE_MINUTES} menit sebelum denda keterlambatan/overtime mulai dihitung oleh sistem.`}
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${bookingUrl}" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                ${isEn ? 'View Booking Details' : 'Lihat Detail Pesanan'}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} Prestige Motion. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return resend.emails.send({
    from: `Prestige Motion <${EMAIL_FROM}>`,
    to: data.toEmail,
    subject: subject,
    html: htmlContent,
  })
}

export interface RentalCompletedEmailData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  odometerEnd?: number | null
  lateMinutes?: number | null
  lateFeeAmount?: string | null
  reviewUrl: string
  locale?: Locale
}

export async function sendRentalCompletedEmail(data: RentalCompletedEmailData) {
  if (
    process.env.IS_E2E_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.APP_URL?.includes('3001') ||
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes('dummy') ||
    data.toEmail.endsWith('@test.com')
  ) {
    return { id: 'mock-test-email-id' }
  }

  const isEn = data.locale === 'en'
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  const subject = isEn
    ? `Rental Receipt & Completed - ${shortId}`
    : `Tanda Terima Pengembalian & Sewa Selesai - ${shortId}`

  const greeting = isEn ? `Dear ${data.customerName},` : `Halo, ${data.customerName}`
  const bodyIntro = isEn
    ? `Vehicle return has been verified and your rental for <strong>${data.vehicleName}</strong> is now officially completed. Thank you for choosing Prestige Motion!`
    : `Pengembalian kendaraan telah diverifikasi dan masa sewa armada <strong>${data.vehicleName}</strong> Anda telah selesai dengan baik. Terima kasih telah mempercayakan perjalanan Anda kepada Prestige Motion!`

  const odoRow = data.odometerEnd != null
    ? `
      <tr>
        <td style="border-bottom: 1px solid #e5e7eb;">
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Final Odometer' : 'Odometer Akhir'}</span><br>
          <strong style="color: #111827; font-size: 15px;">${data.odometerEnd.toLocaleString('id-ID')} km</strong>
        </td>
      </tr>
    `
    : ''

  const lateRow = data.lateMinutes && data.lateMinutes > 0 && data.lateFeeAmount
    ? `
      <tr>
        <td style="border-bottom: 1px solid #e5e7eb;">
          <span style="color: #dc2626; font-size: 12px; text-transform: uppercase;">${isEn ? 'Late Return Penalty' : 'Keterlambatan & Denda'}</span><br>
          <strong style="color: #b91c1c; font-size: 15px;">${data.lateMinutes} ${isEn ? 'mins' : 'menit'} (${data.lateFeeAmount})</strong>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="border-bottom: 1px solid #e5e7eb;">
          <span style="color: #16a34a; font-size: 12px; text-transform: uppercase;">${isEn ? 'Return Status' : 'Status Pengembalian'}</span><br>
          <strong style="color: #15803d; font-size: 14px;">${isEn ? 'On-time return (no late fees)' : 'Tepat waktu (bebas biaya denda)'}</strong>
        </td>
      </tr>
    `

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; max-width: 600px;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: normal; letter-spacing: 2px;">PRESTIGE MOTION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">${greeting}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              ${bodyIntro}
            </p>

            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 25px;">
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Booking Reference' : 'Nomor Pesanan'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">#${shortId}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">${isEn ? 'Vehicle' : 'Armada'}</span><br>
                  <strong style="color: #111827; font-size: 15px;">${data.vehicleName}</strong>
                </td>
              </tr>
              ${odoRow}
              ${lateRow}
            </table>

            <!-- Review Invitation Section -->
            <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 24px; margin-bottom: 25px; text-align: center;">
              <h3 style="color: #6b21a8; margin: 0 0 8px 0; font-size: 16px;">
                ${isEn ? '⭐ Share Your Quiet Luxury Experience' : '⭐ Bagaimana Pengalaman Perjalanan Anda?'}
              </h3>
              <p style="color: #581c87; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                ${isEn
                  ? 'Your rating and feedback help us continuously elevate our service standards.'
                  : 'Ulasan dan penilaian Anda sangat berarti untuk menjaga standar keunggulan layanan kami.'}
              </p>
              <a href="${data.reviewUrl}" style="background-color: #C5A059; color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                ${isEn ? 'Write a Review' : 'Beri Ulasan Armada'}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} Prestige Motion. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return resend.emails.send({
    from: `Prestige Motion <${EMAIL_FROM}>`,
    to: data.toEmail,
    subject: subject,
    html: htmlContent,
  })
}


