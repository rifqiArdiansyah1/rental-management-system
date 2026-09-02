import Link from 'next/link'
import FilterBar from '@/components/ui/FilterBar'
import VehicleCard from '@/components/ui/VehicleCard'
import { getVehicles, getBranches, getCategories } from '@/actions/vehicle'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const branchId = typeof resolvedSearchParams.branch === 'string' ? resolvedSearchParams.branch : undefined
  const categoryId = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [vehicles, branches, categories] = await Promise.all([
    getVehicles({ branchId, categoryId }),
    getBranches(),
    getCategories()
  ])

  return (
    <div className="flex-grow flex flex-col min-h-screen">
      {/* TopNavBar Component */}
      <Navbar />

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full h-[614px] min-h-[500px] flex items-center justify-start overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0 hero-bg">
            <div 
              className="w-full h-full bg-cover bg-center opacity-60 mix-blend-overlay" 
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBga3N00tvVjnWRBlNFMhx5PdAQdb2qcibWhp0IUmG0_gyHmehwI_HoSkUKJD6pAJoJDIYXRBnYdrSNnYgG1Z80P1z0MB313r4fA0lSYJdC445j0n6Dc1YCApFNibsLTNY1YK1c1WuASQOB_0cvSwSmUCabPFlwFLICbo01mlIUHemSJs5O7ZtlLAK8NWjhSDLnVQ1Qi1hdM5fBHHejtkm2CrGgRE7-ZXHbrIPvDTU2WCFZCfHeYql5')" }}
            ></div>
          </div>
          
          {/* Hero Content */}
          <div className="relative z-10 w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
            <div className="max-w-2xl">
              <span className="font-label-caps text-xs text-secondary mb-4 block tracking-widest uppercase font-semibold">
                Koleksi Armada Eksklusif
              </span>
              <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6 drop-shadow-md">
                Kenyamanan & Kemewahan Perjalanan Terbaik
              </h1>
              <p className="font-body-lg text-base md:text-lg text-on-surface-variant mb-10 max-w-lg leading-relaxed">
                Solusi mobilitas premium dengan standar inspeksi ketat, reservasi online instan, serta perlindungan privasi dokumen untuk perjalanan bisnis maupun personal Anda.
              </p>
              <a 
                href="#vehicles" 
                className="btn-primary bg-secondary text-on-secondary font-button text-sm font-semibold px-8 py-4 rounded-DEFAULT inline-flex items-center gap-2 cursor-pointer hover:bg-secondary-fixed transition-colors"
              >
                Jelajahi Armada <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
            </div>
          </div>
        </section>

        {/* FilterBar Section */}
        <FilterBar branches={branches} categories={categories} />

        {/* Vehicle Grid Section */}
        <section id="vehicles" className="w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-20 scroll-mt-20">
          <div className="flex justify-between items-end mb-12 border-b border-surface-variant pb-4">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Pilihan Armada</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">Armada terawat yang siap digunakan untuk perjalanan Anda.</p>
            </div>
          </div>
          
          {/* Bento-style Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((vehicle: any, index: number) => (
              <VehicleCard 
                key={vehicle.id} 
                vehicle={vehicle} 
                isPopular={index === 1}
              />
            ))}
          </div>

          {vehicles.length === 0 && (
            <div className="text-center py-20 border border-outline-variant/20 rounded-xl bg-surface-container-low">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-4 block">no_crash</span>
              <h3 className="text-headline-md text-on-surface mb-2">Kendaraan Tidak Ditemukan</h3>
              <p className="text-on-surface-variant">Coba sesuaikan filter cabang atau kategori untuk melihat hasil lainnya.</p>
            </div>
          )}
        </section>

        {/* Value Proposition / 3-Pillar Banner */}
        <section className="w-full bg-surface-container-lowest border-y border-surface-variant/40 py-16 mt-auto">
          <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
            <div className="flex flex-col items-center px-4">
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                <span className="material-symbols-outlined text-[28px]">diamond</span>
              </div>
              <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">Armada Terawat & Bersih</h4>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                Setiap unit melalui inspeksi berkala serta jeda pembersihan dan pengecekan menyeluruh 3 jam sebelum diserahkan.
              </p>
            </div>
            
            <div className="flex flex-col items-center px-4">
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                <span className="material-symbols-outlined text-[28px]">schedule</span>
              </div>
              <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">Reservasi Online 24/7</h4>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                Pemesanan online aktif 24 jam dengan layanan pelanggan responsif selama jam operasional cabang (08:00–21:00 WIB).
              </p>
            </div>
            
            <div className="flex flex-col items-center px-4">
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                <span className="material-symbols-outlined text-[28px]">lock</span>
              </div>
              <h4 className="font-headline-md text-lg text-on-surface mb-2 font-semibold">Privasi Terlindungi Ketat</h4>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                Dokumen identitas (KTP/SIM) dan riwayat sewa Anda diamankan sesuai standar UU PDP dengan kontrol akses berjenjang.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Reusable Footer Component */}
      <Footer />
    </div>
  )
}
