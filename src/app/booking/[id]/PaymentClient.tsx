'use client'

import { useState, useEffect, useTransition } from 'react'
import { getSnapToken, syncPaymentStatus } from '@/actions/payment'
import { customerCancelBooking } from '@/actions/booking'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

type Props = {
  bookingId: string
  createdAtMs: number
  clientKey: string
  isProduction?: boolean
}

export default function PaymentClient({ bookingId, createdAtMs, clientKey, isProduction = false }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [isSyncing, setIsSyncing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false)
  const [isCancelling, setIsCancelling] = useState<boolean>(false)
  const [cancelModalError, setCancelModalError] = useState<string | null>(null)

  useEffect(() => {
    // 60 minutes expiry
    const expiryTime = createdAtMs + 60 * 60 * 1000

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        router.refresh() // Refresh page to show expired state
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [createdAtMs, router])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const [isSnapOpen, setIsSnapOpen] = useState<boolean>(false)

  const handlePay = () => {
    if (isSnapOpen) return
    setErrorMsg(null)
    setInfoMsg(null)
    setIsSnapOpen(true)
    startTransition(async () => {
      try {
        const { token } = await getSnapToken(bookingId)
        
        // Trigger Midtrans Snap
        // @ts-ignore
        if (window.snap) {
          // @ts-ignore
          window.snap.pay(token, {
            onSuccess: async function() {
              setIsSnapOpen(false)
              setInfoMsg('Pembayaran berhasil diverifikasi. Memperbarui status...')
              await syncPaymentStatus(bookingId)
              router.refresh()
            },
            onPending: async function() {
              setIsSnapOpen(false)
              setInfoMsg('Menunggu penyelesaian pembayaran. Anda dapat menekan "Cek Status Pembayaran" setelah transfer.')
              await syncPaymentStatus(bookingId)
              router.refresh()
            },
            onError: async function() {
              setIsSnapOpen(false)
              setErrorMsg('Pembayaran gagal atau dibatalkan.')
              await syncPaymentStatus(bookingId)
              router.refresh()
            },
            onClose: async function() {
              setIsSnapOpen(false)
              // Sync in case user paid through deep-link / bank app before closing popup
              await syncPaymentStatus(bookingId)
              router.refresh()
            }
          })
        } else {
          setIsSnapOpen(false)
          setErrorMsg('Midtrans Snap tidak tersedia. Coba refresh halaman.')
        }
      } catch (err: any) {
        setIsSnapOpen(false)
        setErrorMsg(err.message || 'Gagal membuat token pembayaran.')
      }
    })
  }

  const handleManualSync = async () => {
    setErrorMsg(null)
    setInfoMsg(null)
    setIsSyncing(true)
    try {
      const res = await syncPaymentStatus(bookingId)
      if (res.status === 'confirmed') {
        setInfoMsg('Pembayaran berhasil terverifikasi!')
        router.refresh()
      } else if (res.status === 'cancelled') {
        setErrorMsg('Pesanan ini telah dibatalkan atau kedaluwarsa.')
        router.refresh()
      } else {
        setInfoMsg('Status pembayaran masih menunggu penyelesaian transfer di Midtrans.')
      }
    } catch (e: any) {
      setErrorMsg('Gagal menyinkronkan status dengan payment gateway.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (isCancelling) return
    setIsCancelling(true)
    setCancelModalError(null)
    try {
      const res = await customerCancelBooking(bookingId)
      if (res.success) {
        setShowCancelModal(false)
        router.refresh()
      } else {
        setCancelModalError(res.error || 'Gagal membatalkan pemesanan.')
      }
    } catch (err: any) {
      setCancelModalError(err.message || 'Terjadi kesalahan sistem saat membatalkan.')
    } finally {
      setIsCancelling(false)
    }
  }

  const snapScriptUrl = isProduction 
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js"

  return (
    <>
      <Script 
        src={snapScriptUrl} 
        data-client-key={clientKey}
        strategy="lazyOnload"
      />
      
      <div className="flex flex-col items-center gap-4">
        {errorMsg && (
          <div className="w-full p-4 bg-error-container/20 border border-error rounded-lg text-error text-center text-sm">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="w-full p-4 bg-secondary/10 border border-secondary rounded-lg text-secondary text-center text-sm">
            {infoMsg}
          </div>
        )}
        
        <div className="bg-surface-variant px-6 py-3 rounded-full flex gap-2 items-center text-on-surface-variant font-label-caps tracking-widest uppercase">
          <span className="material-symbols-outlined text-xl">timer</span>
          Expires in: <span className="font-headline-sm text-secondary">{formatTime(timeLeft)}</span>
        </div>
        
        <button
          onClick={handlePay}
          disabled={isPending || isSnapOpen || timeLeft === 0 || isSyncing}
          className="w-full mt-4 bg-secondary text-on-secondary font-button py-4 rounded-lg hover:bg-secondary-fixed transition-all shadow-[0_10px_20px_-10px_rgba(233,193,118,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex justify-center items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              <span>Memproses Pembayaran...</span>
            </>
          ) : (
            'Bayar Sekarang'
          )}
        </button>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isPending || isSyncing || isCancelling}
          className="w-full border border-surface-variant hover:bg-surface-variant/50 text-on-surface font-button py-3 rounded-lg transition-colors text-sm flex justify-center items-center gap-2"
        >
          {isSyncing ? (
            <>
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              <span>Memeriksa Status Midtrans...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>Sudah Bayar? Cek Status Pembayaran</span>
            </>
          )}
        </button>

        <div className="w-full pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setCancelModalError(null)
              setShowCancelModal(true)
            }}
            disabled={isPending || isSyncing || isCancelling}
            className="text-xs text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1.5 py-1 px-3 rounded cursor-pointer disabled:opacity-50"
            data-testid="self-cancel-btn"
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
            <span>{t.booking?.selfCancel?.cancelBtn || 'Batalkan Pemesanan Ini'}</span>
          </button>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-variant rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">event_busy</span>
              </div>
              <h3 className="font-bold text-on-surface text-lg">
                {t.booking?.selfCancel?.confirmModalTitle || 'Batalkan Pemesanan?'}
              </h3>
            </div>
            
            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
              {t.booking?.selfCancel?.confirmModalDesc ||
                'Pemesanan ini belum dibayar. Jika Anda membatalkannya, slot jadwal armada akan segera dibuka kembali untuk pelanggan lain. Tindakan ini tidak dapat dibatalkan.'}
            </p>

            {cancelModalError && (
              <div className="p-3 mb-4 bg-error-container/20 border border-error rounded-lg text-error text-xs">
                {cancelModalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isCancelling) setShowCancelModal(false)
                }}
                disabled={isCancelling}
                className="flex-1 border border-surface-variant text-on-surface-variant py-2.5 rounded-lg text-sm hover:border-zinc-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.booking?.selfCancel?.keepBtn || 'Tidak, Lanjutkan Pembayaran'}
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                data-testid="confirm-self-cancel-btn"
              >
                {isCancelling ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>{t.booking?.selfCancel?.cancelling || 'Membatalkan...'}</span>
                  </>
                ) : (
                  t.booking?.selfCancel?.confirmBtn || 'Ya, Batalkan Pemesanan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
