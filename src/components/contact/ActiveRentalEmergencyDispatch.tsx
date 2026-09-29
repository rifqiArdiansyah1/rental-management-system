'use client'

import React, { useState } from 'react'
import {
  Car,
  Phone,
  MessageSquare,
  MapPin,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { reportEmergencyIncidentAction } from '@/actions/incident'
import { getVehicleDisplayName } from '@/lib/vehicleHelper'

interface ActiveRentalEmergencyDispatchProps {
  booking: {
    id: string
    vehicle: {
      name: string
      plateNumber: string
      category: { name: string }
    }
    pickupBranch: {
      name: string
      phone: string
      address: string
      city: string
    }
    rentalType: string
    driver?: {
      name: string
      phone: string
    } | null
    incidents?: Array<{
      id: string
      category: string
      description: string
      status: string
      reportedAt: Date | string
      resolution?: string | null
    }>
  }
  isEn?: boolean
}

export default function ActiveRentalEmergencyDispatch({
  booking,
  isEn = false,
}: ActiveRentalEmergencyDispatchProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [category, setCategory] = useState<string>('breakdown')
  const [description, setDescription] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [isGettingGps, setIsGettingGps] = useState(false)
  const [gpsSuccessMsg, setGpsSuccessMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const shortId = booking.id.substring(0, 8).toUpperCase()
  const vehicleTitle = getVehicleDisplayName(booking.vehicle)
  const branchPhoneClean = booking.pickupBranch.phone.replace(/[^0-9+]/g, '')
  const waBranchPhone = branchPhoneClean.startsWith('0')
    ? '62' + branchPhoneClean.slice(1)
    : branchPhoneClean.replace('+', '')

  const prefilledWaMsg = encodeURIComponent(
    `Halo ${booking.pickupBranch.name}, saya penyewa armada *${vehicleTitle}* (${booking.vehicle.plateNumber}), ID Pesanan: *#${shortId}*. Saya mengalami kendala darurat di jalan dan membutuhkan bantuan operasional cabang segera.`
  )
  const waUrl = `https://wa.me/${waBranchPhone}?text=${prefilledWaMsg}`

  // 1-Tap Browser Geolocation handler
  const handleGetSosGps = () => {
    if (!navigator.geolocation) {
      alert(isEn ? 'Geolocation is not supported by your browser.' : 'Browser Anda tidak mendukung deteksi lokasi GPS.')
      return
    }

    setIsGettingGps(true)
    setGpsSuccessMsg(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
        setLocation(mapsUrl)
        setIsGettingGps(false)
        setGpsSuccessMsg(
          isEn
            ? `GPS Acquired: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
            : `GPS Terdeteksi: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        )

        // Also copy coordinates link to clipboard
        navigator.clipboard?.writeText(mapsUrl).catch(() => {})
      },
      (error) => {
        setIsGettingGps(false)
        console.warn('Geolocation error:', error)
        alert(
          isEn
            ? 'Unable to acquire GPS position. Please enter your location manually or allow location access in your browser.'
            : 'Gagal mendeteksi lokasi GPS otomatis. Izinkan akses lokasi browser atau ketik lokasi Anda secara manual.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await reportEmergencyIncidentAction({
        bookingId: booking.id,
        category,
        description,
        location: location || null,
      })

      if (!res.success) {
        setErrorMessage(res.error || (isEn ? 'Failed to submit incident report.' : 'Gagal mengirim laporan insiden.'))
      } else {
        setSubmissionSuccess(true)
        setDescription('')
        // Auto close after 3 seconds
        setTimeout(() => {
          setIsModalOpen(false)
          setSubmissionSuccess(false)
        }, 3000)
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isEn ? 'An unexpected error occurred.' : 'Terjadi kesalahan sistem.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-amber-950/40 via-surface-container-lowest to-surface-container-lowest border-2 border-amber-600/70 rounded-xl p-6 sm:p-8 shadow-xl shadow-amber-950/20 mb-10 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-amber-900/40">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 flex-shrink-0 animate-pulse">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {isEn ? 'ACTIVE RENTAL' : 'SEWA AKTIF SAAT INI'}
              </span>
              <span className="text-xs text-zinc-400 font-mono">#{shortId}</span>
            </div>
            <h3 className="font-display-md text-xl sm:text-2xl text-white font-bold">
              {vehicleTitle}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              {isEn ? 'License Plate:' : 'Nomor Polisi:'}{' '}
              <strong className="text-white font-mono">{booking.vehicle.plateNumber}</strong>
              <span className="mx-2 text-zinc-600">•</span>
              {isEn ? 'Branch:' : 'Cabang Pengelola:'}{' '}
              <span className="text-amber-300 font-medium">{booking.pickupBranch.name}</span>
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high/80 border border-amber-900/30 self-start md:self-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-medium text-emerald-400">
            {isEn ? 'Vehicle Handed Over (Ongoing)' : 'Armada Sedang Digunakan'}
          </span>
        </div>
      </div>

      {/* Action Dispatch Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-6">
        {/* 1. Direct Call Branch */}
        <a
          href={`tel:${booking.pickupBranch.phone}`}
          data-testid="active-booking-branch-call"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md hover:shadow-blue-600/30"
        >
          <Phone className="w-4 h-4" />
          <span>{isEn ? 'Call Branch' : 'Telepon Cabang'}</span>
        </a>

        {/* 2. Direct WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="active-booking-wa-call"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-md hover:shadow-emerald-600/30"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{isEn ? 'WhatsApp Dispatch' : 'WhatsApp Darurat'}</span>
        </a>

        {/* 3. 1-Tap SOS GPS Button */}
        <button
          type="button"
          onClick={handleGetSosGps}
          disabled={isGettingGps}
          data-testid="sos-gps-btn"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-sm transition-all disabled:opacity-50"
        >
          {isGettingGps ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <MapPin className="w-4 h-4 text-rose-400" />
          )}
          <span>{isGettingGps ? (isEn ? 'Locating...' : 'Mencari GPS...') : (isEn ? 'Share SOS GPS' : 'Kirim Titik GPS')}</span>
        </button>

        {/* 4. Open Incident Report Modal */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          data-testid="open-incident-modal-btn"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium text-sm transition-all shadow-md hover:shadow-red-700/30"
        >
          <AlertOctagon className="w-4 h-4" />
          <span>{isEn ? 'Report Incident' : 'Lapor Kendala Darurat'}</span>
        </button>
      </div>

      {gpsSuccessMsg && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {gpsSuccessMsg} (Tautan Google Maps telah disalin ke clipboard)
          </span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="underline font-semibold hover:text-white"
          >
            Lampirkan ke Laporan
          </button>
        </div>
      )}

      {/* Incident History (if any) */}
      {booking.incidents && booking.incidents.length > 0 && (
        <div className="mt-6 pt-5 border-t border-zinc-800/80">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            {isEn ? 'Incident Reports for This Booking:' : 'Riwayat Laporan Darurat Pesanan Ini:'}
          </h4>
          <div className="space-y-2">
            {booking.incidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-surface-container-high/60 border border-surface-variant/40 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inc.status === 'open'
                          ? 'bg-red-900/60 text-red-300 border border-red-700'
                          : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      }`}
                    >
                      {inc.status === 'open' ? '🚨 Menunggu Respons Staf' : '✅ Selesai Ditangani'}
                    </span>
                    <span className="font-semibold text-white capitalize">{inc.category}</span>
                  </div>
                  <p className="text-zinc-300 line-clamp-1">{inc.description}</p>
                  {inc.resolution && (
                    <p className="text-emerald-400 text-[11px]">
                      <strong>Tindakan Cabang:</strong> {inc.resolution}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-mono flex-shrink-0">
                  {new Date(inc.reportedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incident Report Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container border border-surface-variant/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-white font-bold">
                    {isEn ? 'Emergency Incident Report' : 'Lapor Kendala Darurat Perjalanan'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    ID Pesanan: <span className="font-mono text-white">#{shortId}</span> • {vehicleTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {submissionSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-white">
                  {isEn ? 'Incident Report Dispatched' : 'Laporan Darurat Berhasil Dikirim!'}
                </h4>
                <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                  {isEn
                    ? `Our operational team at ${booking.pickupBranch.name} has received your incident signal and will contact you immediately.`
                    : `Tim operasional cabang ${booking.pickupBranch.name} telah menerima sinyal darurat ini. Staf kami akan segera menghubungi nomor telepon Anda.`}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitIncident} className="space-y-4 pt-4">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
                    {errorMessage}
                  </div>
                )}

                {/* Kategori Kendala */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    {isEn ? 'Incident Category' : 'Kategori Kendala Darurat *'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    data-testid="incident-category-select"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                  >
                    <option value="breakdown">Kendala Mesin / Mogok (Breakdown)</option>
                    <option value="accident">Kecelakaan Lalu Lintas (Accident)</option>
                    <option value="tire">Ban Bocor / Pecah Ban (Tire Issue)</option>
                    <option value="driver">Kendala Sopir / Pelanggaran Etika (Chauffeur Issue)</option>
                    <option value="medical">Kedaruratan Medis Penumpang (Medical)</option>
                    <option value="other">Kendala Darurat Lainnya (Other)</option>
                  </select>
                </div>

                {/* Lokasi Kejadian */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      {isEn ? 'Location / GPS Coordinates' : 'Lokasi Terkini / Koordinat GPS'}
                    </label>
                    <button
                      type="button"
                      onClick={handleGetSosGps}
                      disabled={isGettingGps}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {isGettingGps ? (isEn ? 'Detecting...' : 'Mendeteksi...') : (isEn ? 'Auto-Detect GPS' : 'Deteksi GPS Otomatis')}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      isEn
                        ? 'e.g. Tol Cipularang KM 92 or Google Maps Link'
                        : 'Contoh: Tol Jagorawi KM 28 atau tautan Google Maps'
                    }
                    data-testid="incident-location-input"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                {/* Deskripsi Detail Kendala */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    {isEn ? 'Incident Description *' : 'Deskripsi Kejadian & Kondisi Armada *'}
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Describe the situation, vehicle condition, safety status, and assistance needed...'
                        : 'Jelaskan kronologi singkat, kondisi armada, keselamatan penumpang, dan bantuan yang mendesak dibutuhkan...'
                    }
                    required
                    minLength={5}
                    data-testid="incident-description-input"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
                  >
                    {isEn ? 'Cancel' : 'Batal'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || description.trim().length < 5}
                    data-testid="submit-incident-btn"
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all shadow-md hover:shadow-red-600/30 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isEn ? 'Sending...' : 'Mengirim Laporan...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Send Emergency Alert' : 'Kirim Laporan Darurat'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
