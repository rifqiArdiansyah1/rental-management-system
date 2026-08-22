import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getVehicleById } from '@/actions/vehicle'
import { getAllBranches } from '@/actions/branch'
import { createClient } from '@/utils/supabase/server'
import BookingForm from '@/components/BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedParams = await params
  const vehicleId = resolvedParams.id
  
  const [vehicle, branches] = await Promise.all([
    getVehicleById(vehicleId),
    getAllBranches()
  ])

  if (!vehicle) {
    notFound()
  }

  const { category } = vehicle
  const vehicleName = vehicle.name || `${category.name} (${vehicle.plateNumber})`
  const imageUrl = (vehicle.photos && vehicle.photos.length > 0) 
    ? vehicle.photos[0] 
    : (category.imageUrl || 'https://via.placeholder.com/1200x800?text=Vehicle')

  return (
    <div className="flex-grow flex flex-col bg-background">
      {/* Top Navigation */}
      <header className="w-full top-0 sticky z-50 bg-background/80 backdrop-blur-md border-b border-surface-variant">
        <nav className="flex items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <Link href={`/vehicles/${vehicle.id}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-button text-button">Back to Vehicle</span>
          </Link>
        </nav>
      </header>

      {/* Main Content Split Screen */}
      <main className="flex-grow flex flex-col lg:flex-row w-full max-w-container-max mx-auto h-full">
        
        {/* Left Column: Vehicle Summary */}
        <section className="w-full lg:w-1/2 p-margin-mobile md:p-margin-desktop bg-surface-dim border-r border-surface-variant flex flex-col gap-8">
          <div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-on-surface mb-2 tracking-tight">
              Complete Your Reservation
            </h1>
            <p className="font-body-lg text-on-surface-variant">
              Review your vehicle selection and provide booking details.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden relative border border-outline-variant shadow-lg ambient-glow">
            <img 
              src={imageUrl} 
              alt={vehicleName} 
              className="w-full h-64 md:h-80 object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <span className="font-label-caps text-secondary tracking-widest uppercase mb-1 block">
                {category.name} • {vehicle.plateNumber}
              </span>
              <h2 className="font-headline-lg text-white">
                {vehicleName}
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-headline-md text-on-surface border-b border-surface-variant pb-2">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="font-label-caps text-on-surface-variant">Transmission</span>
                <span className="font-body-md text-on-surface">{category.transmission}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caps text-on-surface-variant">Capacity</span>
                <span className="font-body-md text-on-surface">{category.capacity} Pass.</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caps text-on-surface-variant">Daily Rate</span>
                <span className="font-body-md text-secondary">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(vehicle.dailyRate))}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Booking Form Component */}
        <section className="w-full lg:w-1/2 p-margin-mobile md:p-margin-desktop bg-surface flex flex-col">
          <BookingForm 
            vehicleId={vehicle.id} 
            dailyRate={Number(vehicle.dailyRate)} 
            branches={branches}
            defaultBranchId={vehicle.branchId}
          />
        </section>
        
      </main>
    </div>
  )
}
