import Link from 'next/link'
import FilterBar from '@/components/ui/FilterBar'
import VehicleCard from '@/components/ui/VehicleCard'
import { getVehicles, getBranches, getCategories } from '@/actions/vehicle'
import Navbar from '@/components/Navbar'

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
    <div className="flex-grow flex flex-col">
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
              <span className="font-label-caps text-label-caps text-secondary mb-4 block tracking-widest uppercase">The Premier Collection</span>
              <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6 drop-shadow-md">
                Exclusive Car Collection
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-lg leading-relaxed">
                Experience the pinnacle of automotive engineering and uncompromising luxury. Curated for those who demand excellence in every journey.
              </p>
              <button className="btn-primary bg-secondary text-on-secondary font-button text-button px-8 py-4 rounded-DEFAULT inline-flex items-center gap-2 cursor-pointer">
                Explore Fleet <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* FilterBar Section */}
        <FilterBar branches={branches} categories={categories} />

        {/* Vehicle Grid Section */}
        <section className="w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-20">
          <div className="flex justify-between items-end mb-12 border-b border-surface-variant pb-4">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Available Fleet</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">Showing meticulously maintained vehicles ready for dispatch.</p>
            </div>
            <div className="hidden md:flex gap-4">
              <button className="text-secondary hover:text-secondary transition-colors"><span className="material-symbols-outlined">grid_view</span></button>
              <button className="text-surface-variant hover:text-on-surface-variant transition-colors"><span className="material-symbols-outlined">view_list</span></button>
            </div>
          </div>
          
          {/* Bento-style Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((vehicle: any, index: number) => (
              <VehicleCard 
                key={vehicle.id} 
                vehicle={vehicle} 
                isPopular={index === 1} // Arbitrary condition for demo to make the 2nd card popular
              />
            ))}
          </div>

          {vehicles.length === 0 && (
            <div className="text-center py-20 border border-outline-variant/20 rounded-xl bg-surface-container-low">
              <span className="material-symbols-outlined text-[48px] text-surface-variant mb-4 block">no_crash</span>
              <h3 className="text-headline-md text-on-surface mb-2">No Vehicles Found</h3>
              <p className="text-on-surface-variant">Try adjusting your filters to see more results.</p>
            </div>
          )}
          
          <div className="mt-16 flex justify-center">
            <button className="border-b border-secondary text-secondary font-label-caps text-label-caps tracking-widest uppercase pb-1 hover:text-white hover:border-white transition-colors cursor-pointer">
              View Entire Collection
            </button>
          </div>
        </section>

        {/* Value Proposition / Banner */}
        <section className="w-full bg-surface-container-lowest border-y border-surface-variant py-16 mt-auto">
          <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-secondary mb-4">diamond</span>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-2">Immaculate Fleet</h4>
              <p className="font-body-md text-body-md text-on-surface-variant">Every vehicle detailed to perfection before delivery.</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-secondary mb-4">support_agent</span>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-2">24/7 Concierge</h4>
              <p className="font-body-md text-body-md text-on-surface-variant">Dedicated support for our discerning clients, anytime.</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-secondary mb-4">verified_user</span>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-2">Absolute Discretion</h4>
              <p className="font-body-md text-body-md text-on-surface-variant">Privacy and security guaranteed throughout your journey.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest dark:bg-surface-container-lowest w-full pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1 mb-8 md:mb-0">
            <div className="font-display-lg text-headline-md text-secondary mb-4">
              Prestige Motion
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Redefining mobility for the modern elite.
            </p>
          </div>
          {/* Links Columns */}
          <div className="col-span-1">
            <ul className="flex flex-col gap-4 font-body-md text-body-md">
              <li><span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">Locations</span></li>
              <li><span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">Categories</span></li>
            </ul>
          </div>
          <div className="col-span-1">
            <ul className="flex flex-col gap-4 font-body-md text-body-md">
              <li><span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">Contact</span></li>
              <li><span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">Terms</span></li>
            </ul>
          </div>
          <div className="col-span-1">
            <ul className="flex flex-col gap-4 font-body-md text-body-md">
              <li><span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">Privacy</span></li>
            </ul>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto border-t border-surface-variant pt-8 text-center md:text-left">
          <p className="font-body-md text-body-md text-on-surface-variant text-sm">
            © 2026 Prestige Motion. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
