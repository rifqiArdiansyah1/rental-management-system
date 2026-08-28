'use client'

import { useState, useEffect, useTransition } from 'react'
import { getSnapToken, syncPaymentStatus } from '@/actions/payment'
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
  const [isPending, startTransition] = useTransition()
  const [isSyncing, setIsSyncing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

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
          disabled={isPending || isSyncing}
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
      </div>
    </>
  )
}
