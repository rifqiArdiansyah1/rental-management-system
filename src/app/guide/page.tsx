import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { 
  Search, 
  CalendarCheck, 
  CreditCard, 
  FileCheck2, 
  KeyRound, 
  Fuel, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  Building2, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Car,
  UserCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import GuideClient, { FaqItem } from '@/components/guide/GuideClient'
import {
  LATE_RETURN_GRACE_MINUTES,
  TURNOVER_BUFFER_HOURS,
  GLOBAL_OPERATING_HOURS,
  MIDTRANS_SNAP_EXPIRY_MINUTES,
  OVERTIME_HOURLY_PERCENTAGE,
  MIN_HOURLY_OVERTIME_RATE,
  EXTREME_LATE_HOURS,
} from '@/lib/constants'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Panduan Sewa & Alur Pelanggan | Prestige Motion',
  description: 'Panduan lengkap pemesanan rental mobil eksekutif, verifikasi KYC wajib dua dokumen, jam operasional, dan kebijakan toleransi keterlambatan resmi.'
}

export default async function GuidePage() {
  const [locale, activeBranches, lowestRateAggregate] = await Promise.all([
    getLocale(),
    prisma.branch.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            vehicles: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { city: 'asc' }
    }),
    prisma.vehicle.aggregate({
      where: { isActive: true },
      _min: { dailyRate: true }
    })
  ])

  const dict = await getDictionary(locale)
  const isEn = locale === 'en'

  const lowestDailyRate = lowestRateAggregate._min.dailyRate ? Number(lowestRateAggregate._min.dailyRate) : null
  const openHoursStr = `${String(GLOBAL_OPERATING_HOURS.OPEN_HOUR).padStart(2, '0')}:00 – ${String(GLOBAL_OPERATING_HOURS.CLOSE_HOUR).padStart(2, '0')}:00 WIB`

  const constantsData = {
    graceMinutes: LATE_RETURN_GRACE_MINUTES,
    overtimePercent: OVERTIME_HOURLY_PERCENTAGE,
    minOvertimeRate: MIN_HOURLY_OVERTIME_RATE,
    extremeHours: EXTREME_LATE_HOURS,
    turnoverHours: TURNOVER_BUFFER_HOURS,
  }

  const faqItems: FaqItem[] = dict.guide.faq.items.map((item) => ({
    category: item.category as any,
    question: item.question,
    answer: item.answer,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-14 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3 animate-hero-kicker">
            <Link href="/" className="hover:underline">{dict.nav.home}</Link>
            <span>/</span>
            <span className="text-zinc-400">{dict.guide.breadcrumb}</span>
          </div>
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary mb-3">
            {dict.guide.kicker}
          </span>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4 animate-page-header">
            {dict.guide.title}
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-3xl animate-page-desc">
            {dict.guide.subtitle}
          </p>

          {/* Quick Policy Badges (Zero Magic-Number-Drift) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-8 pt-6 border-t border-surface-variant/40">
            {/* Badge 1: Grace Period */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                <span>{dict.guide.quickBadges.gracePeriod}</span>
              </span>
              <span className="text-sm md:text-base font-bold text-emerald-400 font-mono">
                {`${LATE_RETURN_GRACE_MINUTES} ${isEn ? 'minutes' : 'menit'}`}
              </span>
            </div>

            {/* Badge 2: Mandatory KYC */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                <span>{dict.guide.quickBadges.kycMandate}</span>
              </span>
              <span className="text-sm md:text-base font-bold text-amber-300">
                {isEn ? 'KTP & SIM Required' : 'KTP & SIM Wajib'}
              </span>
            </div>

            {/* Badge 3: Turnover Buffer */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-secondary" />
                <span>{dict.guide.quickBadges.bufferSanitization}</span>
              </span>
              <span className="text-sm md:text-base font-bold text-on-surface font-mono">
                {`${TURNOVER_BUFFER_HOURS} ${isEn ? 'hours buffer' : 'jam steril'}`}
              </span>
            </div>

            {/* Badge 4: Operating Hours */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-secondary" />
                <span>{dict.guide.quickBadges.operatingHours}</span>
              </span>
              <span className="text-xs md:text-sm font-bold text-on-surface font-mono leading-tight">
                {openHoursStr}
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Stepper 7 Langkah Alur Pelanggan */}
        <ScrollReveal>
          <section className="max-w-4xl mx-auto mb-20 space-y-8">
            <div className="text-center md:text-left mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-on-surface">
                {dict.guide.stepperTitle}
              </h2>
              <p className="text-sm md:text-base text-on-surface-variant mt-2 max-w-2xl">
                {dict.guide.stepperSubtitle}
              </p>
            </div>

            {/* Stepper Cards */}
            <div className="space-y-6">
              {/* Step 1: Cari & Pilih Armada */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step1.number}
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center gap-2">
                      <Search className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step1.title}
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step1.desc}
                    </p>

                    {/* Dua Model Sewa Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                      <div className="bg-surface-container-low/80 border border-surface-variant/40 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-secondary mb-1">
                          <Car className="w-4 h-4 text-secondary" />
                          <span>{dict.guide.steps.step1.selfDriveTitle}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {dict.guide.steps.step1.selfDriveDesc}
                        </p>
                      </div>

                      <div className="bg-surface-container-low/80 border border-secondary/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-secondary mb-1">
                          <UserCheck className="w-4 h-4 text-secondary" />
                          <span>{dict.guide.steps.step1.withDriverTitle}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {dict.guide.steps.step1.withDriverDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Tentukan Jadwal & Cek Ketersediaan */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step2.number}
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step2.title}
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step2.desc}
                    </p>

                    <div className="p-3.5 bg-surface-container-low/90 border border-surface-variant/40 rounded-xl text-xs text-on-surface-variant space-y-2">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>{isEn ? 'Operating Hours Notice:' : 'Jam Operasional Layanan:'}</strong> {openHoursStr}. {isEn ? 'Pickups and returns outside this window are restricted.' : 'Penjemputan dan pengembalian unit tidak dilayani di luar jam ini.'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>{isEn ? 'Mandatory Turnaround Buffer:' : 'Buffer Proteksi Kebersihan:'}</strong> {dict.guide.steps.step2.bufferNotice}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>
                          {dict.guide.steps.step2.rateTransparency}
                          {lowestDailyRate 
                            ? ` (${isEn ? 'starting from IDR' : 'mulai dari Rp'} ${lowestDailyRate.toLocaleString('id-ID')}/${isEn ? 'day' : 'hari'}).` 
                            : '.'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Pembayaran Instan via Midtrans */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step3.number}
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step3.title}
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step3.desc}
                    </p>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-300 flex-shrink-0" />
                      <span>
                        <strong>{isEn ? 'Payment Window:' : 'Batas Waktu Bayar:'}</strong> {MIDTRANS_SNAP_EXPIRY_MINUTES} {isEn ? 'minutes' : 'menit'}. {dict.guide.steps.step3.expiryNotice}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Lengkapi Dokumen Verifikasi (KYC) - CRITICAL STEP */}
              <div className="bg-surface-container-lowest border-2 border-secondary/60 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-secondary/5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base">
                    {dict.guide.steps.step4.number}
                  </div>
                  <div className="space-y-4 flex-grow">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step4.title}
                      </h3>
                    </div>

                    {/* Callout Penting KTP & SIM Wajib */}
                    <div 
                      className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs md:text-sm leading-relaxed space-y-2"
                      data-testid="kyc-mandate-banner"
                    >
                      <div className="flex items-center gap-2 font-bold text-amber-300 text-sm md:text-base">
                        <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0" />
                        <span>{dict.guide.steps.step4.kycAlertTitle}</span>
                      </div>
                      <p>
                        {dict.guide.steps.step4.kycAlertDesc}
                      </p>
                    </div>

                    {/* Mengapa sewa dengan sopir tetap wajib SIM? */}
                    <div className="p-4 rounded-xl bg-surface-container-low border border-surface-variant/40 text-xs text-on-surface-variant space-y-1.5">
                      <p className="font-semibold text-secondary">
                        {dict.guide.steps.step4.whyBothTitle}
                      </p>
                      <p className="leading-relaxed">
                        {dict.guide.steps.step4.whyBothDesc}
                      </p>
                    </div>

                    <p className="text-xs text-zinc-400 italic">
                      💡 {dict.guide.steps.step4.photoTips}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 5: Pengambilan Armada di Cabang (Handover) */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step5.number}
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step5.title}
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step5.desc}
                    </p>
                    <div className="p-3.5 bg-surface-container-low border border-surface-variant/40 rounded-xl text-xs text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step5.physicalCheck}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 6: Selama Perjalanan & Bantuan Operasional */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step6.number}
                  </div>
                  <div className="space-y-4 flex-grow">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step6.title}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="bg-surface-container-low border border-surface-variant/40 rounded-xl p-4 space-y-1.5">
                        <p className="text-xs font-bold text-secondary flex items-center gap-1.5">
                          <Fuel className="w-3.5 h-3.5 text-secondary" />
                          <span>{dict.guide.steps.step6.fuelPolicyTitle}</span>
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {dict.guide.steps.step6.fuelPolicyDesc}
                        </p>
                      </div>

                      <div className="bg-surface-container-low border border-surface-variant/40 rounded-xl p-4 space-y-1.5">
                        <p className="text-xs font-bold text-secondary flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-secondary" />
                          <span>{dict.guide.steps.step6.incidentTitle}</span>
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {dict.guide.steps.step6.incidentDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 7: Pengembalian Armada & Selesai */}
              <div className="bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 transition-all duration-300 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary font-mono font-bold flex items-center justify-center flex-shrink-0 text-base border border-secondary/30">
                    {dict.guide.steps.step7.number}
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-secondary" />
                      <h3 className="text-lg md:text-xl font-bold text-on-surface">
                        {dict.guide.steps.step7.title}
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {dict.guide.steps.step7.desc}
                    </p>

                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs space-y-1 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>{isEn ? `Official ${LATE_RETURN_GRACE_MINUTES}-Minute Grace Period` : `Masa Tenggang Resmi ${LATE_RETURN_GRACE_MINUTES} Menit`}</span>
                      </div>
                      <p className="text-zinc-300">
                        {dict.guide.steps.step7.graceSummary} {dict.guide.steps.step7.inspectionEnd}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Section 2: Overtime Breakdown & FAQ via Client Component */}
        <ScrollReveal>
          <div className="max-w-4xl mx-auto mb-20">
            <GuideClient
              faqItems={faqItems}
              categories={dict.guide.faq.categories}
              allTabLabel={dict.guide.faq.allTab}
              overtimeDict={dict.guide.overtime}
              constantsData={constantsData}
              locale={locale}
            />
          </div>
        </ScrollReveal>

        {/* Section 3: Cabang Operasional Resmi (Dinamis dari Database) */}
        <ScrollReveal>
          <section className="max-w-4xl mx-auto mb-20 bg-surface-container-lowest border border-surface-variant/40 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl mb-2">
              <Building2 className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface font-bold">
                {dict.guide.branchesTitle}
              </h2>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mb-6">
              {dict.guide.branchesSubtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" data-testid="branches-list">
              {activeBranches.map((branch) => (
                <div 
                  key={branch.id} 
                  className="p-4 rounded-xl bg-surface-container-low border border-surface-variant/30 hover:border-secondary/40 transition-colors"
                >
                  <p className="text-xs font-label-caps text-secondary font-bold uppercase tracking-wider mb-1">
                    {branch.city}
                  </p>
                  <h4 className="text-sm font-bold text-on-surface mb-1">
                    {branch.name}
                  </h4>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                    {branch.address}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-surface-variant/20 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{branch._count.vehicles} {isEn ? 'vehicles' : 'armada'}</span>
                    <span className="font-mono">{branch.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Section 4: Call to Action */}
        <ScrollReveal>
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-surface-container-high/90 to-surface-container-low/70 border border-secondary/30 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold text-on-surface mb-3">
              {dict.guide.ctaTitle}
            </h2>
            <p className="text-sm md:text-base text-on-surface-variant max-w-xl mx-auto mb-8 leading-relaxed">
              {dict.guide.ctaSubtitle}
            </p>
            <Link
              href="/#vehicles"
              className="btn-primary inline-flex items-center gap-2 bg-secondary text-on-secondary px-8 py-3.5 rounded-xl font-semibold text-sm hover:bg-secondary-fixed transition-all duration-200"
            >
              <span>{dict.guide.ctaButton}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>
      </main>

      <Footer />
    </div>
  )
}
