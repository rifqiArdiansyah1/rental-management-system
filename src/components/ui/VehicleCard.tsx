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
  const vehicleName = vehicle.name || category.name
  const imageUrl = (vehicle.photos && vehicle.photos.length > 0) 
    ? vehicle.photos[0] 
    : (category.imageUrl || 'https://via.placeholder.com/600x400?text=Vehicle')
  
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

  const featureSummary = features.length > 0 
    ? features.slice(0, 3).join(' • ') 
    : 'Standar kenyamanan premium & inspeksi ketat.'

  return (
    <Link 
      href={`/vehicles/${vehicle.id}`}
      aria-label={`Lihat detail ${vehicleName}`}
      className="block h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary/50 rounded-xl"
    >
      <article className={`card-hover-effect rounded-xl overflow-hidden flex flex-col group relative h-full ${
        isPopular 
          ? 'bg-surface-container-high border border-secondary/40 shadow-lg shadow-secondary/5' 
          : 'bg-surface-container-high border border-outline-variant/20'
      }`}>
        {isPopular && (
          <div className="absolute top-0 right-0 bg-secondary text-background font-label-caps text-xs px-3.5 py-1 rounded-bl-lg z-10 font-bold tracking-widest uppercase">
            UNGGULAN
          </div>
        )}
        
        <div className="relative h-64 overflow-hidden bg-surface-container-lowest">
          <img 
            className={`w-full h-full object-cover card-image transition-all duration-500 ${!isPopular ? 'mix-blend-luminosity group-hover:mix-blend-normal' : ''}`} 
            src={imageUrl} 
            alt={vehicleName}
          />
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm border border-outline-variant/50 px-3 py-1 rounded font-label-caps text-xs text-on-surface uppercase tracking-wider font-medium">
            {category.name}
          </div>
        </div>
        
        <div className={`p-6 flex flex-col flex-grow ${isPopular ? 'bg-gradient-to-b from-surface-container-high to-surface-container' : ''}`}>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-2 font-semibold line-clamp-1">{vehicleName}</h3>
          <p className="font-body-md text-sm text-on-surface-variant mb-6 flex-grow line-clamp-2 leading-relaxed">
            {featureSummary}
          </p>
          
          {/* Spec Grid without Duplication */}
          <div className="grid grid-cols-3 gap-2 mb-6 border-y border-surface-variant/40 py-3.5 text-xs">
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-caps truncate">
              <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0">settings</span>
              <span className="truncate">{category.transmission}</span>
            </div>
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-caps truncate">
              <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0">group</span>
              <span className="truncate">{category.capacity} Kursi</span>
            </div>
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-caps truncate">
              <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0">location_on</span>
              <span className="truncate">{vehicle.branch?.city || 'Jakarta'}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-auto">
            <div>
              <span className="font-label-caps text-xs text-on-surface-variant block uppercase tracking-wider mb-0.5">
                Tarif Harian
              </span>
              <span className="font-body-lg text-lg text-secondary font-semibold">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(vehicle.dailyRate))}
              </span>
            </div>

            {/* Visual Icon (Non-interactive span to preserve valid HTML inside Link) */}
            <span 
              aria-hidden="true"
              className={
                isPopular 
                  ? "bg-secondary text-background p-2.5 rounded-full transition-transform group-hover:scale-110 flex items-center justify-center shadow-md"
                  : "bg-surface-container-lowest border border-secondary text-secondary group-hover:bg-secondary group-hover:text-background p-2.5 rounded-full transition-colors flex items-center justify-center"
              }
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
