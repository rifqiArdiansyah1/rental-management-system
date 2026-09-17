import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getVehicleById } from '@/actions/vehicle'
import { getFuelPrices } from '@/actions/fuelPrice'
import FuelCostEstimator from '@/components/vehicle/FuelCostEstimator'
import { FUEL_TYPE_LABELS } from '@/lib/constants'
import { FuelType } from '@prisma/client'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ScrollReveal from '@/components/ui/ScrollReveal'
import VehicleReviewsSection from '@/components/vehicle/VehicleReviewsSection'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { formatCurrency, formatDateTime } from '@/lib/i18n/formatters'

export const dynamic = 'force-dynamic'

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [locale, vehicle, fuelPrices] = await Promise.all([
    getLocale(),
    getVehicleById(resolvedParams.id),
    getFuelPrices(),
  ])

  if (!vehicle) {
    notFound()
  }

  const dict = await getDictionary(locale)
  const isEn = locale === 'en'

  const fuelPricePerLiter = fuelPrices.find(p => p.fuelType === vehicle.fuelType)?.pricePerLiter || 10_000

  const { category } = vehicle
  const vehicleName = vehicle.name || `${category.name} (${vehicle.plateNumber})`
  const photos: string[] = (vehicle.photos && vehicle.photos.length > 0) 
    ? vehicle.photos 
    : (category.imageUrl ? [category.imageUrl] : ['https://via.placeholder.com/1200x800?text=Vehicle'])
  
  const heroImage = photos[0]

  // Parse features
  let features: string[] = []
  try {
    if (category.features) {
      if (Array.isArray(category.features)) {
        features = category.features as string[]
      } else if (typeof category.features === 'string') {
        features = JSON.parse(category.features)
      }
    }
  } catch (e) {
    console.error('Failed to parse features')
  }

  const featureIcons = [
    { name: 'Panoramic Sunroof', icon: 'light_mode' },
    { name: 'Leather Seats', icon: 'airline_seat_recline_extra' },
    { name: 'Audio System', icon: 'speaker' },
    { name: 'Navigation', icon: 'explore' },
    { name: 'AC', icon: 'ac_unit' },
    { name: 'Bluetooth', icon: 'bluetooth' },
    { name: 'Rear Camera', icon: 'camera_rear' },
    { name: 'Sport Chrono', icon: 'timer' },
    { name: 'AWD', icon: '4x4' }
  ]

  const getFeatureIcon = (feat: string) => {
    const f = featureIcons.find(x => feat.toLowerCase().includes(x.name.toLowerCase()))
    return f ? f.icon : 'check_circle'
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full h-[614px] md:h-[768px] flex items-end">
          <div className="absolute inset-0 z-0">
            <img 
              className="w-full h-full object-cover object-center" 
              src={heroImage}
              alt={vehicleName} 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
          </div>
          <div className="relative z-10 w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-end gap-gutter">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2 animate-hero-kicker">
                  <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase bg-secondary/10 px-2.5 py-1 rounded border border-secondary/20">
                    {category.name}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                    {vehicle.plateNumber}
                  </span>
                </div>
                <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-2 animate-hero-title">
                  {vehicleName}
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl animate-hero-desc">
                  {category.description || (isEn ? 'The pinnacle of automotive engineering, offering unmatched comfort, cutting-edge technology, and a commanding presence on the road. Perfect for executive travel and special occasions.' : 'Puncak rekayasa otomotif dengan kenyamanan tanpa kompromi, teknologi mutakhir, dan profil berwibawa di jalan raya. Sempurna untuk perjalanan eksekutif dan momen istimewa Anda.')}
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end mt-6 md:mt-0 animate-hero-cta">
                <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">
                  {dict.vehicles.pricePerDay}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-secondary" data-testid="vehicle-detail-rate">
                    {formatCurrency(vehicle.dailyRate, locale)}
                  </span>
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    {dict.vehicles.perDay}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Specifications & Booking Grid */}
        <section className="w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Specs, Gallery & Features */}
            <div className="lg:col-span-8 flex flex-col gap-16">
              
              {/* Specifications Bento Grid */}
              <ScrollReveal>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">
                    {dict.vehicles.specsTitle}
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow border border-outline-variant/30 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group">
                      <span className="material-symbols-outlined text-secondary opacity-80 transition-transform duration-300 group-hover:scale-110">settings</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">
                        {dict.vehicles.transmission}
                      </span>
                      <span className="font-body-lg text-body-lg text-on-surface">{category.transmission}</span>
                    </div>
                    <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow border border-outline-variant/30 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group">
                      <span className="material-symbols-outlined text-secondary opacity-80 transition-transform duration-300 group-hover:scale-110">local_gas_station</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">
                        {dict.vehicles.fuel}
                      </span>
                      <span className="font-body-lg text-body-lg text-on-surface">
                        {FUEL_TYPE_LABELS[vehicle.fuelType as FuelType] || vehicle.fuelType}
                      </span>
                      {vehicle.fuelEfficiencyKmL && (
                        <span className="text-xs text-on-surface-variant">
                          ~{Number(vehicle.fuelEfficiencyKmL)} km/L
                        </span>
                      )}
                    </div>
                    <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow border border-outline-variant/30 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group">
                      <span className="material-symbols-outlined text-secondary opacity-80 transition-transform duration-300 group-hover:scale-110">group</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">
                        {dict.vehicles.capacity}
                      </span>
                      <span className="font-body-lg text-body-lg text-on-surface">
                        {category.capacity} {isEn ? 'Seats' : 'Kursi'}
                      </span>
                    </div>
                    <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow border border-outline-variant/30 hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1 group">
                      <span className="material-symbols-outlined text-secondary opacity-80 transition-transform duration-300 group-hover:scale-110">directions_car</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">
                        {dict.vehicles.pickupBranch}
                      </span>
                      <span className="font-body-lg text-body-lg text-on-surface">{vehicle.branch.name}</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {/* Pre-Trip Fuel Estimator */}
              <ScrollReveal delay={100}>
                <FuelCostEstimator
                  fuelType={vehicle.fuelType as FuelType}
                  fuelEfficiencyKmL={vehicle.fuelEfficiencyKmL ? Number(vehicle.fuelEfficiencyKmL) : null}
                  pricePerLiter={fuelPricePerLiter}
                />
              </ScrollReveal>

              {/* Photo Gallery (if multiple photos) */}
              {photos.length > 1 && (
                <ScrollReveal delay={150}>
                  <div>
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">
                      {isEn ? 'Fleet Gallery' : 'Galeri Armada'}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {photos.map((photo, index) => (
                        <div key={index} className="group rounded-xl overflow-hidden aspect-video bg-surface-container border border-surface-variant hover:border-secondary/50 shadow-md transition-all duration-300 hover:-translate-y-1">
                          <img src={photo} alt={`${vehicleName} view ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}

              {/* Features */}
              <ScrollReveal delay={200}>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">
                    {dict.vehicles.featuresTitle}
                  </h2>
                  {features.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-4 group">
                          <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center border border-white/5 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                            <span className="material-symbols-outlined text-secondary">{getFeatureIcon(feat)}</span>
                          </div>
                          <span className="font-body-md text-body-md text-on-surface">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-on-surface-variant">
                      {isEn ? 'Executive amenities & certified maintenance standards included.' : 'Standar kenyamanan eksekutif & inspeksi berkala terjamin.'}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            </div>

            {/* Right Column: Booking Widget */}
            <div className="lg:col-span-4">
              <ScrollReveal delay={100}>
                <div className="bg-surface-container rounded-lg p-8 sticky top-28 border border-white/5 ambient-glow flex flex-col gap-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      {dict.booking.pageTitle}
                    </h3>
                  </div>
                  
                  <div className="w-full h-[1px] bg-surface-variant/40 mb-4" />
                  
                  <div className="flex flex-col gap-4">
                    <div className="bg-surface-container-lowest p-4 rounded border border-surface-variant/50">
                      <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase mb-1">
                        {isEn ? 'Selected Vehicle' : 'Armada Terpilih'}
                      </span>
                      <span className="font-headline-md text-on-surface text-lg font-bold block">{vehicleName}</span>
                      <span className="text-xs text-secondary">{category.name} • {vehicle.plateNumber}</span>
                    </div>

                    {vehicle.status === 'maintenance' && (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                          <span className="material-symbols-outlined text-[16px]">build</span>
                          <span>{isEn ? 'Status: Workshop Maintenance' : 'Status: Dalam Perawatan Bengkel'}</span>
                        </div>
                        {vehicle.unavailabilities?.[0]?.estimatedEndAt ? (
                          new Date() > new Date(vehicle.unavailabilities[0].estimatedEndAt) ? (
                            <p className="text-amber-300/80 leading-relaxed">
                              {isEn
                                ? 'Maintenance schedule is being updated by the workshop team. Reservations are open for post-service schedules.'
                                : 'Jadwal perbaikan sedang diperbarui oleh tim teknis. Pemesanan dibuka untuk jadwal setelah servis selesai.'}
                            </p>
                          ) : (
                            <p className="text-amber-300/80 leading-relaxed">
                              {isEn ? (
                                <>
                                  Estimated service completion: <strong>{formatDateTime(vehicle.unavailabilities[0].estimatedEndAt, locale)}</strong>. You may book this vehicle for dates after completion (+3 hr buffer).
                                </>
                              ) : (
                                <>
                                  Estimasi selesai servis: <strong>{formatDateTime(vehicle.unavailabilities[0].estimatedEndAt, locale)}</strong>. Anda dapat memesan armada ini untuk tanggal setelah masa perawatan (+3 jam buffer).
                                </>
                              )}
                            </p>
                          )
                        ) : (
                          <p className="text-amber-300/80 leading-relaxed">
                            {isEn
                              ? 'Intensive maintenance in progress. Future booking will open once estimated completion is confirmed.'
                              : 'Perawatan intensif sedang berlangsung. Pemesanan masa depan dibuka segera setelah estimasi selesai ditetapkan.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center py-4 border-t border-surface-variant mt-2">
                    <span className="font-body-lg text-body-lg text-on-surface-variant">
                      {dict.vehicles.pricePerDay}
                    </span>
                    <span className="font-headline-md text-headline-md text-on-surface">
                      {formatCurrency(vehicle.dailyRate, locale)}
                    </span>
                  </div>
                  
                  {vehicle.status === 'maintenance' && !vehicle.unavailabilities?.[0]?.estimatedEndAt ? (
                    <div className="block w-full text-center bg-surface-container-high text-on-surface-variant font-button text-button py-4 rounded border border-outline-variant/40 cursor-not-allowed">
                      {isEn ? 'Under Maintenance (Unavailable)' : 'Sedang Perawatan (Belum Dapat Dipesan)'}
                    </div>
                  ) : (
                    <Link href={`/vehicles/${vehicle.id}/book`} className="shimmer-btn group block w-full text-center bg-secondary text-on-secondary font-button text-button py-4 rounded hover:bg-secondary-fixed transition-all duration-300 transform hover:-translate-y-0.5 shadow-[0_10px_20px_-10px_rgba(233,193,118,0.3)]">
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {dict.vehicles.startBooking}
                        <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1">
                          arrow_forward
                        </span>
                      </span>
                    </Link>
                  )}
                  <p className="font-label-caps text-label-caps text-on-surface-variant text-center lowercase tracking-normal">
                    {dict.vehicles.guaranteeNotice}
                  </p>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>

        {/* Customer Reviews Section */}
        <VehicleReviewsSection
          vehicleId={vehicle.id}
          currentBranchId={vehicle.branchId}
          currentBranchName={vehicle.branch?.name || ''}
          locale={locale}
          dict={dict}
        />
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  )
}
