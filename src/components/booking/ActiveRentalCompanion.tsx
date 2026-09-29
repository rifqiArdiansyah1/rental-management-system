'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { LATE_RETURN_GRACE_MINUTES } from '@/lib/constants'
import { calculateLateFee } from '@/lib/lateFee'

export interface ActiveRentalCompanionProps {
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
  serverNow?: number
  agreedDailyRate?: number
}

export default function ActiveRentalCompanion({
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
  serverNow,
  agreedDailyRate = 0,
}: ActiveRentalCompanionProps) {
  const shortId = bookingId.substring(0, 8).toUpperCase()
  const branchName = returnBranch?.name || pickupBranch?.name || 'Prestige Motion'
  const branchAddress = returnBranch?.address || 'Cabang Terdaftar'
  const branchPhone = returnBranch?.phone || pickupBranch?.phone || '081234567890'

  // Hydration-safe clock skew handling
  const [isMounted, setIsMounted] = useState(false)
  const clockSkewRef = useRef<number>(0)
  const [currentEffectiveTime, setCurrentEffectiveTime] = useState<number>(() => serverNow || Date.now())

  useEffect(() => {
    if (serverNow) {
      clockSkewRef.current = Date.now() - serverNow
    }
    setIsMounted(true)
    const initialNow = Date.now() - clockSkewRef.current
    setCurrentEffectiveTime(initialNow)

    const interval = setInterval(() => {
      setCurrentEffectiveTime(Date.now() - clockSkewRef.current)
    }, 1000)

    return () => clearInterval(interval)
  }, [serverNow])

  const endTimestamp = new Date(endDate).getTime()
  const diffMs = endTimestamp - currentEffectiveTime
  const gracePeriodMs = LATE_RETURN_GRACE_MINUTES * 60 * 1000

  // Phase detection
  const isGracePeriod = diffMs <= 0 && diffMs >= -gracePeriodMs
  const isOverdue = diffMs < -gracePeriodMs

  // Calculate live countdown representation
  let countdownText = ''
  let lateFeeEstimate: number = 0
  let lateMinutesCount: number = 0

  if (!isMounted) {
    countdownText = 'Menghitung waktu tersisa...'
  } else if (!isGracePeriod && !isOverdue) {
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    countdownText = `${hours}j ${minutes}m ${seconds}s`
  } else if (isGracePeriod) {
    const remainingGraceMs = gracePeriodMs + diffMs
    const graceSeconds = Math.max(0, Math.floor(remainingGraceMs / 1000))
    const graceMinutes = Math.floor(graceSeconds / 60)
    const remSec = graceSeconds % 60
    countdownText = `Sisa masa toleransi: ${graceMinutes}m ${remSec}s`
  } else {
    // Overdue
    const feeResult = calculateLateFee(new Date(endDate), new Date(currentEffectiveTime), agreedDailyRate)
    lateFeeEstimate = feeResult.suggestedLateFee
    lateMinutesCount = feeResult.lateMinutes
    const overdueSeconds = Math.floor(Math.abs(diffMs) / 1000)
    const odHours = Math.floor(overdueSeconds / 3600)
    const odMinutes = Math.floor((overdueSeconds % 3600) / 60)
    countdownText = `Terlewat ${odHours}j ${odMinutes}m`
  }

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

  // Format phone to WhatsApp international link
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
      {/* 1. Status Hero Banner with Live Countdown */}
      <div
        className={`p-5 sm:p-6 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isOverdue
            ? 'bg-rose-500/10 border-rose-500/30'
            : isGracePeriod
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-emerald-500/10 border-emerald-500/25'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              isOverdue
                ? 'bg-rose-500/20 text-rose-400'
                : isGracePeriod
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {isOverdue ? 'warning' : isGracePeriod ? 'schedule' : 'key'}
            </span>
          </div>
          <div>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-1 ${
                isOverdue
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : isGracePeriod
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOverdue ? 'bg-rose-400 animate-pulse' : isGracePeriod ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                }`}
              ></span>
              <span data-testid="rental-status-badge">
                {isOverdue
                  ? 'Melewati Batas Waktu'
                  : isGracePeriod
                  ? 'Masa Toleransi Pengembalian'
                  : 'Sewa Sedang Berjalan'}
              </span>
            </div>
            <h3 className="font-bold text-on-surface text-base sm:text-lg">
              {isOverdue
                ? 'Jadwal Pengembalian Telah Berakhir'
                : isGracePeriod
                ? 'Masa Toleransi 45 Menit Aktif'
                : 'Armada Telah Diserahterimakan'}
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {isOverdue
                ? 'Batas waktu pengembalian telah terlampaui. Segera kembalikan armada ke cabang atau hubungi staf operasional.'
                : isGracePeriod
                ? `Waktu sewa telah berakhir. Anda memiliki toleransi hingga ${LATE_RETURN_GRACE_MINUTES} menit sebelum denda overtime mulai dihitung.`
                : 'Unit resmi berada dalam penggunaan aktif Anda. Nikmati perjalanan eksklusif bersama Prestige Motion.'}
            </p>
          </div>
        </div>

        {/* Live Countdown & Quick Assistance Link */}
        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
          <div
            data-testid="countdown-display"
            className="px-3.5 py-2 rounded-lg bg-surface-container/90 border border-surface-variant text-center sm:text-right"
          >
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-mono block">
              {isOverdue ? 'Keterlambatan' : isGracePeriod ? 'Masa Toleransi' : 'Sisa Waktu Sewa'}
            </span>
            <span className="font-mono font-bold text-sm sm:text-base text-secondary">
              {countdownText}
            </span>
          </div>

          <Link
            href={`https://wa.me/${waPhone}?text=${assistanceMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container border border-surface-variant hover:border-secondary/50 text-xs font-semibold text-on-surface hover:text-secondary transition-all justify-center"
            data-testid="contact-branch-btn"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">support_agent</span>
            <span>Bantuan Cabang</span>
          </Link>
        </div>
      </div>

      {/* 2. Overdue Late Fee Estimation Alert (Only in Overdue Phase) */}
      {isOverdue && lateFeeEstimate > 0 && (
        <div
          data-testid="late-fee-estimate-card"
          className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-400 text-2xl flex-shrink-0 mt-0.5">
              payments
            </span>
            <div>
              <h4 className="font-bold text-sm text-on-surface">
                Estimasi Denda Keterlambatan: Rp {lateFeeEstimate.toLocaleString('id-ID')}
              </h4>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                Total keterlambatan: <strong>{lateMinutesCount} menit</strong> (melewati toleransi {LATE_RETURN_GRACE_MINUTES} menit).
              </p>
              <p className="text-[11px] text-amber-300/90 italic mt-1">
                * Estimasi denda keterlambatan (dapat disesuaikan staf operasional saat serah terima pengembalian).
              </p>
            </div>
          </div>

          <Link
            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
              `Halo ${branchName}, saya ingin mengonfirmasi pengembalian armada ${vehicleName} (ID: #${shortId}) yang mengalami keterlambatan.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition-colors flex-shrink-0 self-stretch sm:self-auto text-center"
          >
            Konfirmasi ke Cabang
          </Link>
        </div>
      )}

      {/* 3. Handover Data & Schedule Card */}
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

      {/* 4. Driver Card (if with_driver) */}
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

      {/* 5. Return Branch & Maps Destination */}
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

      {/* 6. General Assistance & Safe Operational Rules */}
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
            <span className="material-symbols-outlined text-sm text-secondary flex-shrink-0 mt-0.5">local_gas_station</span>
            <span>
              <strong>Bahan Bakar:</strong> Mohon pastikan kondisi bahan bakar memadai sesuai ketentuan sewa saat pengembalian unit.
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
