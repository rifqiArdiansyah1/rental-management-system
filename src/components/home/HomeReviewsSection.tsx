import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { formatCustomerReviewName, resolveActiveVehiclesForReviews } from '@/lib/reviews'
import ScrollReveal from '@/components/ui/ScrollReveal'

interface HomeReviewsSectionProps {
  locale: string
  dict: any
}

export default async function HomeReviewsSection({
  locale,
  dict,
}: HomeReviewsSectionProps) {
  // Query up to 9 featured & published reviews ordered chronologically by featuredAt
  const rawReviews = await prisma.review.findMany({
    where: {
      isFeatured: true,
      isPublished: true,
      comment: { not: null },
    },
    orderBy: { featuredAt: 'desc' },
    take: 9,
    include: {
      customer: { select: { name: true } },
      branch: { select: { name: true } },
      vehicle: { select: { id: true, name: true, plateNumber: true } },
    },
  })

  // Filter out any whitespace-only comments
  const reviews = rawReviews.filter(
    (r) => r.comment && r.comment.trim().length > 0
  )

  // Zero-rendering: jika tidak ada ulasan ter-feature yang valid, return null (zero HTML footprint)
  if (reviews.length === 0) {
    return null
  }

  // Anti N+1 Batching: resolve seluruh relokasi armada dalam 1-2 query batch
  const vehicleIds = reviews.map((r) => r.vehicleId)
  const activeVehiclesMap = await resolveActiveVehiclesForReviews(vehicleIds)

  const isEn = locale === 'en'
  const t = dict.home.testimonials

  return (
    <section
      id="testimonials"
      data-testid="home-testimonials-section"
      className="w-full bg-surface-container-lowest border-y border-surface-variant/40 py-20 scroll-mt-20"
    >
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Section Header */}
        <ScrollReveal>
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-3">
              {t.kicker}
            </span>
            <h2 className="font-display-lg text-2xl md:text-3xl lg:text-4xl text-on-surface font-bold tracking-tight mb-4">
              {t.title}
            </h2>
            <p className="font-body-md text-sm md:text-base text-on-surface-variant leading-relaxed">
              {t.subtitle}
            </p>
          </div>
        </ScrollReveal>

        {/* Reviews Layout — Lebar penuh (w-full) mengikuti max-w-container-max landing page */}
        {reviews.length === 1 ? (
          /* Single Review Spotlight: Bentang penuh container dengan pembagian horizontal di layar lebar */
          (() => {
            const rev = reviews[0]
            const activeUnit = activeVehiclesMap.get(rev.vehicleId)
            const maskedName = formatCustomerReviewName(rev.customer.name)

            return (
              <ScrollReveal>
                <div
                  data-testid={`testimonial-card-${rev.id}`}
                  className="bg-surface-container-low/70 hover:bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 w-full transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  {/* Left: Customer Info, Rating, Branch & Testimonial Quote */}
                  <div className="flex-1">
                    {/* Header: Customer Name & Rating */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-title-md text-lg font-bold text-on-surface">
                            {maskedName}
                          </h3>
                          <span
                            className="material-symbols-outlined text-[18px] text-emerald-500"
                            title={t.verifiedRenter}
                          >
                            verified
                          </span>
                        </div>
                        <span className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider">
                          • {t.verifiedRenter}
                        </span>
                      </div>

                      {/* Stars */}
                      <div
                        className="flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20"
                        aria-label={`Rating ${rev.rating} dari 5`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-amber-500 fill-current">
                          star
                        </span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          {rev.rating}.0
                        </span>
                      </div>
                    </div>

                    {/* Historical Rental Branch */}
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant font-medium bg-surface-container-high/80 px-2.5 py-1 rounded-md border border-outline-variant/20">
                        <span className="material-symbols-outlined text-[14px] text-secondary">
                          location_on
                        </span>
                        <span>
                          {t.rentedFromBranch}: {isEn ? `${rev.branch.name} Branch` : `Cabang ${rev.branch.name}`}
                        </span>
                      </span>
                    </div>

                    {/* Testimonial Quote */}
                    <p className="text-on-surface-variant text-base md:text-lg leading-relaxed italic">
                      “{rev.comment}”
                    </p>
                  </div>

                  {/* Right: Actionable Fleet CTA / Relocation Awareness */}
                  <div className="md:w-80 md:border-l md:border-outline-variant/20 md:pl-8 md:pt-0 pt-6 border-t border-outline-variant/20 md:border-t-0 flex flex-col justify-center shrink-0">
                    {activeUnit && activeUnit.isOriginalUnit ? (
                      /* Skenario A: Unit asli masih aktif di cabang yang sama */
                      <Link
                        href={`/vehicles/${activeUnit.id}`}
                        className="inline-flex items-center justify-between w-full text-sm font-semibold text-secondary hover:text-secondary-fixed bg-secondary/10 hover:bg-secondary/20 px-5 py-3.5 rounded-xl transition-all group"
                        data-testid={`testimonial-cta-vehicle-${rev.id}`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-[18px]">
                            directions_car
                          </span>
                          <span className="truncate">
                            {t.rentNowCTA} {activeUnit.name}
                          </span>
                        </span>
                        <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                          arrow_forward
                        </span>
                      </Link>
                    ) : activeUnit && !activeUnit.isOriginalUnit ? (
                      /* Skenario B: Unit telah dimutasi ke cabang lain (transparan & jujur) */
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-3 py-1.5 rounded-lg">
                          <span className="material-symbols-outlined text-[16px]">
                            swap_horiz
                          </span>
                          <span>
                            {t.nowAtBranchNotice}: {isEn ? `${activeUnit.branchName} Branch` : `Cabang ${activeUnit.branchName}`}
                          </span>
                        </div>
                        <Link
                          href={`/vehicles/${activeUnit.id}`}
                          className="inline-flex items-center justify-between w-full text-sm font-semibold text-secondary hover:text-secondary-fixed bg-secondary/10 hover:bg-secondary/20 px-5 py-3 rounded-xl transition-all group"
                          data-testid={`testimonial-cta-vehicle-${rev.id}`}
                        >
                          <span className="truncate">
                            {t.rentAtNewBranchCTA} {activeUnit.branchName}
                          </span>
                          <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                            arrow_forward
                          </span>
                        </Link>
                      </div>
                    ) : (
                      /* Skenario C: Unit telah pensiun permanen (anti 404 broken link) */
                      <div className="inline-flex items-center gap-2 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 px-4 py-3 rounded-xl w-full">
                        <span className="material-symbols-outlined text-[16px] text-zinc-400">
                          archive
                        </span>
                        <span>{t.archivedFleet}</span>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            )
          })()
        ) : (
          /* Multi-card Grid: Bentang penuh container (2 kolom jika 2 ulasan, 3 kolom jika 3+ ulasan) */
          <div
            className={`grid grid-cols-1 ${
              reviews.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
            } gap-8 w-full`}
          >
            {reviews.map((rev, index) => {
              const activeUnit = activeVehiclesMap.get(rev.vehicleId)
              const maskedName = formatCustomerReviewName(rev.customer.name)

              return (
                <ScrollReveal key={rev.id} delay={Math.min(index * 75, 450)}>
                  <div
                    data-testid={`testimonial-card-${rev.id}`}
                    className="bg-surface-container-low/70 hover:bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 sm:p-7 flex flex-col justify-between h-full transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    {/* Top: Customer & Rating & Historical Rental Branch */}
                    <div>
                      {/* Header: Customer Name & Rating */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-title-md text-base font-bold text-on-surface">
                              {maskedName}
                            </h3>
                            <span
                              className="material-symbols-outlined text-[16px] text-emerald-500"
                              title={t.verifiedRenter}
                            >
                              verified
                            </span>
                          </div>
                          <span className="text-[11px] font-label-caps text-on-surface-variant block uppercase tracking-wider mt-0.5">
                            {t.verifiedRenter}
                          </span>
                        </div>

                        {/* Stars */}
                        <div
                          className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"
                          aria-label={`Rating ${rev.rating} dari 5`}
                        >
                          <span className="material-symbols-outlined text-[16px] text-amber-500 fill-current">
                            star
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {rev.rating}.0
                          </span>
                        </div>
                      </div>

                      {/* Historical Rental Branch (Pembeda Jelas: Cabang tempat rental berlangsung dulu) */}
                      <div className="mb-4">
                        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant font-medium bg-surface-container-high/80 px-2.5 py-1 rounded-md border border-outline-variant/20">
                          <span className="material-symbols-outlined text-[14px] text-secondary">
                            location_on
                          </span>
                          <span>
                            {t.rentedFromBranch}: {isEn ? `${rev.branch.name} Branch` : `Cabang ${rev.branch.name}`}
                          </span>
                        </span>
                      </div>

                      {/* Testimonial Quote */}
                      <p className="text-on-surface-variant text-sm leading-relaxed italic mb-6">
                        “{rev.comment}”
                      </p>
                    </div>

                    {/* Bottom: Actionable Fleet CTA / Relocation Awareness */}
                    <div className="pt-4 border-t border-outline-variant/20 mt-auto">
                      {activeUnit && activeUnit.isOriginalUnit ? (
                        /* Skenario A: Unit asli masih aktif di cabang yang sama */
                        <Link
                          href={`/vehicles/${activeUnit.id}`}
                          className="inline-flex items-center justify-between w-full text-xs font-semibold text-secondary hover:text-secondary-fixed bg-secondary/10 hover:bg-secondary/20 px-3.5 py-2.5 rounded-lg transition-all group"
                          data-testid={`testimonial-cta-vehicle-${rev.id}`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="material-symbols-outlined text-[16px]">
                              directions_car
                            </span>
                            <span className="truncate">
                              {t.rentNowCTA} {activeUnit.name}
                            </span>
                          </span>
                          <span className="material-symbols-outlined text-[16px] transition-transform duration-200 group-hover:translate-x-1">
                            arrow_forward
                          </span>
                        </Link>
                      ) : activeUnit && !activeUnit.isOriginalUnit ? (
                        /* Skenario B: Unit telah dimutasi ke cabang lain (transparan & jujur) */
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 rounded-md">
                            <span className="material-symbols-outlined text-[14px]">
                              swap_horiz
                            </span>
                            <span>
                              {t.nowAtBranchNotice}: {isEn ? `${activeUnit.branchName} Branch` : `Cabang ${activeUnit.branchName}`}
                            </span>
                          </div>
                          <Link
                            href={`/vehicles/${activeUnit.id}`}
                            className="inline-flex items-center justify-between w-full text-xs font-semibold text-secondary hover:text-secondary-fixed bg-secondary/10 hover:bg-secondary/20 px-3.5 py-2 rounded-lg transition-all group"
                            data-testid={`testimonial-cta-vehicle-${rev.id}`}
                          >
                            <span className="truncate">
                              {t.rentAtNewBranchCTA} {activeUnit.branchName}
                            </span>
                            <span className="material-symbols-outlined text-[16px] transition-transform duration-200 group-hover:translate-x-1">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      ) : (
                        /* Skenario C: Unit telah pensiun permanen (anti 404 broken link) */
                        <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 px-3 py-2 rounded-lg w-full">
                          <span className="material-symbols-outlined text-[15px] text-zinc-400">
                            archive
                          </span>
                          <span>{t.archivedFleet}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
