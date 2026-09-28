'use client'

import Link from 'next/link'
import { LATE_RETURN_GRACE_MINUTES } from '@/lib/constants'

interface OngoingRentalCardProps {
  bookingId: string
  vehicleName: string
  plateNumber: string
  startDate: Date | string
  endDate: Date | string
  odometerStart?: number | null
  returnBranch?: {
    name: string
    address: string
    phone: string
  } | null
  pickupBranch?: {
    name: string
    phone: string
  } | null
  driver?: {
    name: string
    phone: string
  } | null
  rentalType: string
}

export default function OngoingRentalCard({
  bookingId,
  vehicleName,
  plateNumber,
  startDate,
  endDate,
  odometerStart,
  returnBranch,
  pickupBranch,
  driver,
  rentalType,
}: OngoingRentalCardProps) {
  const shortId = bookingId.substring(0, 8).toUpperCase()
  const branchName = returnBranch?.name || pickupBranch?.name || 'Prestige Motion'
  const branchAddress = returnBranch?.address || 'Cabang Terdaftar'
  const branchPhone = returnBranch?.phone || pickupBranch?.phone || '081234567890'

  const formattedStart = new Date(startDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'

  const formattedEnd = new Date(endDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${branchName} ${branchAddress}`
  )}`

  // Format phone to wa.me
  const cleanPhone = branchPhone.replace(/\D/g, '')
  const waPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone
  const extensionMessage = encodeURIComponent(
    `Halo ${branchName}, saya ingin konsultasi mengenai perpanjangan sewa armada ${vehicleName} (ID Pesanan: #${shortId}). Mohon informasi ketersediaan jadwal berikutnya.`
  )
  const assistanceMessage = encodeURIComponent(
    `Halo ${branchName}, saya menyewa armada ${vehicleName} (ID: #${shortId}) dan membutuhkan bantuan informasi operasional di jalan.`
  )

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className="flex flex-col gap-6" data-testid="ongoing-rental-card">
      {/* Status Hero Banner */}
      <div className="p-5 sm:p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">key</span>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Sewa Sedang Berjalan</span>
            </div>
            <h3 className="font-bold text-on-surface text-base sm:text-lg">
              Armada Telah Diserahterimakan
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Unit resmi berada dalam penggunaan aktif Anda. Nikmati perjalanan eksklusif bersama Prestige Motion.
            </p>
          </div>
        </div>

        <Link
          href={`https://wa.me/${waPhone}?text=${assistanceMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container border border-surface-variant hover:border-secondary/50 text-xs font-semibold text-on-surface hover:text-secondary transition-all flex-shrink-0 self-stretch sm:self-auto justify-center"
          data-testid="contact-branch-btn"
        >
          <span className="material-symbols-outlined text-base text-emerald-400">support_agent</span>
          <span>Bantuan Cabang</span>
        </Link>
      </div>

      {/* Handover Data & Schedule Card */}
      <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-surface-variant/50 flex flex-col gap-4">
        <h4 className="font-semibold text-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-lg">event_available</span>
          <span>Rincian Serah Terima & Batas Pengembalian</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col gap-1">
            <span className="text-on-surface-variant uppercase tracking-wider font-mono text-[10px]">Waktu Mulai Sewa</span>
            <span className="font-medium text-on-surface text-sm">{formattedStart}</span>
            {odometerStart != null && (
              <span className="text-zinc-400 mt-1 font-mono">Odometer Awal: {odometerStart.toLocaleString('id-ID')} km</span>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/30 flex flex-col gap-1">
            <span className="text-on-surface-variant uppercase tracking-wider font-mono text-[10px]">Batas Waktu Pengembalian</span>
            <span className="font-semibold text-secondary text-sm">{formattedEnd}</span>
            <span className="text-zinc-400 mt-1">Toleransi keterlambatan: {LATE_RETURN_GRACE_MINUTES} menit</span>
          </div>
        </div>
      </div>

      {/* Driver Card (if with_driver) */}
      {rentalType === 'with_driver' && driver && (
        <div className="p-5 rounded-xl bg-surface-container-low border border-surface-variant/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-secondary/15 text-secondary border border-secondary/30 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {getInitials(driver.name)}
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block">Sopir Ditugaskan</span>
              <h5 className="font-semibold text-on-surface text-sm">{driver.name}</h5>
              <span className="text-xs text-zinc-400 font-mono">{driver.phone}</span>
            </div>
          </div>

          <div className="flex gap-2 self-stretch sm:self-auto">
            <Link
              href={`https://wa.me/${driver.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              <span>WhatsApp Sopir</span>
            </Link>
            <Link
              href={`tel:${driver.phone}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-surface-variant text-on-surface text-xs font-medium hover:border-secondary/50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">call</span>
              <span>Telepon</span>
            </Link>
          </div>
        </div>
      )}

      {/* Return Branch & Maps Destination */}
      <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-surface-variant/50 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">location_on</span>
              <span>Lokasi Pengembalian Armada</span>
            </h4>
            <p className="text-xs text-on-surface font-medium mt-1">{branchName}</p>
            <p className="text-xs text-on-surface-variant">{branchAddress}</p>
            <p className="text-[11px] text-zinc-400 mt-1">Jam Layanan Operasional: <strong>08:00 – 21:00 WIB</strong></p>
          </div>

          <Link
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/15 hover:bg-secondary/25 border border-secondary/30 text-secondary text-xs font-semibold transition-all flex-shrink-0"
            data-testid="maps-navigation-btn"
          >
            <span className="material-symbols-outlined text-base">directions</span>
            <span>Petunjuk Arah</span>
          </Link>
        </div>
      </div>

      {/* General Assistance & Rules */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-3 text-xs">
        <div className="flex items-center justify-between border-b border-surface-variant/40 pb-2.5">
          <span className="font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">info</span>
            <span>Panduan & Layanan Selama Sewa</span>
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">08:00 – 21:00 WIB</span>
        </div>

        <ul className="space-y-2 text-on-surface-variant leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-secondary flex-shrink-0 mt-0.5">check_circle</span>
            <span>
              <strong>Kondisi Darurat di Jalan:</strong> Prioritaskan keselamatan Anda dan penumpang. Amankan kendaraan di bahu jalan, hidupkan lampu hazard, dokumentasikan foto kejadian, dan segera hubungi cabang operasional di{' '}
              <strong className="text-on-surface font-mono">{branchPhone}</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-secondary flex-shrink-0 mt-0.5">update</span>
            <span>
              <strong>Toleransi Keterlambatan:</strong> Denda keterlambatan baru mulai dihitung apabila pengembalian melewati batas toleransi resmi <strong>{LATE_RETURN_GRACE_MINUTES} menit</strong> setelah jadwal berakhir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-secondary flex-shrink-0 mt-0.5">more_time</span>
            <span>
              <strong>Konsultasi Perpanjangan Sewa:</strong> Jika memerlukan tambahan waktu, hubungi staf cabang untuk mengecek ketersediaan unit. Perpanjangan yang belum tercatat resmi di sistem berlaku sebagai keterlambatan.
            </span>
          </li>
        </ul>

        <div className="pt-2 flex items-center justify-between border-t border-surface-variant/30 text-[11px]">
          <Link
            href={`https://wa.me/${waPhone}?text=${extensionMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:underline inline-flex items-center gap-1 font-medium"
            data-testid="request-extension-btn"
          >
            <span>Konsultasi Perpanjangan via WhatsApp</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </Link>
          <Link href="/terms" className="text-on-surface-variant hover:text-on-surface underline">
            Syarat & Ketentuan
          </Link>
        </div>
      </div>
    </div>
  )
}
