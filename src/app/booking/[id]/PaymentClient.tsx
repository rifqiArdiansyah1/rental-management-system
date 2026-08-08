'use client'

import { useState, useEffect, useTransition } from 'react'
import { getSnapToken } from '@/actions/payment'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

type Props = {
  bookingId: string
  createdAtMs: number
  clientKey: string
}

export default function PaymentClient({ bookingId, createdAtMs, clientKey }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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

  const handlePay = () => {
    setErrorMsg(null)
    startTransition(async () => {
      try {
        const { token } = await getSnapToken(bookingId)
        
        // Trigger Midtrans Snap
        // @ts-ignore
        if (window.snap) {
          // @ts-ignore
          window.snap.pay(token, {
            onSuccess: function() {
              router.refresh()
            },
            onPending: function() {
              // Still pending, just close or notify
            },
            onError: function() {
              setErrorMsg('Pembayaran gagal atau dibatalkan.')
            },
            onClose: function() {
              // Customer closed the popup without finishing
            }
          })
        } else {
          setErrorMsg('Midtrans Snap tidak tersedia. Coba refresh halaman.')
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal membuat token pembayaran.')
      }
    })
  }

  const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
  const snapScriptUrl = isProd 
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
        
        <div className="bg-surface-variant px-6 py-3 rounded-full flex gap-2 items-center text-on-surface-variant font-label-caps tracking-widest uppercase">
          <span className="material-symbols-outlined text-xl">timer</span>
          Expires in: <span className="font-headline-sm text-secondary">{formatTime(timeLeft)}</span>
        </div>
        
        <button
          onClick={handlePay}
          disabled={isPending || timeLeft === 0}
          className="w-full mt-4 bg-secondary text-on-secondary font-button py-4 rounded-lg hover:bg-secondary-fixed transition-all shadow-[0_10px_20px_-10px_rgba(233,193,118,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex justify-center items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              <span>Memproses...</span>
            </>
          ) : (
            'Bayar Sekarang'
          )}
        </button>
      </div>
    </>
  )
}
