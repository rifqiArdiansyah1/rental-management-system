import React from 'react'
import { Activity, CheckCircle2, AlertTriangle, AlertCircle, Clock, ShieldAlert } from 'lucide-react'

export interface CronHealthWidgetProps {
  cronHeartbeat: {
    lastRunAt: Date
    bookingsCancelled: number
    status: string
    lastError: string | null
    executionTimeMs: number | null
  } | null
  oldestPendingBooking: {
    id: string
    createdAt: Date
  } | null
  userScope: 'all' | 'branch'
  branchName?: string
  expectedIntervalMinutes?: number
}

export function CronHealthWidget({
  cronHeartbeat,
  oldestPendingBooking,
  userScope,
  branchName,
  expectedIntervalMinutes = 15
}: CronHealthWidgetProps) {
  const staleThresholdMinutes = expectedIntervalMinutes * 2 // 2x interval (default: 30 menit)

  // 1. Hitung status Heartbeat Scheduler
  let schedulerStatus: 'healthy' | 'stale' | 'failed' | 'empty' = 'empty'
  let schedulerDiffMinutes = 0

  if (cronHeartbeat) {
    schedulerDiffMinutes = Math.max(0, Math.floor((Date.now() - new Date(cronHeartbeat.lastRunAt).getTime()) / 60000))
    if (cronHeartbeat.status === 'failed') {
      schedulerStatus = 'failed'
    } else if (schedulerDiffMinutes > staleThresholdMinutes) {
      schedulerStatus = 'stale'
    } else {
      schedulerStatus = 'healthy'
    }
  }

  // 2. Hitung status Oldest Pending Booking (Scoped)
  let pendingAgeMinutes = 0
  let pendingStatus: 'clean' | 'normal' | 'due' | 'stuck' = 'clean'

  if (oldestPendingBooking) {
    pendingAgeMinutes = Math.max(0, Math.floor((Date.now() - new Date(oldestPendingBooking.createdAt).getTime()) / 60000))
    if (pendingAgeMinutes > 120) {
      pendingStatus = 'stuck' // Anomali: Lewat dari 120 menit belum dibersihkan
    } else if (pendingAgeMinutes > 90) {
      pendingStatus = 'due'   // Lewat 90 menit (menunggu siklus cron berikutnya)
    } else {
      pendingStatus = 'normal' // Dalam jendela waktu pembayaran wajar (<90 menit)
    }
  }

  return (
    <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CARD 1: Status Scheduler / Telemetri Heartbeat */}
      <div 
        data-testid="cron-scheduler-card"
        className={`p-5 rounded-xl border transition-all ${
          schedulerStatus === 'healthy' 
            ? 'bg-emerald-50/50 border-emerald-200' 
            : schedulerStatus === 'stale' || schedulerStatus === 'failed'
            ? 'bg-red-50/60 border-red-200'
            : 'bg-zinc-50 border-zinc-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${
              schedulerStatus === 'healthy' 
                ? 'text-emerald-600' 
                : schedulerStatus === 'stale' || schedulerStatus === 'failed'
                ? 'text-red-600'
                : 'text-zinc-500'
            }`} />
            <h4 className="text-sm font-bold text-zinc-900">
              Pembersihan Otomatis (Cron Telemetry)
            </h4>
          </div>

          {/* Badge Status */}
          {schedulerStatus === 'healthy' && (
            <span 
              data-testid="cron-status-badge" 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Berjalan Normal
            </span>
          )}
          {schedulerStatus === 'stale' && (
            <span 
              data-testid="cron-status-badge" 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Scheduler Berhenti
            </span>
          )}
          {schedulerStatus === 'failed' && (
            <span 
              data-testid="cron-status-badge" 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Eksekusi Gagal
            </span>
          )}
          {schedulerStatus === 'empty' && (
            <span 
              data-testid="cron-status-badge" 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Belum Ada Data
            </span>
          )}
        </div>

        {/* Deskripsi & Telemetri */}
        {cronHeartbeat ? (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-700">
              Terakhir berjalan:{' '}
              <strong className="font-semibold text-zinc-900">
                {schedulerDiffMinutes === 0 ? 'Baru saja' : `${schedulerDiffMinutes} menit lalu`}
              </strong>{' '}
              ({new Date(cronHeartbeat.lastRunAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
            </p>
            <p className="text-xs text-zinc-600">
              Pesanan dibatalkan terakhir:{' '}
              <span className="font-medium text-zinc-900">{cronHeartbeat.bookingsCancelled} unit</span>
              {cronHeartbeat.executionTimeMs != null && (
                <span className="text-zinc-400 text-[11px] ml-1.5">
                  ({cronHeartbeat.executionTimeMs}ms)
                </span>
              )}
            </p>
            {schedulerStatus === 'stale' && (
              <p className="text-xs text-red-700 font-medium mt-2 bg-red-100/70 p-2 rounded border border-red-200">
                Peringatan: Heartbeat melampaui batas toleransi {staleThresholdMinutes} menit (2× interval {expectedIntervalMinutes}m). Periksa scheduler eksternal di cron-job.org.
              </p>
            )}
            {schedulerStatus === 'failed' && cronHeartbeat.lastError && (
              <p className="text-xs text-red-700 font-medium mt-2 bg-red-100/70 p-2 rounded border border-red-200">
                Error: {cronHeartbeat.lastError}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Belum ada eksekusi pembersihan otomatis yang tercatat. Sistem akan mulai mencatat saat scheduler pertama kali memicu endpoint.
          </p>
        )}
      </div>

      {/* CARD 2: Deteksi Anomali Independen (Oldest Pending Booking Scoped) */}
      <div 
        data-testid="cron-anomaly-card"
        className={`p-5 rounded-xl border transition-all ${
          pendingStatus === 'stuck' 
            ? 'bg-red-50/60 border-red-200' 
            : pendingStatus === 'due'
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-zinc-50 border-zinc-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${
              pendingStatus === 'stuck' 
                ? 'text-red-600' 
                : pendingStatus === 'due'
                ? 'text-amber-600'
                : 'text-zinc-500'
            }`} />
            <div>
              <h4 className="text-sm font-bold text-zinc-900">
                {userScope === 'branch' 
                  ? `Antrean Pending (${branchName || 'Cabang Anda'})`
                  : 'Antrean Pending (Seluruh Cabang)'}
              </h4>
            </div>
          </div>

          {/* Badge Anomali */}
          {pendingStatus === 'clean' && (
            <span 
              data-testid="anomaly-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700"
            >
              Antrean Bersih
            </span>
          )}
          {pendingStatus === 'normal' && (
            <span 
              data-testid="anomaly-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"
            >
              Dalam Batas Normal
            </span>
          )}
          {pendingStatus === 'due' && (
            <span 
              data-testid="anomaly-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"
            >
              Menunggu Siklus
            </span>
          )}
          {pendingStatus === 'stuck' && (
            <span 
              data-testid="anomaly-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 animate-pulse"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Anomali Booking Tertahan
            </span>
          )}
        </div>

        {/* Detail Antrean Pending */}
        {oldestPendingBooking ? (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-700">
              Pesanan pending tertua:{' '}
              <strong className={`font-semibold ${pendingStatus === 'stuck' ? 'text-red-700' : 'text-zinc-900'}`}>
                {pendingAgeMinutes} menit
              </strong>
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              ID: {oldestPendingBooking.id.substring(0, 8)}... (dibuat {new Date(oldestPendingBooking.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
            </p>
            {pendingStatus === 'stuck' && (
              <p className="text-xs text-red-700 font-medium mt-2 bg-red-100/70 p-2 rounded border border-red-200">
                Peringatan: Pesanan telah melebihi 120 menit belum dibatalkan. Mengindikasikan scheduler mati atau kegagalan transaksi pembersihan.
              </p>
            )}
            {pendingStatus === 'due' && (
              <p className="text-xs text-amber-700 font-medium mt-2 bg-amber-100/70 p-2 rounded border border-amber-200">
                Pesanan telah melewati 90 menit dan dijadwalkan dibatalkan pada trigger scheduler berikutnya.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            {userScope === 'branch'
              ? 'Tidak ada pesanan pending pembayaran di cabang Anda saat ini.'
              : 'Tidak ada pesanan pending pembayaran di seluruh cabang saat ini.'}
          </p>
        )}
      </div>
    </div>
  )
}
