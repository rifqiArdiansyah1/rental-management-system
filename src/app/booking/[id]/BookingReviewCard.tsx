'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import ReviewModal from '@/components/review/ReviewModal'
import { useRouter } from 'next/navigation'

interface BookingReviewCardProps {
  bookingId: string
  vehicleName: string
  review?: {
    id: string
    rating: number
    comment?: string | null
  } | null
}

export default function BookingReviewCard({
  bookingId,
  vehicleName,
  review,
}: BookingReviewCardProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4 text-center p-6 bg-surface-container/40 border border-surface-variant/70 rounded-xl text-on-surface">
      <div className="flex justify-center">
        <span className="material-symbols-outlined text-4xl text-secondary">verified</span>
      </div>

      <div>
        <h3 className="font-bold text-lg text-white">Masa Sewa Selesai</h3>
        <p className="text-sm text-zinc-400 mt-1">
          {review
            ? 'Terima kasih telah mempercayakan perjalanan Anda bersama Prestige Motion.'
            : 'Perjalanan Anda telah selesai. Bagikan pengalaman Anda untuk membantu penyewa lain.'}
        </p>
      </div>

      {review ? (
        <div className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-sm font-semibold mx-auto" data-testid="booking-page-reviewed-badge">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Ulasan Anda: {review.rating} / 5 Bintang</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="shimmer-btn mt-2 mx-auto inline-flex items-center gap-2 bg-secondary text-on-secondary font-button text-sm py-2.5 px-6 rounded-lg hover:bg-secondary-fixed transition-colors font-semibold cursor-pointer shadow-md"
          data-testid="booking-page-review-btn"
        >
          <Star className="w-4 h-4 fill-black text-black" />
          <span>Beri Ulasan Armada</span>
        </button>
      )}

      {isOpen && (
        <ReviewModal
          isOpen={true}
          onClose={() => setIsOpen(false)}
          bookingId={bookingId}
          vehicleName={vehicleName}
          onSuccess={() => {
            setIsOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
