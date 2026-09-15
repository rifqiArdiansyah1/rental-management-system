import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { 
  Building2, 
  Clock, 
  Sparkles, 
  CircleDollarSign, 
  Lock, 
  Car, 
  UserCheck, 
  MapPin, 
  ArrowRight 
} from 'lucide-react'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tentang Kami | Prestige Motion',
  description: 'Profil resmi, legalitas badan usaha, dan standar keunggulan layanan rental mobil premium Prestige Motion.'
}

export default async function AboutPage() {
  const [locale, activeBranches] = await Promise.all([
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
    })
  ])

  const dict = await getDictionary(locale)
  const isEn = locale === 'en'

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-16 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3 animate-hero-kicker">
            <Link href="/" className="hover:underline">{dict.nav.home}</Link>
            <span>/</span>
            <span className="text-zinc-400">{dict.nav.about}</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4 animate-page-header">
            {isEn ? 'Redefining Executive Mobility' : 'Mendefinisikan Ulang Mobilitas Premium'}
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-3xl animate-page-desc">
            {isEn
              ? 'Prestige Motion delivers executive mobility solutions powered by modern infrastructure, adhering to rigorous vehicle maintenance, rate transparency, and verified regulatory compliance.'
              : 'Prestige Motion menghadirkan layanan rental kendaraan kelas atas berbasis teknologi modern, dengan komitmen pada kenyamanan perjalanan, kebersihan armada, transparansi tarif, dan kepatuhan hukum yang solid.'}
          </p>
        </div>

        {/* Section 1: Profil Resmi & Legalitas Badan Usaha */}
        <ScrollReveal>
          <section className="max-w-5xl mx-auto mb-16 bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-8 md:p-10 hover:border-secondary/30 transition-colors duration-300">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl mb-4">
              <Building2 className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? 'Corporate Profile & Legal Registration' : 'Profil & Identitas Badan Usaha'}
              </h2>
            </div>
            <p className="font-body-md text-on-surface-variant text-sm md:text-base leading-relaxed mb-6">
              {dict.about.legalDesc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-surface-variant/40">
              <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30 hover:border-secondary/40 transition-all duration-300">
                <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                  {isEn ? 'Incorporated Entity' : 'Badan Usaha Resmi'}
                </p>
                <p className="text-base text-white font-bold">
                  {dict.about.legalEntityName}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {isEn ? 'Licensed Transportation & Executive Rental Services' : 'Penyedia Jasa Transportasi & Rental Mobil'}
                </p>
              </div>

              <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30 hover:border-secondary/40 transition-all duration-300">
                <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                  {isEn ? 'Service Scope' : 'Kategori Layanan'}
                </p>
                <p className="text-base text-white font-bold">
                  {isEn ? 'Premium Fleet & Chauffeur' : 'Rental Premium & Sopir'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {isEn ? 'Autonomous Driving & Executive Chauffeur Services' : 'Lepas Kunci & Layanan Pengemudi Eksekutif'}
                </p>
              </div>

              <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30 hover:border-secondary/40 transition-all duration-300">
                <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                  {isEn ? 'Regulatory Adherence' : 'Kepatuhan Regulasi'}
                </p>
                <p className="text-base text-white font-bold">
                  {isEn ? 'Licensed & Protected' : 'Berlisensi & Terproteksi'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {isEn ? 'Tax Compliant & Data Protection Standard (UU PDP)' : 'Kepatuhan Pajak & Perlindungan Konsumen UU PDP'}
                </p>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Section 2: 4 Pilar Standar Keunggulan Layanan */}
        <section className="max-w-5xl mx-auto mb-16">
          <ScrollReveal>
            <div className="text-center md:text-left mb-8">
              <h2 className="font-headline-lg text-2xl md:text-3xl text-white font-bold mb-2">
                {dict.about.fourPillarsTitle}
              </h2>
              <p className="font-body-md text-sm md:text-base text-on-surface-variant">
                {isEn
                  ? 'Strict operational benchmarks reinforced by robust digital systems at each stage of your rental.'
                  : 'Standar operasional ketat yang didukung sistem teknologi andal di setiap tahapan penyewaan.'}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pilar 1 */}
            <ScrollReveal delay={0}>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group h-full">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1 transition-colors group-hover:text-secondary">
                    {isEn ? '24/7 Digital Reservations' : 'Pemesanan Online 24/7'}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    {isEn
                      ? 'Check real-time fleet schedules and reserve instantly without time-consuming manual forms.'
                      : 'Cek ketersediaan jadwal secara real-time dan lakukan booking kapan saja secara instan tanpa proses formulir manual yang memakan waktu.'}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            {/* Pilar 2 */}
            <ScrollReveal delay={100}>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group h-full">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1 transition-colors group-hover:text-secondary">
                    {dict.about.pillar1Title}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    {dict.about.pillar1Desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            {/* Pilar 3 */}
            <ScrollReveal delay={200}>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group h-full">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                  <CircleDollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1 transition-colors group-hover:text-secondary">
                    {dict.about.pillar3Title}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    {dict.about.pillar3Desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            {/* Pilar 4 */}
            <ScrollReveal delay={300}>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group h-full">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1 transition-colors group-hover:text-secondary">
                    {dict.about.pillar2Title}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    {dict.about.pillar2Desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 3: Pilihan Skema Sewa Fleksibel */}
        <ScrollReveal>
          <section className="max-w-5xl mx-auto mb-16 bg-surface-container-low/40 border border-surface-variant/40 rounded-2xl p-8 md:p-10">
            <h2 className="font-headline-lg text-xl md:text-2xl text-white font-bold mb-6 text-center md:text-left">
              {isEn ? 'Bespoke Mobility Options' : 'Fleksibilitas Pilihan Layanan'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container-lowest border border-surface-variant/40 hover:border-secondary/50 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 group">
                <div className="flex items-center gap-3 mb-3">
                  <Car className="w-6 h-6 text-secondary transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-secondary">
                    {dict.booking.selfDrive}
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed mb-4">
                  {dict.booking.selfDriveDesc}
                </p>
                <Link 
                  href="/#vehicles" 
                  className="text-xs font-semibold text-secondary hover:text-white inline-flex items-center gap-1 group"
                >
                  {isEn ? 'Explore Self-Drive Fleet' : 'Cari Mobil Lepas Kunci'} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </Link>
              </div>

              <div className="bg-surface-container-lowest border border-surface-variant/40 hover:border-secondary/50 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 group">
                <div className="flex items-center gap-3 mb-3">
                  <UserCheck className="w-6 h-6 text-secondary transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-secondary">
                    {dict.booking.withDriver}
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed mb-4">
                  {dict.booking.withDriverDesc}
                </p>
                <Link 
                  href="/#vehicles" 
                  className="text-xs font-semibold text-secondary hover:text-white inline-flex items-center gap-1 group"
                >
                  {isEn ? 'Explore Chauffeur Fleet' : 'Cari Mobil dengan Sopir'} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </Link>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Section 4: Jaringan Cabang Aktif */}
        <ScrollReveal>
          <section className="max-w-5xl mx-auto mb-16">
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-2xl p-8 md:p-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 text-secondary font-semibold text-base mb-1">
                    <MapPin className="w-5 h-5 text-secondary" />
                    <span>{isEn ? 'Active Service Network' : 'Jangkauan Operasional Aktif'}</span>
                  </div>
                  <h2 className="font-headline-lg text-xl md:text-2xl text-white font-bold">
                    {isEn ? 'Present in Prime Metropolitan Hubs' : 'Hadir di Kota-Kota Strategis'}
                  </h2>
                </div>
                <Link 
                  href="/locations" 
                  className="btn-secondary text-xs font-semibold text-secondary border border-secondary/50 px-4 py-2 rounded hover:bg-secondary hover:text-background transition-colors inline-flex items-center gap-1.5 group"
                >
                  {isEn ? 'View All Locations' : 'Lihat Detail Semua Cabang'} <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
              </div>

              {activeBranches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeBranches.map(branch => (
                    <div key={branch.id} className="bg-surface-container-low/50 border border-surface-variant/30 hover:border-secondary/40 rounded-lg p-4 transition-all duration-300 hover:-translate-y-0.5">
                      <p className="text-white font-semibold text-sm">{branch.name}</p>
                      <p className="text-xs text-secondary font-medium mt-0.5">{isEn ? branch.city : `Kota ${branch.city}`}</p>
                      <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full inline-block ${branch._count.vehicles > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                        {branch._count.vehicles > 0 
                          ? `${branch._count.vehicles} ${isEn ? 'units ready' : 'armada siap jalan'}` 
                          : isEn ? 'Currently on duty' : 'Armada sedang bertugas'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  {isEn
                    ? 'Our service network continuously expands to support your luxury executive mobility across Indonesia.'
                    : 'Jaringan cabang kami terus berkembang untuk menjangkau kebutuhan mobilitas Anda di berbagai kota.'}
                </p>
              )}
            </div>
          </section>
        </ScrollReveal>

        {/* Section 5: Call To Action (CTA) */}
        <ScrollReveal>
          <section className="max-w-5xl mx-auto text-center bg-gradient-to-r from-surface-container-low via-surface-container-lowest to-surface-container-low border border-surface-variant/50 rounded-2xl p-10 md:p-12">
            <h2 className="font-display-lg text-2xl md:text-4xl text-white font-bold mb-4">
              {isEn ? 'Ready for an Exceptional Journey?' : 'Siap Menikmati Perjalanan Istimewa?'}
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
              {isEn
                ? 'Select your preferred flagship vehicle now and experience effortless premium car rental.'
                : 'Temukan kendaraan idaman Anda sekarang dan nikmati pengalaman sewa mobil premium tanpa ribet.'}
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link 
                href="/#vehicles" 
                className="btn-primary shimmer-btn group bg-secondary text-on-secondary font-button text-sm font-semibold px-8 py-3.5 rounded-DEFAULT inline-flex items-center gap-2 hover:bg-secondary-fixed transition-all"
              >
                {isEn ? 'Choose Fleet Now' : 'Pilih Armada Sekarang'} <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link 
                href="/contact" 
                className="font-button text-sm font-semibold text-zinc-300 border border-zinc-700 px-6 py-3.5 rounded-DEFAULT hover:border-zinc-400 hover:text-white transition-colors"
              >
                {dict.nav.contact}
              </Link>
            </div>
          </section>
        </ScrollReveal>

      </main>

      <Footer />
    </div>
  )
}
