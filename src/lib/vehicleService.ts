export interface ServiceStatusResult {
  currentKm: number | null
  lastServiceKm: number | null
  serviceIntervalKm: number
  kmSinceLastService: number | null
  kmUntilNextService: number | null
  status: 'healthy' | 'due' | 'overdue' | 'unknown'
  label: string
  color: 'emerald' | 'amber' | 'rose' | 'slate'
}

export function calculateVehicleServiceStatus(vehicle: {
  currentOdometerKm?: number | null
  lastServiceOdometerKm?: number | null
  initialOdometerKm?: number | null
  serviceIntervalKm?: number | null
}): ServiceStatusResult {
  const currentKm = vehicle.currentOdometerKm != null ? Number(vehicle.currentOdometerKm) : null
  const baseKm = vehicle.lastServiceOdometerKm != null
    ? Number(vehicle.lastServiceOdometerKm)
    : (vehicle.initialOdometerKm != null ? Number(vehicle.initialOdometerKm) : 0)
  const interval = vehicle.serviceIntervalKm != null && Number(vehicle.serviceIntervalKm) > 0
    ? Number(vehicle.serviceIntervalKm)
    : 10000

  if (currentKm == null) {
    return {
      currentKm: null,
      lastServiceKm: vehicle.lastServiceOdometerKm != null ? Number(vehicle.lastServiceOdometerKm) : null,
      serviceIntervalKm: interval,
      kmSinceLastService: null,
      kmUntilNextService: null,
      status: 'unknown',
      label: 'Belum Ada Data KM',
      color: 'slate',
    }
  }

  const kmSince = Math.max(0, currentKm - baseKm)
  const kmUntil = interval - kmSince

  if (kmUntil < 0) {
    return {
      currentKm,
      lastServiceKm: vehicle.lastServiceOdometerKm != null ? Number(vehicle.lastServiceOdometerKm) : null,
      serviceIntervalKm: interval,
      kmSinceLastService: kmSince,
      kmUntilNextService: kmUntil,
      status: 'overdue',
      label: `Lewat ${Math.abs(kmUntil).toLocaleString('id-ID')} km`,
      color: 'rose',
    }
  }

  if (kmUntil <= 1000) {
    return {
      currentKm,
      lastServiceKm: vehicle.lastServiceOdometerKm != null ? Number(vehicle.lastServiceOdometerKm) : null,
      serviceIntervalKm: interval,
      kmSinceLastService: kmSince,
      kmUntilNextService: kmUntil,
      status: 'due',
      label: `Sisa ${kmUntil.toLocaleString('id-ID')} km`,
      color: 'amber',
    }
  }

  return {
    currentKm,
    lastServiceKm: vehicle.lastServiceOdometerKm != null ? Number(vehicle.lastServiceOdometerKm) : null,
    serviceIntervalKm: interval,
    kmSinceLastService: kmSince,
    kmUntilNextService: kmUntil,
    status: 'healthy',
    label: `Sisa ${kmUntil.toLocaleString('id-ID')} km`,
    color: 'emerald',
  }
}
