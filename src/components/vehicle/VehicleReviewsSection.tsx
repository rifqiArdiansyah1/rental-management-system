import { prisma } from '@/utils/prisma'
import { getVehicleRelocationChainIds, calculateReviewMetrics, formatCustomerReviewName } from '@/lib/reviews'
import { Star, ShieldCheck, MapPin, Calendar, Car } from 'lucide-react'
import { Locale } from '@/lib/i18n/types'
import { formatDate } from '@/lib/i18n/formatters'

interface VehicleReviewsSectionProps {
  vehicleId: string
  currentBranchId: string
  currentBranchName: string
  locale: Locale
  dict: any
}

export default async function VehicleReviewsSection({
  vehicleId,
  currentBranchId,
  currentBranchName,
  locale,
  dict,
}: VehicleReviewsSectionProps) {
  const isEn = locale === 'en'
  const d = dict.reviews || {}

  // 1. Dapatkan seluruh record ID unit fisik dari rantai mutasi armada (Issue #33)
  const chainIds = await getVehicleRelocationChainIds(vehicleId)

  // 2. Query ulasan terbit dari seluruh rantai unit fisik ini
  const reviews = await prisma.review.findMany({
    where: {
      vehicleId: { in: chainIds },
      isPublished: true,
    },
    include: {
      customer: { select: { name: true } },
      branch: { select: { id: true, name: true, city: true } },
      booking: { select: { rentalType: true, startDate: true, endDate: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  // 3. Hitung metrik agregat (rata-rata rating & distribusi bintang)
  const metrics = calculateReviewMetrics(reviews)

  return (
    <section className="py-16 border-t border-surface-variant/30 bg-surface/30" data-testid="vehicle-reviews-section">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        
        {/* Section Header */}
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest font-semibold">
              {d.sectionTitle || 'Ulasan Pelanggan'}
            </span>
          </div>
          <h2 className="font-display-lg text-2xl md:text-3xl font-bold text-white tracking-tight">
            {isEn ? 'Verified Renter Experiences' : 'Pengalaman Nyata Penyewa'}
          </h2>
          <p className="font-body-md text-sm text-zinc-400 mt-2 max-w-2xl">
            {d.sectionSubtitle || 'Pengalaman nyata dari para penyewa terverifikasi yang telah menyelesaikan perjalanan bersama armada kami.'}
          </p>
        </div>

        {reviews.length === 0 ? (
          /* Empty State */
          <div 
            className="p-10 md:p-14 rounded-2xl bg-surface-container-lowest/70 border border-surface-variant/40 text-center flex flex-col items-center justify-center max-w-xl mx-auto shadow-lg"
            data-testid="reviews-empty-state"
          >
            <div className="w-14 h-14 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary mb-4">
              <Star className="w-7 h-7" />
            </div>
            <h3 className="font-display-md text-lg text-white font-bold mb-2">
              {d.emptyTitle || 'Belum Ada Ulasan'}
            </h3>
            <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-md">
              {d.emptySubtitle || 'Jadilah yang pertama memberikan ulasan untuk armada ini setelah menyelesaikan perjalanan Anda.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Summary Metrics Card (4 cols) */}
            <div className="lg:col-span-4 bg-surface-container-lowest/80 border border-surface-variant/50 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-xl">
              <div className="text-center pb-6 border-b border-surface-variant/40">
                <span className="text-5xl md:text-6xl font-display-lg font-bold text-secondary tracking-tight block" data-testid="average-rating-score">
                  {metrics.averageRating.toFixed(1)}
                </span>
                <div className="flex items-center justify-center gap-1.5 mt-3 mb-2" data-testid="average-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${
                        s <= Math.round(metrics.averageRating)
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                          : 'text-zinc-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-zinc-400" data-testid="reviews-count-caption">
                  {d.basedOn || 'berdasarkan'}{' '}
                  <strong className="text-white font-semibold">{metrics.totalReviews}</strong>{' '}
                  {d.reviewsCount || 'ulasan terverifikasi'}
                </p>
              </div>

              {/* Rating Distribution Bars */}
              <div className="mt-6 flex flex-col gap-2.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = metrics.ratingDistribution[star as 1 | 2 | 3 | 4 | 5] || 0
                  const percentage = metrics.totalReviews > 0 ? (count / metrics.totalReviews) * 100 : 0

                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 w-10 text-zinc-300 font-medium justify-end">
                        <span>{star}</span>
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-surface-container/80 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-secondary to-amber-300 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-zinc-400 font-mono text-[11px]">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: Review Cards List (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-5" data-testid="review-cards-list">
              {reviews.map((rev) => {
                const isCurrentBranch = rev.branchId === currentBranchId
                const branchLabel = isCurrentBranch
                  ? `${d.currentBranchBadge || 'Disewa di Cabang Ini'} (${rev.branch.name})`
                  : `${d.historyBranchBadge || 'Riwayat Sewa di Cabang'} ${rev.branch.name}`

                const maskedName = formatCustomerReviewName(rev.customer.name)
                const reviewDate = formatDate(rev.createdAt, locale)
                const rentalTypeLabel = rev.booking.rentalType === 'with_driver'
                  ? (isEn ? 'With Driver' : 'Dengan Sopir')
                  : (isEn ? 'Self Drive' : 'Lepas Kunci')

                return (
                  <div
                    key={rev.id}
                    className="p-6 rounded-xl bg-surface-container-lowest/60 border border-surface-variant/40 hover:border-secondary/30 transition-all shadow-md"
                    data-testid="review-card"
                  >
                    {/* Header Card: Stars & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-1" data-testid="review-card-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]'
                                : 'text-zinc-600'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Disambiguasi Cabang Asal & Verified Chip */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            isCurrentBranch
                              ? 'bg-secondary/10 text-secondary border-secondary/30'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          }`}
                          data-testid="branch-provenance-badge"
                        >
                          <MapPin className="w-3 h-3 text-secondary" />
                          <span>{branchLabel}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{d.verifiedRenter || 'Penyewa Terverifikasi'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Review Comment */}
                    {rev.comment ? (
                      <p className="text-sm text-zinc-200 leading-relaxed my-3 font-body-md" data-testid="review-comment-text">
                        "{rev.comment}"
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic my-2">
                        {isEn ? 'No written review provided.' : 'Tidak menyertakan komentar tertulis.'}
                      </p>
                    )}

                    {/* Footer Card: Masked Customer Name, Rental Type, Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-surface-variant/25 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white" data-testid="masked-customer-name">
                          {maskedName}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <Car className="w-3 h-3 text-zinc-500" />
                          <span>{rentalTypeLabel}</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {reviewDate}
                      </span>
                    </div>

                  </div>
                )
              })}
            </div>

          </div>
        )}

      </div>
    </section>
  )
}
