import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { MapPin, Phone, Clock, ArrowRight, Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lokasi & Cabang Operasional | Prestige Motion',
  description: 'Temukan jaringan cabang operasional Prestige Motion di berbagai kota besar Indonesia.'
}

export default async function LocationsPage() {
  const branches = await prisma.branch.findMany({
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-12 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3">
            <Link href="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span className="text-zinc-400">Lokasi Cabang</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            Jaringan Cabang Prestige Motion
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-2xl">
            Layanan penjemputan, pengantaran, dan serah-terima armada premium di lokasi-lokasi strategis kota besar Indonesia.
          </p>
        </div>

        {/* Branches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {branches.map((branch) => (
            <div 
              key={branch.id} 
              className="bg-surface-container-lowest border border-surface-variant/40 hover:border-secondary/50 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Buka Hari Ini
                  </span>
                </div>

                <h3 className="font-headline-md text-xl text-white font-bold mb-1">
                  {branch.name}
                </h3>
                <p className="text-secondary font-medium text-sm mb-4">
                  Kota {branch.city}
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
                  {branch._count.vehicles} Armada Tersedia
                </span>
                <Link
                  href={`/?branch=${branch.id}#vehicles`}
                  className="font-button text-xs font-semibold text-secondary hover:text-white flex items-center gap-1.5 transition-colors group"
                >
                  Lihat Armada <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {branches.length === 0 && (
          <div className="text-center py-20 border border-surface-variant/30 rounded-xl bg-surface-container-lowest max-w-md mx-auto">
            <p className="text-zinc-400">Belum ada data cabang aktif yang tersedia saat ini.</p>
          </div>
        )}

      </main>

      <Footer />
    </div>
  )
}
