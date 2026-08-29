import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build')
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'

interface BookingConfirmedData {
  toEmail: string
  customerName: string
  bookingId: string
  vehicleName: string
  startDate: string
  endDate: string
  totalPrice: string
}

export async function sendBookingConfirmedEmail(data: BookingConfirmedData) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Confirmed</title>
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
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">Halo, ${data.customerName}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              Terima kasih telah mempercayakan perjalanan Anda bersama Prestige Motion. Pembayaran Anda telah kami terima dan pesanan Anda kini berstatus <strong>Dikonfirmasi</strong>.
            </p>
            
            <table width="100%" cellpadding="15" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 30px;">
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">ID Pesanan</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.bookingId}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">Kendaraan</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.vehicleName}</strong>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">Tanggal Sewa</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.startDate} s/d ${data.endDate}</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <span style="color: #6b7280; font-size: 13px; text-transform: uppercase;">Total Pembayaran</span><br>
                  <strong style="color: #111827; font-size: 16px;">${data.totalPrice}</strong>
                </td>
              </tr>
            </table>

            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
              Silakan periksa dasbor akun Anda untuk mengunggah dokumen identitas (jika belum) dan melihat detail instruksi pengambilan armada.
            </p>

            <div style="text-align: center;">
              <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                Ke Dasbor Saya
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.
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
    subject: `Pesanan Dikonfirmasi - ${data.bookingId.substring(0, 8).toUpperCase()}`,
    html: htmlContent
  })
}

interface DocumentStatusData {
  toEmail: string
  customerName: string
  status: 'verified' | 'rejected'
  reason?: string
}

export async function sendDocumentStatusEmail(data: DocumentStatusData) {
  const isVerified = data.status === 'verified'
  const subject = isVerified 
    ? 'Verifikasi Identitas Berhasil' 
    : 'Pembaruan Status Verifikasi Identitas'
    
  const statusColor = isVerified ? '#059669' : '#dc2626'
  const statusText = isVerified ? 'DITERIMA' : 'DITOLAK'

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Status Verifikasi</title>
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
            <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">Halo, ${data.customerName}</h2>
            <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
              Dokumen identitas (KTP/SIM) yang Anda unggah baru saja ditinjau oleh tim kami. Berikut adalah hasilnya:
            </p>
            
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; border: 2px solid ${statusColor}; border-radius: 6px;">
              <strong style="color: ${statusColor}; font-size: 20px; letter-spacing: 2px;">${statusText}</strong>
            </div>

            ${!isVerified && data.reason ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px;">
                <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Catatan Admin:</strong> ${data.reason}</p>
              </div>
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
                Mohon untuk mengunggah ulang dokumen yang sesuai dengan catatan di atas melalui dasbor Anda agar pesanan Anda dapat segera kami proses lebih lanjut.
              </p>
            ` : ''}

            ${isVerified ? `
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 30px;">
                Terima kasih telah melengkapi data identitas Anda. Kini Anda siap untuk berkendara bersama kami!
              </p>
            ` : ''}

            <div style="text-align: center;">
              <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                Buka Dasbor
              </a>
            </div>
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
      html: htmlContent
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
  isOngoing: boolean
  reason?: string
}

export async function sendDriverReassignedEmail(data: DriverReassignedData) {
  try {
    if (process.env.NODE_ENV === 'test' || !process.env.RESEND_API_KEY) {
      return { id: 'mock-test-email-id' }
    }

    const subject = data.isOngoing
      ? `[PENTING] Pembaruan Sopir Perjalanan Anda - ${data.bookingId.substring(0, 8).toUpperCase()}`
      : `Pembaruan Sopir Pesanan - ${data.bookingId.substring(0, 8).toUpperCase()}`

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
              <h2 style="color: #1a1a1a; font-size: 20px; margin-top: 0;">Halo, ${data.customerName}</h2>
              <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
                ${data.isOngoing 
                  ? 'Kami ingin menginformasikan bahwa terjadi <strong>pergantian sopir</strong> untuk perjalanan yang sedang berlangsung pada pesanan Anda.'
                  : 'Terdapat pembaruan informasi penugasan sopir untuk pesanan rental Anda.'
                }
              </p>

              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #1e40af; font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0 0 10px 0;">
                  Informasi Sopir Baru
                </p>
                <p style="color: #1e3a8a; font-size: 18px; font-weight: bold; margin: 0 0 6px 0;">
                  ${data.newDriverName}
                </p>
                <p style="color: #1e40af; font-size: 14px; margin: 0;">
                  Nomor Kontak: <strong>${data.newDriverPhone}</strong>
                </p>
                ${data.oldDriverName ? `
                  <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0; border-top: 1px dashed #bfdbfe; pt: 8px;">
                    Menggantikan sopir sebelumnya: ${data.oldDriverName}
                  </p>
                ` : ''}
              </div>

              ${data.reason ? `
                <div style="background-color: #f8f9fa; border-left: 4px solid #6b7280; padding: 12px 16px; margin-bottom: 24px;">
                  <p style="color: #4b5563; font-size: 13px; margin: 0;">
                    <strong>Alasan Pergantian:</strong> ${data.reason}
                  </p>
                </div>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${data.bookingId}" style="background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block;">
                  Lihat Status Pesanan
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                © ${new Date().getFullYear()} Prestige Motion. Seluruh hak cipta dilindungi.
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
      html: htmlContent
    })
  } catch (err) {
    console.error('[Email Error] Failed to send driver reassigned email:', err)
    return null
  }
}
