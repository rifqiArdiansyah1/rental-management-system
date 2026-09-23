'use client'

type Props = {
  vehicleName: string
  startDateFormatted: string
  branchName: string
  reason?: 'missing_both' | 'missing_ktp' | 'missing_sim' | 'rejected' | 'pending' | 'verified'
  rejectionReason?: string | null
}

export default function UrgentKycBanner({
  vehicleName,
  startDateFormatted,
  branchName,
  reason = 'missing_both',
  rejectionReason
}: Props) {
  const scrollToUpload = () => {
    const el = document.getElementById('document-upload-form')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Highlight the form briefly
      el.classList.add('ring-2', 'ring-secondary', 'ring-offset-2', 'transition-all')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-secondary', 'ring-offset-2')
      }, 2500)
    }
  }

  if (reason === 'verified') {
    return null
  }

  const isRejected = reason === 'rejected'
  const isPending = reason === 'pending'

  if (isPending) {
    return (
      <div 
        className="w-full mb-8 p-4 sm:p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
        data-testid="urgent-kyc-banner-pending"
      >
        <div className="flex items-start gap-3.5">
          <span className="material-symbols-outlined text-amber-400 text-3xl flex-shrink-0 mt-0.5">schedule</span>
          <div>
            <h3 className="font-bold text-on-surface text-sm sm:text-base">
              Verifikasi Dokumen Sedang Ditinjau Tim Staf
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
              Pesanan armada <strong>{vehicleName}</strong> untuk jadwal <strong>{startDateFormatted}</strong> sedang menunggu persetujuan staf cabang <strong>{branchName}</strong>. Kunci siap diserahterimakan segera setelah verifikasi disetujui.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`w-full mb-8 p-5 sm:p-6 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md ${
        isRejected 
          ? 'bg-red-500/10 border-red-500/30' 
          : 'bg-amber-500/10 border-amber-500/30'
      }`}
      data-testid="urgent-kyc-banner"
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-full flex-shrink-0 ${
          isRejected ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
        }`}>
          <span className="material-symbols-outlined text-2xl sm:text-3xl">
            {isRejected ? 'error' : 'warning'}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              isRejected ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              Tindakan Diperlukan Sebelum Penjemputan
            </span>
            <span className="text-xs text-on-surface-variant">• {vehicleName} ({startDateFormatted})</span>
          </div>

          <h3 className="font-bold text-on-surface text-base sm:text-lg mt-1">
            {isRejected 
              ? 'Dokumen Identitas Anda Ditolak & Memerlukan Perbaikan' 
              : reason === 'missing_ktp'
              ? 'Lengkapi Foto KTP Anda untuk Pesanan Aktif'
              : reason === 'missing_sim'
              ? 'Lengkapi Foto SIM Anda untuk Pesanan Aktif'
              : 'Unggah KTP & SIM Anda untuk Memastikan Armada Siap Diambil'}
          </h3>

          <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed">
            {isRejected ? (
              <>Catatan penolakan dari staf: <strong>"{rejectionReason || 'Dokumen buram / tidak valid'}"</strong>. Harap unggah ulang dokumen yang sah.</>
            ) : (
              <>Sesuai SOP serah terima armada di cabang <strong>{branchName}</strong>, kunci kendaraan hanya dapat diserahkan jika identitas (KTP & SIM) telah terverifikasi resmi oleh staf kami.</>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={scrollToUpload}
        className={`w-full sm:w-auto px-5 py-3 rounded-lg font-button text-xs sm:text-sm whitespace-nowrap shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer flex-shrink-0 ${
          isRejected
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-secondary text-on-secondary hover:bg-secondary-fixed'
        }`}
        data-testid="btn-urgent-kyc-cta"
      >
        <span className="material-symbols-outlined text-sm">upload_file</span>
        <span>Lengkapi Dokumen Sekarang</span>
      </button>
    </div>
  )
}
