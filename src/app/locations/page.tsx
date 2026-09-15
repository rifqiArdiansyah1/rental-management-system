import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { MapPin, Phone, Clock, ArrowRight, Building2 } from 'lucide-react'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lokasi & Cabang Operasional | Prestige Motion',
  description: 'Temukan jaringan cabang operasional Prestige Motion di berbagai kota besar Indonesia.'
}

export default async function LocationsPage() {
  const [locale, branches] = await Promise.all([
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
        <div className="max-w-4xl mx-auto mb-12 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3 animate-hero-kicker">
            <Link href="/" className="hover:underline">{dict.nav.home}</Link>
            <span>/</span>
            <span className="text-zinc-400">{dict.nav.locations}</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4 animate-page-header">
            {dict.locations.title}
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-2xl animate-page-desc">
            {dict.locations.subtitle}
          </p>
        </div>

        {/* Branches Grid with Staggered ScrollReveal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {branches.map((branch, index) => (
            <ScrollReveal key={branch.id} delay={Math.min(index * 75, 450)}>
              <div 
                className="bg-surface-container-lowest border border-surface-variant/40 hover:border-secondary/50 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-secondary/5 group h-full"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {isEn ? 'Open Today' : 'Buka Hari Ini'}
                    </span>
                  </div>

                  <h3 className="font-headline-md text-xl text-white font-bold mb-1 transition-colors group-hover:text-secondary">
                    {branch.name}
                  </h3>
                  <p className="text-secondary font-medium text-sm mb-4">
                    {branch.city}
                  </p>

                  <div className="space-y-3 text-sm text-zinc-300 mb-6">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-300 leading-snug">{branch.address}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <span className="text-zinc-300">{branch.phone}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <span className="text-zinc-400">08:00 – 21:00 WIB</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-variant/30 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {branch._count.vehicles} {dict.locations.activeFleetCount}
                  </span>
                  <Link
                    href={`/?branch=${branch.id}#vehicles`}
                    className="font-button text-xs font-semibold text-secondary hover:text-white flex items-center gap-1.5 transition-colors group"
                  >
                    {dict.locations.viewFleetBtn} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {branches.length === 0 && (
          <div className="text-center py-20 border border-surface-variant/30 rounded-xl bg-surface-container-lowest max-w-md mx-auto">
            <p className="text-zinc-400">
              {isEn ? 'No active branch locations available at this moment.' : 'Belum ada data cabang aktif yang tersedia saat ini.'}
            </p>
          </div>
        )}

      </main>

      <Footer />
    </div>
  )
}
