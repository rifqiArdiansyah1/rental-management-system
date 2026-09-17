'use client'

import { useState, useTransition } from 'react'
import { submitCustomerReview } from '@/actions/review'
import { useRouter } from 'next/navigation'
import { Star, X, CheckCircle, AlertCircle } from 'lucide-react'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
  vehicleName: string
  locale?: string
  dict?: {
    modalTitle: string
    modalSubtitle: string
    ratingLabel: string
    ratingRequired: string
    commentLabel: string
    commentPlaceholder: string
    submitReview: string
    submittingReview: string
    successTitle: string
    successSubtitle: string
    closeBtn: string
  }
  onSuccess?: () => void
}

export default function ReviewModal({
  isOpen,
  onClose,
  bookingId,
  vehicleName,
  dict,
  onSuccess,
}: ReviewModalProps) {
  const router = useRouter()
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const d = dict || {
    modalTitle: 'Beri Ulasan Armada',
    modalSubtitle: 'Ulasan Anda membantu calon penyewa lain dan mendukung standar layanan kami.',
    ratingLabel: 'Penilaian Pengalaman Sewa',
    ratingRequired: 'Silakan pilih rating bintang (1-5).',
    commentLabel: 'Ulasan / Catatan Pengalaman',
    commentPlaceholder: 'Bagikan pengalaman Anda mengenai performa kendaraan, kebersihan, dan kenyamanan perjalanan...',
    submitReview: 'Kirim Ulasan',
    submittingReview: 'Mengirimkan Ulasan...',
    successTitle: 'Ulasan Berhasil Dikirim',
    successSubtitle: 'Terima kasih atas ulasan berharga Anda.',
    closeBtn: 'Tutup',
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || rating < 1 || rating > 5) {
      setError(d.ratingRequired)
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await submitCustomerReview({
        bookingId,
        rating,
        comment,
      })

      if (res.success) {
        setIsSuccess(true)
        router.refresh()
      } else {
        setError(res.error || 'Terjadi kesalahan.')
      }
    })
  }

  const handleClose = () => {
    const wasSuccess = isSuccess
    setError(null)
    setIsSuccess(false)
    if (wasSuccess && onSuccess) {
      onSuccess()
    }
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div 
        className="relative w-full max-w-lg bg-surface border border-surface-variant/60 rounded-xl shadow-2xl p-6 md:p-8 text-on-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label={d.closeBtn}
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="font-display-md text-xl text-white font-bold mb-2">
              {d.successTitle}
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm mb-6">
              {d.successSubtitle}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 bg-secondary text-on-secondary font-button text-xs uppercase tracking-wider font-semibold rounded-lg hover:bg-secondary-fixed transition-colors cursor-pointer"
              data-testid="review-success-close-btn"
            >
              {d.closeBtn}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <span className="text-xs font-label-caps uppercase tracking-widest text-secondary font-semibold block mb-1">
                {vehicleName}
              </span>
              <h2 id="review-modal-title" className="font-display-md text-xl font-bold text-white tracking-tight">
                {d.modalTitle}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {d.modalSubtitle}
              </p>
            </div>

            {error && (
              <div 
                className="p-3 bg-error-container/20 border border-error/40 rounded-lg text-error text-xs flex items-center gap-2"
                data-testid="review-error-banner"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Star Rating Picker */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                {d.ratingLabel} <span className="text-secondary">*</span>
              </label>
              <div className="flex items-center gap-2" data-testid="star-rating-selector">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = (hoverRating || rating) >= star
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 text-zinc-600 hover:scale-110 transition-transform cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary rounded"
                      data-testid={`star-rating-${star}`}
                      aria-label={`${star} bintang`}
                    >
                      <Star
                        className={`w-7 h-7 transition-colors duration-150 ${
                          isActive
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  )
                })}
                <span className="text-sm font-bold text-amber-400 ml-2 font-mono" data-testid="selected-rating-display">
                  {rating} / 5
                </span>
              </div>
            </div>

            {/* Comment Area */}
            <div>
              <label htmlFor="review-comment" className="block text-xs font-medium text-zinc-300 mb-2">
                {d.commentLabel} <span className="text-zinc-500 font-normal">(opsional, maks. 1000 karakter)</span>
              </label>
              <textarea
                id="review-comment"
                name="comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                placeholder={d.commentPlaceholder}
                className="w-full rounded-lg bg-surface-container/60 border border-surface-variant/70 focus:border-secondary focus:ring-2 focus:ring-secondary/20 p-3 text-sm text-white placeholder-zinc-500 transition-all outline-none resize-none"
                data-testid="review-comment-input"
              />
              <div className="text-right text-[11px] text-zinc-500 mt-1">
                {comment.length} / 1000
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-variant/40">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                {d.closeBtn}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="shimmer-btn px-6 py-2.5 bg-secondary text-on-secondary font-button text-xs uppercase tracking-wider font-semibold rounded-lg hover:bg-secondary-fixed transition-all disabled:opacity-50 cursor-pointer shadow-md"
                data-testid="submit-review-btn"
              >
                {isPending ? d.submittingReview : d.submitReview}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
