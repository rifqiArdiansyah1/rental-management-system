'use client'

import React from 'react'
import Link from 'next/link'

interface ActiveRentalBannerProps {
  bookingId: string
  vehicleName: string
  plateNumber: string
  endDate: Date | string
  returnBranchName: string
  returnBranchPhone: string
  rentalType: string
  driverName?: string | null
}

export default function ActiveRentalBanner({
  bookingId,
  vehicleName,
  plateNumber,
  endDate,
  returnBranchName,
  returnBranchPhone,
  rentalType,
  driverName,
}: ActiveRentalBannerProps) {
  const shortId = bookingId.substring(0, 8).toUpperCase()
  const cleanPhone = returnBranchPhone.replace(/\D/g, '')
  const waPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone

  const formattedEnd = new Date(endDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'

  const message = encodeURIComponent(
    `Halo ${returnBranchName}, saya pelanggan sewa ${vehicleName} (ID: #${shortId}) ingin menghubungi tim operasional cabang.`
  )

  return (
    <div
      data-testid="active-rental-banner"
      className="mb-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-zinc-900 border border-emerald-500/30 shadow-lg relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
            <span className="material-symbols-outlined text-2xl">directions_car</span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Sewa Sedang Aktif</span>
              </span>
              <span className="text-xs text-zinc-400 font-mono">#{shortId}</span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {vehicleName}{' '}
              <span className="text-xs font-mono font-normal text-zinc-400 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 ml-1">
                {plateNumber}
              </span>
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-300">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
                <span>Kembali: <strong className="text-white">{formattedEnd}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">location_on</span>
                <span>Cabang: <strong className="text-white">{returnBranchName}</strong></span>
              </span>
              {rentalType === 'with_driver' && driverName && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-secondary">person</span>
                  <span>Sopir: <strong className="text-white">{driverName}</strong></span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto self-stretch lg:self-auto justify-end">
          <Link
            href={`https://wa.me/${waPhone}?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="banner-contact-branch-btn"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-xs font-semibold text-zinc-200 hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-emerald-400 text-sm">support_agent</span>
            <span>Bantuan Cabang</span>
          </Link>

          <Link
            href={`/booking/${bookingId}`}
            data-testid="open-companion-btn"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary-fixed text-on-secondary text-xs font-bold transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-sm">dashboard_customize</span>
            <span>Buka Companion Hub</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
