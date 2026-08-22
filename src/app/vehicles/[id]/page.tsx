import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getVehicleById } from '@/actions/vehicle'
import Navbar from '@/components/Navbar'

export const dynamic = 'force-dynamic'

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const vehicle = await getVehicleById(resolvedParams.id)

  if (!vehicle) {
    notFound()
  }

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

  // Generate some feature mapping for the UI (using Material Icons)
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
    <div className="flex-grow flex flex-col">
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
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase bg-secondary/10 px-2.5 py-1 rounded border border-secondary/20">
                    {category.name}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                    {vehicle.plateNumber}
                  </span>
                </div>
                <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-2">
                  {vehicleName}
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                  {category.description || 'The pinnacle of automotive engineering, offering unmatched comfort, cutting-edge technology, and a commanding presence on the road. Perfect for executive travel and special occasions.'}
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end mt-6 md:mt-0">
                <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Daily Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-secondary">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(vehicle.dailyRate))}
                  </span>
                  <span className="font-body-md text-body-md text-on-surface-variant">/ day</span>
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
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">Vehicle Specifications</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow">
                    <span className="material-symbols-outlined text-secondary opacity-80">settings</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">Transmission</span>
                    <span className="font-body-lg text-body-lg text-on-surface">{category.transmission}</span>
                  </div>
                  <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow">
                    <span className="material-symbols-outlined text-secondary opacity-80">local_gas_station</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">Fuel Type</span>
                    <span className="font-body-lg text-body-lg text-on-surface">Premium</span>
                  </div>
                  <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow">
                    <span className="material-symbols-outlined text-secondary opacity-80">group</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">Capacity</span>
                    <span className="font-body-lg text-body-lg text-on-surface">{category.capacity} Pass.</span>
                  </div>
                  <div className="bg-surface-container rounded p-6 flex flex-col gap-2 ambient-glow">
                    <span className="material-symbols-outlined text-secondary opacity-80">directions_car</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-2">Branch Location</span>
                    <span className="font-body-lg text-body-lg text-on-surface">{vehicle.branch.name}</span>
                  </div>
                </div>
              </div>

              {/* Photo Gallery (if multiple photos) */}
              {photos.length > 1 && (
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">Fleet Gallery</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="rounded-xl overflow-hidden aspect-video bg-surface-container border border-surface-variant shadow-md">
                        <img src={photo} alt={`${vehicleName} view ${index + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-8 border-b border-surface-variant pb-4">Premium Features</h2>
                {features.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center border border-white/5">
                          <span className="material-symbols-outlined text-secondary">{getFeatureIcon(feat)}</span>
                        </div>
                        <span className="font-body-md text-body-md text-on-surface">{feat}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-on-surface-variant">No specific premium features listed.</p>
                )}
              </div>
            </div>

            {/* Right Column: Booking Widget */}
            <div className="lg:col-span-4">
              <div className="bg-surface-container rounded-lg p-8 sticky top-28 border border-white/5 ambient-glow flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Reservation</h3>
                </div>
                
                {/* Progress line */}
                <div className="w-full h-[1px] bg-surface-variant relative mb-4">
                  <div className="absolute left-0 top-0 h-full w-1/3 bg-secondary"></div>
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="bg-surface-container-lowest p-4 rounded border border-surface-variant/50">
                    <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase mb-1">Selected Vehicle</span>
                    <span className="font-headline-md text-on-surface text-lg font-bold block">{vehicleName}</span>
                    <span className="text-xs text-secondary">{category.name} • {vehicle.plateNumber}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-4 border-t border-surface-variant mt-2">
                  <span className="font-body-lg text-body-lg text-on-surface-variant">Daily Rate</span>
                  <span className="font-headline-md text-headline-md text-on-surface">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(vehicle.dailyRate))}
                  </span>
                </div>
                
                <Link href={`/vehicles/${vehicle.id}/book`} className="block w-full text-center bg-secondary text-on-secondary font-button text-button py-4 rounded hover:bg-secondary-fixed transition-all duration-300 transform hover:-translate-y-1 shadow-[0_10px_20px_-10px_rgba(233,193,118,0.3)]">
                  Rent This Car
                </Link>
                <p className="font-label-caps text-label-caps text-on-surface-variant text-center lowercase tracking-normal">Requires security deposit and insurance verification.</p>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full pt-20 pb-10 bg-surface-container-lowest dark:bg-surface-container-lowest">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="col-span-1 md:col-span-1 flex flex-col gap-4">
            <span className="font-display-lg text-headline-md text-secondary">Prestige Motion</span>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-xs">Elevating your journey with uncompromising luxury and discretion.</p>
          </div>
          <div className="col-span-1 md:col-span-2 flex gap-12 mt-8 md:mt-0">
            <div className="flex flex-col gap-4">
              <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest mb-2">Explore</span>
              <span className="font-body-md text-body-md text-on-surface-variant hover:text-white transition-colors cursor-pointer">Locations</span>
              <span className="font-body-md text-body-md text-on-surface-variant hover:text-white transition-colors cursor-pointer">Categories</span>
            </div>
            <div className="flex flex-col gap-4">
              <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest mb-2">Legal</span>
              <span className="font-body-md text-body-md text-on-surface-variant hover:text-white transition-colors cursor-pointer">Terms</span>
              <span className="font-body-md text-body-md text-on-surface-variant hover:text-white transition-colors cursor-pointer">Privacy</span>
            </div>
            <div className="flex flex-col gap-4">
              <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest mb-2">Support</span>
              <span className="font-body-md text-body-md text-on-surface-variant hover:text-white transition-colors cursor-pointer">Contact</span>
            </div>
          </div>
          <div className="col-span-1 flex flex-col justify-end mt-12 md:mt-0 text-left md:text-right">
            <span className="font-body-md text-body-md text-on-surface-variant">© 2026 Prestige Motion. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
