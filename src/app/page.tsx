import Link from 'next/link'
import FilterBar from '@/components/ui/FilterBar'
import VehicleCard from '@/components/ui/VehicleCard'
import { getVehicles, getBranches, getCategories } from '@/actions/vehicle'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createClient } from '@/utils/supabase/server'
import ScrollReveal from '@/components/ui/ScrollReveal'
import HeroAmbientController from '@/components/ui/HeroAmbientController'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const branchId = typeof resolvedSearchParams.branch === 'string' ? resolvedSearchParams.branch : undefined
  const categoryId = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : undefined

  const [supabase, locale] = await Promise.all([
    createClient(),
    getLocale(),
  ])

  const [authResponse, dict, vehicles, branches, categories] = await Promise.all([
    supabase.auth.getUser(),
    getDictionary(locale),
    getVehicles({ branchId, categoryId }),
    getBranches(),
    getCategories()
  ])

  const isEn = locale === 'en'

  return (
    <div className="flex-grow flex flex-col min-h-screen">
      {/* TopNavBar Component */}
      <Navbar />

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <HeroAmbientController id="hero-section" className="relative w-full min-h-[560px] md:h-[640px] flex items-center justify-start overflow-hidden">
          {/* Background Image with Permanent High-Contrast Multi-Stop Gradients */}
          <div className="absolute inset-0 z-0 hero-bg">
            <div
              className="w-full h-full bg-cover bg-center opacity-60 mix-blend-overlay"
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBga3N00tvVjnWRBlNFMhx5PdAQdb2qcibWhp0IUmG0_gyHmehwI_HoSkUKJD6pAJoJDIYXRBnYdrSNnYgG1Z80P1z0MB313r4fA0lSYJdC445j0n6Dc1YCApFNibsLTNY1YK1c1WuASQOB_0cvSwSmUCabPFlwFLICbo01mlIUHemSJs5O7ZtlLAK8NWjhSDLnVQ1Qi1hdM5fBHHejtkm2CrGgRE7-ZXHbrIPvDTU2WCFZCfHeYql5')" }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30"></div>
          </div>

          {/* Ambient Glow Beam (GPU Composited, Zero Repaint) */}
          <div 
            aria-hidden="true" 
            className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-secondary/15 via-primary-container/20 to-transparent blur-3xl animate-ambient-glow" 
          />

          {/* Hero Content */}
          <div className="relative z-10 w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-12">
            <div className="max-w-2xl">
              <span className="font-label-caps text-xs text-secondary mb-4 block tracking-widest uppercase font-semibold animate-hero-kicker">
                {dict.home.hero.kicker}
              </span>
              <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6 drop-shadow-md animate-hero-title">
                {dict.home.hero.title}
              </h1>
              <p className="font-body-lg text-base md:text-lg text-on-surface-variant mb-8 max-w-lg leading-relaxed animate-hero-desc">
                {dict.home.hero.subtitle}
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mb-8 animate-hero-cta">
                <a
                  href="#vehicles"
                  className="btn-primary shimmer-btn group bg-secondary text-on-secondary font-button text-sm font-semibold px-8 py-4 rounded-DEFAULT inline-flex items-center gap-2 cursor-pointer hover:bg-secondary-fixed transition-all"
                >
                  {dict.home.hero.ctaFleet}
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1.5">
                    arrow_forward
                  </span>
                </a>
              </div>

              {/* Factual Trust Badges */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-surface-variant/30 animate-hero-badges">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high/80 border border-outline-variant/30 text-xs text-on-surface-variant font-label-caps">
                  <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                  <span>{dict.home.trust.inspection}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high/80 border border-outline-variant/30 text-xs text-on-surface-variant font-label-caps">
                  <span className="material-symbols-outlined text-[15px] text-secondary">bolt</span>
                  <span>{dict.home.trust.instantConfirm}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high/80 border border-outline-variant/30 text-xs text-on-surface-variant font-label-caps">
                  <span className="material-symbols-outlined text-[15px] text-secondary">shield</span>
                  <span>{dict.home.trust.privacyLaw}</span>
                </div>
              </div>
            </div>
          </div>
        </HeroAmbientController>

        {/* FilterBar Section */}
        <FilterBar branches={branches} categories={categories} />

        {/* Vehicle Grid Section */}
        <section id="vehicles" className="w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-20 scroll-mt-20">
          <ScrollReveal>
            <div className="flex justify-between items-end mb-12 border-b border-surface-variant pb-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {isEn ? 'Executive Fleet Collection' : 'Pilihan Armada'}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                  {isEn ? 'Meticulously maintained fleet ready for your bespoke itinerary.' : 'Armada terawat yang siap digunakan untuk perjalanan Anda.'}
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Bento-style Grid with Staggered ScrollReveal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((vehicle: any, index: number) => (
              <ScrollReveal key={vehicle.id} delay={Math.min(index * 75, 450)}>
                <VehicleCard
                  vehicle={vehicle}
                  isPopular={index === 1}
                  locale={locale}
                />
              </ScrollReveal>
            ))}
          </div>

          {vehicles.length === 0 && (
            <ScrollReveal>
              <div className="text-center py-20 border border-outline-variant/20 rounded-xl bg-surface-container-low">
                <span className="material-symbols-outlined text-[48px] text-surface-variant mb-4 block">no_crash</span>
                <h3 className="text-headline-md text-on-surface mb-2">{dict.home.filter.noResultsTitle}</h3>
                <p className="text-on-surface-variant">{dict.home.filter.noResultsDesc}</p>
              </div>
            </ScrollReveal>
          )}
        </section>

        {/* Value Proposition / 3-Pillar Banner */}
        <section className="w-full bg-surface-container-lowest border-y border-surface-variant/40 py-20 mt-auto">
          <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
            {/* Section Header Hook */}
            <ScrollReveal>
              <div className="max-w-2xl mx-auto text-center mb-14">
                <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-3">
                  {isEn ? 'Why Choose Us' : 'Alasan Memilih Kami'}
                </span>
                <h2 className="font-display-lg text-2xl md:text-3xl lg:text-4xl text-on-surface font-bold tracking-tight mb-4">
                  {dict.home.pillars.title}
                </h2>
                <p className="font-body-md text-sm md:text-base text-on-surface-variant leading-relaxed">
                  {dict.home.pillars.subtitle}
                </p>
              </div>
            </ScrollReveal>

            {/* 3 Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
              <ScrollReveal delay={0}>
                <div className="flex flex-col items-center px-4 group">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                    <span className="material-symbols-outlined text-[28px]">diamond</span>
                  </div>
                  <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">
                    {dict.home.pillars.fleetTitle}
                  </h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    {dict.home.pillars.fleetDesc}
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={150}>
                <div className="flex flex-col items-center px-4 group">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                    <span className="material-symbols-outlined text-[28px]">schedule</span>
                  </div>
                  <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">
                    {dict.home.pillars.driverTitle}
                  </h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    {dict.home.pillars.driverDesc}
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={300}>
                <div className="flex flex-col items-center px-4 group">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                    <span className="material-symbols-outlined text-[28px]">lock</span>
                  </div>
                  <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">
                    {dict.home.pillars.digitalTitle}
                  </h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    {dict.home.pillars.digitalDesc}
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      {/* Reusable Footer Component */}
      <Footer />
    </div>
  )
}
