import Link from 'next/link'
import { Prisma } from '@prisma/client'

type VehicleWithRelations = Prisma.VehicleGetPayload<{
  include: { category: true; branch: true }
}>

interface VehicleCardProps {
  vehicle: VehicleWithRelations
  isPopular?: boolean
}

export default function VehicleCard({ vehicle, isPopular = false }: VehicleCardProps) {
  const { category } = vehicle
  const imageUrl = category.imageUrl || 'https://via.placeholder.com/600x400?text=Vehicle'
  
  // Parse features safely
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

  return (
    <Link href={`/vehicles/${vehicle.id}`}>
      <article className={`card-hover-effect rounded-xl overflow-hidden flex flex-col group cursor-pointer relative h-full ${
        isPopular 
          ? 'bg-surface-container-high border border-secondary/30' 
          : 'bg-surface-container-high border border-outline-variant/20'
      }`}>
        {isPopular && (
          <div className="absolute top-0 right-0 bg-secondary text-background font-label-caps text-label-caps px-4 py-1 rounded-bl-lg z-10 font-bold tracking-widest">
            POPULAR
          </div>
        )}
        
        <div className="relative h-64 overflow-hidden bg-surface-container-lowest">
          <img 
            className={`w-full h-full object-cover card-image transition-all duration-500 ${!isPopular ? 'mix-blend-luminosity group-hover:mix-blend-normal' : ''}`} 
            src={imageUrl} 
            alt={category.name}
          />
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm border border-outline-variant/50 px-3 py-1 rounded font-label-caps text-label-caps text-on-surface uppercase tracking-wider">
            {category.name}
          </div>
        </div>
        
        <div className={`p-6 flex flex-col flex-grow ${isPopular ? 'bg-gradient-to-b from-surface-container-high to-surface-container' : ''}`}>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{vehicle.plateNumber} - {category.name}</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6 flex-grow">
            {category.capacity} Seats • {category.transmission} {features.length > 0 ? `• ${features.join(', ')}` : ''}
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6 border-y border-surface-variant py-4">
            <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-label-caps">
              <span className="material-symbols-outlined text-[16px]">settings</span>
              <span>{category.transmission}</span>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-label-caps">
              <span className="material-symbols-outlined text-[16px]">group</span>
              <span>{category.capacity} Seats</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-auto">
            <div>
              <span className="font-label-caps text-label-caps text-on-surface-variant block uppercase mb-1">Daily Rate</span>
              <span className="font-body-lg text-body-lg text-secondary font-medium">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(vehicle.dailyRate))}
              </span>
            </div>
            <button className={
              isPopular 
                ? "bg-secondary text-background p-2 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                : "bg-surface-container-lowest border border-secondary text-secondary hover:bg-secondary hover:text-background p-2 rounded-full transition-colors flex items-center justify-center"
            }>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </article>
    </Link>
  )
}
