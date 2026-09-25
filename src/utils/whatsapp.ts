import { LATE_RETURN_GRACE_MINUTES } from '../lib/constants'

/**
 * Normalisasi nomor telepon pelanggan Indonesia ke format E.164 tanpa tanda plus (contoh: 628123456789).
 * Menghandle prefix '08', '+628', '8', atau '628'.
 * Mengembalikan null jika nomor kosong, format invalid, atau terlalu pendek/panjang.
 */
export function formatIndonesianPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, '')
  if (!cleaned) return null

  let normalized = cleaned
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1)
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized
  }

  // Nomor seluler WhatsApp Indonesia wajib berawalan dengan kode negara 62 dan prefix 8 (628)
  if (!normalized.startsWith('628')) {
    return null
  }

  // Nomor seluler Indonesia dalam format 62 minimal 10 digit (6281234567) dan maksimal 15 digit
  if (normalized.length < 10 || normalized.length > 15) {
    return null
  }

  return normalized
}

export interface WhatsAppSendResult {
  success: boolean
  messageId?: string
  error?: string
  mock?: boolean
}

/**
 * Mendapatkan status konfigurasi gateway WhatsApp.
 * Memisahkan deteksi test/mock dari NODE_ENV production murni
 * agar pengujian E2E (next start) tidak salah dideteksi sebagai live gateway.
 */
export function getWhatsAppGatewayStatus(): {
  configured: boolean
  provider: 'fonnte' | 'mock'
  isMock: boolean
} {
  const isTestEnv =
    process.env.IS_E2E_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.APP_URL && process.env.APP_URL.includes('3001'))

  const token = process.env.WHATSAPP_API_TOKEN
  const isMock = isTestEnv || !token || token === 'dummy_token' || token === 'test_token'

  if (process.env.NODE_ENV === 'production' && !isTestEnv && !token) {
    console.warn(
      '[WHATSAPP CONFIG WARNING] WHATSAPP_API_TOKEN belum dikonfigurasi di environment produksi.'
    )
  }

  return {
    configured: Boolean(token && !isMock),
    provider: isMock ? 'mock' : 'fonnte',
    isMock,
  }
}

/**
 * Mengirim pesan WhatsApp melalui gateway Fonnte dengan native FormData (multipart/form-data).
 * Otomatis fallback ke Mock Sender pada mode test atau jika token tidak disetel.
 * Non-blocking: tidak pernah melempar Exception agar alur utama tidak terganggu.
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  message: string
): Promise<WhatsAppSendResult> {
  const formattedPhone = formatIndonesianPhoneNumber(toPhone)
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Nomor WhatsApp tidak valid atau kosong',
    }
  }

  const { isMock } = getWhatsAppGatewayStatus()
  const token = process.env.WHATSAPP_API_TOKEN

  if (isMock) {
    console.log(
      `[WHATSAPP MOCK] To: ${formattedPhone} | Message: ${message.slice(0, 90).replace(/\n/g, ' ')}...`
    )
    return {
      success: true,
      messageId: `mock-wa-${Date.now()}`,
      mock: true,
    }
  }

  try {
    const formData = new FormData()
    formData.append('target', formattedPhone)
    formData.append('message', message)
    formData.append('countryCode', '62')

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token!,
      },
      body: formData,
    })

    const resData = await response.json().catch(() => ({}))

    if (!response.ok || resData.status === false) {
      console.error('[WHATSAPP GATEWAY ERROR]', resData)
      return {
        success: false,
        error: resData.reason || resData.message || 'Gagal mengirim pesan WhatsApp via Fonnte',
      }
    }

    return {
      success: true,
      messageId: resData.id ? String(resData.id) : `fonnte-${Date.now()}`,
    }
  } catch (err: any) {
    console.error('[WHATSAPP TRANSPORT ERROR]', err)
    return {
      success: false,
      error: err?.message || 'Kendala jaringan saat menghubungi gateway WhatsApp',
    }
  }
}

// ==========================================
// Template Builders untuk WhatsApp Messages
// ==========================================

export function buildBookingConfirmedWAMessage(data: {
  customerName: string
  bookingId: string
  vehicleName: string
  pickupBranchName: string
  startDate: string
  endDate: string
  totalPrice: string
  appUrl: string
}): string {
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  return `Halo ${data.customerName}, pemesanan Anda di *Prestige Motion* telah berhasil *Dikonfirmasi*! 🚗✨

*Detail Pemesanan:*
• ID Pesanan: *#${shortId}*
• Kendaraan: ${data.vehicleName}
• Lokasi Ambil: ${data.pickupBranchName}
• Jadwal Sewa: ${data.startDate} s/d ${data.endDate}
• Total Pembayaran: ${data.totalPrice}

⚠️ *Penting:* Sebelum jadwal pengambilan unit, pastikan Anda telah mengunggah dokumen KTP & SIM pada tautan berikut:
${data.appUrl}/booking/${data.bookingId}

Terima kasih telah memilih kenyamanan layanan kami!`
}

export function buildPickupReminderWAMessage(data: {
  customerName: string
  bookingId: string
  vehicleName: string
  pickupBranchName: string
  pickupBranchPhone: string
  pickupBranchAddress: string
  pickupDate: string
  isKycVerified: boolean
  appUrl: string
}): string {
  const shortId = data.bookingId.substring(0, 8).toUpperCase()

  const kycInstruction = data.isKycVerified
    ? `✅ *Verifikasi Dokumen:* Dokumen Anda telah terverifikasi. Mohon membawa KTP & SIM asli Anda saat pengambilan unit untuk verifikasi fisik kilat.`
    : `⚠️ *PERHATIAN PENTING:* Dokumen identitas (KTP & SIM) Anda belum terverifikasi. Sesuai kebijakan keamanan, unit *TIDAK DAPAT diserahterimakan* sebelum dokumen diverifikasi.\nSilakan lengkapi sekarang juga di:\n${data.appUrl}/booking/${data.bookingId}`

  return `Halo ${data.customerName}, hari ini adalah jadwal pengambilan armada sewa Anda di *Prestige Motion*! 🚘

*Rincian Penjemputan:*
• ID Pesanan: *#${shortId}*
• Kendaraan: *${data.vehicleName}*
• Cabang Penjemputan: *${data.pickupBranchName}*
• Alamat: ${data.pickupBranchAddress}
• Kontak Cabang: ${data.pickupBranchPhone}
• Jadwal: ${data.pickupDate}

${kycInstruction}

Tim operasional kami siap menyambut kedatangan Anda. Jika ada kendala perjalanan, hubungi nomor cabang di atas.`
}

export function buildRentalStartedWAMessage(data: {
  customerName: string
  bookingId: string
  vehicleName: string
  odometerStart?: number | null
  endDate: string
  returnBranchName: string
  returnBranchPhone: string
}): string {
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  const odoText = data.odometerStart != null ? `\n• Odometer Awal: ${data.odometerStart.toLocaleString('id-ID')} km` : ''

  return `Halo ${data.customerName}, serah terima armada Anda telah selesai dan periode sewa resmi *Dimulai*! 🔑✨

*Ringkasan Perjalanan:*
• ID Pesanan: *#${shortId}*
• Kendaraan: *${data.vehicleName}*${odoText}
• Batas Waktu Pengembalian: *${data.endDate}*
• Cabang Pengembalian: *${data.returnBranchName}*
• Kontak Cabang: ${data.returnBranchPhone}

⏱️ *Ketentuan Pengembalian:*
Tersedia toleransi keterlambatan selama *${LATE_RETURN_GRACE_MINUTES} menit* sebelum denda keterlambatan/overtime mulai dihitung oleh sistem.

Semoga perjalanan Anda menyenangkan dan selalu aman di jalan! 🛣️`
}

export function buildRentalCompletedWAMessage(data: {
  customerName: string
  bookingId: string
  vehicleName: string
  odometerEnd?: number | null
  lateMinutes?: number | null
  lateFeeAmount?: string | null
  reviewUrl: string
}): string {
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  const odoText = data.odometerEnd != null ? `\n• Odometer Akhir: ${data.odometerEnd.toLocaleString('id-ID')} km` : ''

  let returnStatusText = '• Pengembalian tepat waktu tanpa biaya denda keterlambatan.'
  if (data.lateMinutes && data.lateMinutes > 0 && data.lateFeeAmount) {
    returnStatusText = `• Keterlambatan: ${data.lateMinutes} menit (Denda: ${data.lateFeeAmount})`
  }

  return `Halo ${data.customerName}, terima kasih! Pengembalian armada Anda telah kami terima dan sewa resmi *Selesai*. 🏁

*Tanda Terima Pengembalian:*
• ID Pesanan: *#${shortId}*
• Kendaraan: *${data.vehicleName}*${odoText}
${returnStatusText}

⭐ *Bagikan Pengalaman Anda:*
Bantu kami mempertahankan standar layanan prima dengan memberikan penilaian dan ulasan singkat perjalanan Anda:
${data.reviewUrl}

Sampai jumpa pada perjalanan Anda berikutnya bersama Prestige Motion!`
}

export function buildDocumentStatusWAMessage(data: {
  customerName: string
  documentType: string
  status: 'verified' | 'rejected'
  rejectionReason?: string | null
  appUrl: string
  bookingId?: string
}): string {
  const isVerified = status === 'verified' || data.status === 'verified'
  const docLabel = data.documentType.toUpperCase()

  if (isVerified) {
    return `Halo ${data.customerName}, dokumen *${docLabel}* Anda telah berhasil *Diverifikasi* oleh tim Prestige Motion. ✅\n\nTerima kasih atas kerjasamanya!`
  }

  const reasonText = data.rejectionReason ? `\n*Alasan penolakan:* ${data.rejectionReason}` : ''
  const actionLink = data.bookingId ? `${data.appUrl}/booking/${data.bookingId}` : `${data.appUrl}/dashboard`

  return `Halo ${data.customerName}, dokumen *${docLabel}* Anda memerlukan perbaikan dan *Belum Disetujui*. ❌${reasonText}

Silakan unggah kembali foto dokumen yang jelas dan valid melalui tautan berikut:
${actionLink}`
}

export function buildDriverReassignedWAMessage(data: {
  customerName: string
  bookingId: string
  vehicleName: string
  newDriverName: string
  newDriverPhone: string
}): string {
  const shortId = data.bookingId.substring(0, 8).toUpperCase()
  return `Halo ${data.customerName}, terdapat pembaruan pengemudi untuk pesanan *#${shortId}* (${data.vehicleName}). 🚗👔

*Pengemudi Bertugas:*
• Nama: *${data.newDriverName}*
• Nomor Kontak: ${data.newDriverPhone}

Pengemudi kami siap melayani perjalanan Anda sesuai jadwal yang telah ditentukan.`
}
