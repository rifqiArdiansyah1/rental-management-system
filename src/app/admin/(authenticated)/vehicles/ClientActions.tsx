'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createVehicle, updateVehicleStatus, softDeleteVehicle, updateVehicle, updateVehicleUnavailabilityEstimate, relocateVehicle } from '@/actions/adminVehicle'
import { uploadVehiclePhoto } from '@/actions/vehiclePhoto'
import { VehicleStatus, FuelType } from '@prisma/client'
import { MIN_VEHICLE_DAILY_RATE, FUEL_TYPE_LABELS } from '@/lib/constants'

// -- Filter Bar --
export function VehicleFilterBar({ branches, categories, userRole }: { 
  branches: Array<{id: string, name: string}>,
  categories: Array<{id: string, name: string}>,
  userRole: string 
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [branch, setBranch] = useState(searchParams.get('branch') || 'all')
  const [showInactive, setShowInactive] = useState(searchParams.get('showInactive') === 'true')
  const [isPending, startTransition] = useTransition()

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      applyFilters(q, category, branch, showInactive)
    }, 300)
    return () => clearTimeout(handler)
  }, [q, category, branch, showInactive])

  const applyFilters = (searchQ: string, cat: string, br: string, inactive: boolean) => {
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    if (cat !== 'all') params.set('category', cat)
    if (br !== 'all') params.set('branch', br)
    if (inactive) params.set('showInactive', 'true')
    
    const query = params.toString() ? `?${params.toString()}` : ''
    startTransition(() => {
      router.push(`${pathname}${query}`)
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cari Nama Mobil atau Plat Nomor</label>
        <input 
          type="text" 
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Misal: Porsche / B 1234 ABC"
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Kategori Kelas</label>
        <select 
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {userRole === 'admin_pusat' && (
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Cabang</label>
          <select 
            value={branch}
            onChange={e => setBranch(e.target.value)}
            className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2 pb-2">
        <input 
          type="checkbox" 
          id="showInactive" 
          checked={showInactive}
          onChange={e => setShowInactive(e.target.checked)}
          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="showInactive" className="text-sm text-zinc-700 cursor-pointer whitespace-nowrap">
          Tampilkan Nonaktif
        </label>
      </div>
    </div>
  )
}

// -- Photo Uploader Component --
function PhotoManager({ photos, onChange, maxPhotos = 6 }: {
  photos: string[]
  onChange: (photos: string[]) => void
  maxPhotos?: number
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (photos.length >= maxPhotos) {
      setUploadError(`Maksimal ${maxPhotos} foto per armada`)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await uploadVehiclePhoto(formData)
    setIsUploading(false)

    if (res.error) {
      setUploadError(res.error)
    } else if (res.publicUrl) {
      onChange([...photos, res.publicUrl])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    if (photos.length >= maxPhotos) {
      setUploadError(`Maksimal ${maxPhotos} foto per armada`)
      return
    }
    onChange([...photos, urlInput.trim()])
    setUrlInput('')
  }

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    onChange(newPhotos)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700">
        Galeri Foto Kendaraan ({photos.length}/{maxPhotos})
      </label>

      {/* Thumbnails Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-zinc-200 aspect-video bg-zinc-100">
              <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  COVER
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemovePhoto(idx)}
                className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition-opacity shadow"
                title="Hapus foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload & URL Input Controls */}
      {photos.length < maxPhotos && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleFileUpload}
              className="hidden"
              id="vehicle-photo-upload"
            />
            <label
              htmlFor="vehicle-photo-upload"
              className={`flex-1 flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-md py-2 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span>📷 {isUploading ? 'Mengunggah...' : 'Upload Gambar (Maks 5MB)'}</span>
            </label>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Atau tempel URL gambar..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="flex-1 text-xs border border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-900 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded-md transition-colors"
            >
              Tambah
            </button>
          </div>
        </div>
      )}

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  )
}

// -- Create Vehicle Modal --
export function CreateVehicleButton({ branches, categories, userRole, userBranchId }: {
  branches: Array<{id: string, name: string}>,
  categories: Array<{id: string, name: string}>,
  userRole: string,
  userBranchId?: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const defaultBranchId = userRole === 'admin_pusat' ? '' : (userBranchId || (branches.length === 1 ? branches[0].id : ''))

  const [form, setForm] = useState({
    name: '',
    plateNumber: '',
    categoryId: '',
    branchId: defaultBranchId,
    dailyRate: '',
    photos: [] as string[],
    fuelType: 'pertalite' as FuelType,
    fuelEfficiencyKmL: '',
  })

  const availableBranches = userRole === 'admin_pusat'
    ? branches
    : branches.filter(b => b.id === userBranchId)

  const handleOpen = () => {
    setForm({
      name: '',
      plateNumber: '',
      categoryId: '',
      branchId: userRole === 'admin_pusat' ? '' : (userBranchId || (branches.length === 1 ? branches[0].id : '')),
      dailyRate: '',
      photos: [],
      fuelType: 'pertalite' as FuelType,
      fuelEfficiencyKmL: '',
    })
    setError(null)
    setIsOpen(true)
  }

  // Disable completely for staff
  if (userRole === 'staff_cabang') return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const targetBranchId = userRole === 'admin_pusat' ? form.branchId : (userBranchId || form.branchId)
      if (!targetBranchId) {
        setError('Cabang wajib dipilih')
        return
      }
      if (!form.dailyRate || Number(form.dailyRate) < MIN_VEHICLE_DAILY_RATE) {
        setError(`Tarif harian minimal ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(MIN_VEHICLE_DAILY_RATE)} / hari`)
        return
      }
      const res = await createVehicle({
        name: form.name,
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: targetBranchId,
        dailyRate: Number(form.dailyRate),
        photos: form.photos,
        fuelType: form.fuelType,
        fuelEfficiencyKmL: form.fuelEfficiencyKmL ? Number(form.fuelEfficiencyKmL) : null,
      })
      if (res.error) setError(res.error)
      else {
        setIsOpen(false)
        setForm({
          name: '',
          plateNumber: '',
          categoryId: '',
          branchId: defaultBranchId,
          dailyRate: '',
          photos: [],
          fuelType: 'pertalite' as FuelType,
          fuelEfficiencyKmL: '',
        })
        router.refresh()
      }
    })
  }

  return (
    <>
      <button 
        onClick={handleOpen}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        + Tambah Kendaraan
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Tambah Kendaraan Baru</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Mobil / Model *</label>
                <input 
                  required
                  type="text"
                  placeholder="Misal: BMW 730Li M Sport / Toyota Alphard"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Plat Nomor *</label>
                  <input 
                    required
                    type="text"
                    placeholder="B 1234 ABC"
                    value={form.plateNumber}
                    onChange={e => setForm({...form, plateNumber: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tarif Harian (Rp) *</label>
                  <input 
                    required
                    type="number"
                    min={MIN_VEHICLE_DAILY_RATE}
                    step="10000"
                    placeholder="500000"
                    value={form.dailyRate}
                    onChange={e => setForm({...form, dailyRate: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Minimal Rp 250.000 / hari</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kategori Kelas *</label>
                  <select 
                    required
                    value={form.categoryId}
                    onChange={e => setForm({...form, categoryId: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang *</label>
                  {userRole === 'admin_pusat' ? (
                    <select 
                      required
                      value={form.branchId}
                      onChange={e => setForm({...form, branchId: e.target.value})}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Pilih Cabang --</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  ) : (
                    <select 
                      disabled
                      value={userBranchId || form.branchId}
                      className="w-full text-zinc-700 bg-zinc-100 border border-zinc-300 rounded-md p-2 text-sm cursor-not-allowed"
                    >
                      {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jenis Bahan Bakar *</label>
                  <select 
                    required
                    value={form.fuelType}
                    onChange={e => setForm({...form, fuelType: e.target.value as FuelType})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(FUEL_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Efisiensi BBM (km/L)</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="Misal: 12.5 (opsional)"
                    value={form.fuelEfficiencyKmL}
                    onChange={e => setForm({...form, fuelEfficiencyKmL: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Estimasi jarak tempuh per liter</p>
                </div>
              </div>

              {/* Photo Manager */}
              <div className="pt-2 border-t border-zinc-100">
                <PhotoManager 
                  photos={form.photos} 
                  onChange={newPhotos => setForm({...form, photos: newPhotos})} 
                />
              </div>
            </div>

            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Kendaraan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// -- Row Actions --
export function VehicleRowActions({ vehicle, categories, branches, userRole, userBranchId }: { 
  vehicle: any,
  categories: any[],
  branches: any[],
  userRole: string,
  userBranchId?: string | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [modalType, setModalType] = useState<'edit' | 'status' | 'delete' | 'estimate' | 'relocate' | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // Status Modal states
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status)
  const [statusEstimatedEndAt, setStatusEstimatedEndAt] = useState<string>('')
  const [statusNote, setStatusNote] = useState<string>('')

  // Relocate Modal states
  const otherBranches = branches.filter(b => b.id !== vehicle.branchId)
  const [relocateTargetBranchId, setRelocateTargetBranchId] = useState<string>(otherBranches[0]?.id || '')
  const [relocateTransitUntil, setRelocateTransitUntil] = useState<string>('')
  const [relocateNote, setRelocateNote] = useState<string>('')

  // Estimate Modal states
  const [estimateEndAt, setEstimateEndAt] = useState<string>('')
  const [estimateNote, setEstimateNote] = useState<string>('')
  const [estimateConflictWarning, setEstimateConflictWarning] = useState<boolean>(false)
  const [estimateConflictingBookings, setEstimateConflictingBookings] = useState<any[]>([])
  
  const [form, setForm] = useState({
    name: vehicle.name || '',
    plateNumber: vehicle.plateNumber,
    categoryId: vehicle.categoryId,
    branchId: vehicle.branchId,
    dailyRate: vehicle.dailyRate.toString(),
    photos: (vehicle.photos || []) as string[],
    fuelType: (vehicle.fuelType || 'pertalite') as FuelType,
    fuelEfficiencyKmL: vehicle.fuelEfficiencyKmL ? vehicle.fuelEfficiencyKmL.toString() : '',
  })

  useEffect(() => {
    setStatus(vehicle.status)
    setForm({
      name: vehicle.name || '',
      plateNumber: vehicle.plateNumber,
      categoryId: vehicle.categoryId,
      branchId: vehicle.branchId,
      dailyRate: vehicle.dailyRate.toString(),
      photos: (vehicle.photos || []) as string[],
      fuelType: (vehicle.fuelType || 'pertalite') as FuelType,
      fuelEfficiencyKmL: vehicle.fuelEfficiencyKmL ? vehicle.fuelEfficiencyKmL.toString() : '',
    })
  }, [vehicle.status, vehicle.name, vehicle.plateNumber, vehicle.categoryId, vehicle.branchId, vehicle.dailyRate, vehicle.photos, vehicle.fuelType, vehicle.fuelEfficiencyKmL])

  const canEditOrDelete = userRole !== 'staff_cabang'

  const handleToggleMenu = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 220)
    }
    setMenuOpen(!menuOpen)
  }

  const handleOpenStatusModal = () => {
    setMenuOpen(false)
    setStatus(vehicle.status)
    const unavail = vehicle.unavailabilities?.[0]
    if (unavail?.estimatedEndAt) {
      const d = new Date(unavail.estimatedEndAt)
      const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000)
      setStatusEstimatedEndAt(wibDate.toISOString().slice(0, 16))
    } else {
      setStatusEstimatedEndAt('')
    }
    setStatusNote(unavail?.note || '')
    setError(null)
    setModalType('status')
  }

  const handleOpenRelocateModal = () => {
    setMenuOpen(false)
    const targetBranches = branches.filter(b => b.id !== vehicle.branchId)
    setRelocateTargetBranchId(targetBranches[0]?.id || '')
    setRelocateTransitUntil('')
    setRelocateNote('')
    setError(null)
    setModalType('relocate')
  }

  const handleOpenEstimateModal = () => {
    setMenuOpen(false)
    const unavail = vehicle.unavailabilities?.[0]
    if (unavail?.estimatedEndAt) {
      const d = new Date(unavail.estimatedEndAt)
      const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000)
      setEstimateEndAt(wibDate.toISOString().slice(0, 16))
    } else {
      setEstimateEndAt('')
    }
    setEstimateNote(unavail?.note || '')
    setEstimateConflictWarning(false)
    setEstimateConflictingBookings([])
    setError(null)
    setModalType('estimate')
  }

  const handleUpdateStatus = () => {
    startTransition(async () => {
      setError(null)
      const res = await updateVehicleStatus(vehicle.id, status, {
        estimatedEndAt: status === 'maintenance' && statusEstimatedEndAt ? new Date(`${statusEstimatedEndAt}+07:00`) : null,
        note: statusNote.trim() || null
      })
      if (res.error) setError(res.error)
      else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  const handleRelocate = () => {
    if (!relocateTargetBranchId) {
      setError('Pilih cabang tujuan mutasi.')
      return
    }
    startTransition(async () => {
      setError(null)
      const res = await relocateVehicle(vehicle.id, relocateTargetBranchId, {
        transitUntil: relocateTransitUntil ? new Date(`${relocateTransitUntil}+07:00`) : null,
        note: relocateNote.trim() || null
      })
      if (res.error) {
        setError(res.error)
      } else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  const handleUpdateEstimate = () => {
    startTransition(async () => {
      setError(null)
      setEstimateConflictWarning(false)
      setEstimateConflictingBookings([])
      const res = await updateVehicleUnavailabilityEstimate(vehicle.id, {
        estimatedEndAt: estimateEndAt ? new Date(`${estimateEndAt}+07:00`) : null,
        note: estimateNote.trim() || null
      })
      if (res.error) {
        setError(res.error)
      } else {
        if (res.conflictWarning && res.conflictingBookings && res.conflictingBookings.length > 0) {
          setEstimateConflictWarning(true)
          setEstimateConflictingBookings(res.conflictingBookings)
        } else {
          setModalType(null)
          router.refresh()
        }
      }
    })
  }

  const handleEdit = () => {
    startTransition(async () => {
      setError(null)
      if (!form.dailyRate || Number(form.dailyRate) < MIN_VEHICLE_DAILY_RATE) {
        setError(`Tarif harian minimal ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(MIN_VEHICLE_DAILY_RATE)} / hari`)
        return
      }
      const res = await updateVehicle(vehicle.id, {
        name: form.name,
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: form.branchId,
        dailyRate: Number(form.dailyRate),
        photos: form.photos,
        fuelType: form.fuelType,
        fuelEfficiencyKmL: form.fuelEfficiencyKmL ? Number(form.fuelEfficiencyKmL) : null,
      })
      if (res.error) setError(res.error)
      else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  const handleToggleActive = () => {
    startTransition(async () => {
      setError(null)
      const res = await softDeleteVehicle(vehicle.id, !vehicle.isActive)
      if (res.error) setError(res.error)
      else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={handleToggleMenu}
        className="p-1 hover:bg-zinc-200 rounded-md text-zinc-500 transition-colors"
      >
        •••
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
          <div className={`absolute right-0 w-52 bg-white border border-zinc-200 rounded-md shadow-lg z-30 py-1 ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}>
            {vehicle.status === 'rented' ? (
              <div className="w-full text-left px-4 py-2 text-xs text-zinc-400 cursor-not-allowed bg-zinc-50 flex items-center justify-between">
                <span>Ubah Status</span>
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  Disewa (Otomatis)
                </span>
              </div>
            ) : !vehicle.isActive ? (
              <div className="w-full text-left px-4 py-2 text-xs text-zinc-400 cursor-not-allowed bg-zinc-50 flex items-center justify-between">
                <span>Ubah Status</span>
                <span className="text-[10px] font-semibold bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                  Nonaktif
                </span>
              </div>
            ) : (
              <button 
                onClick={handleOpenStatusModal}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Ubah Status
              </button>
            )}

            {userRole === 'admin_pusat' && vehicle.isActive && vehicle.status !== 'rented' && (
              <button 
                onClick={handleOpenRelocateModal}
                className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center justify-between"
              >
                <span>Mutasi Cabang</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-medium">
                  Pusat
                </span>
              </button>
            )}

            {vehicle.status === 'maintenance' && vehicle.isActive && (
              <button 
                onClick={handleOpenEstimateModal}
                className="w-full text-left px-4 py-2 text-sm text-amber-800 hover:bg-amber-50 flex items-center justify-between"
              >
                <span>Estimasi Maintenance</span>
                <span className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded font-medium">Update</span>
              </button>
            )}

            {canEditOrDelete && (
              <>
                <button 
                  onClick={() => { setMenuOpen(false); setModalType('edit') }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Edit Detail & Foto
                </button>
                <button 
                  onClick={() => { setMenuOpen(false); setModalType('delete') }}
                  className={`w-full text-left px-4 py-2 text-sm ${vehicle.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {vehicle.isActive ? 'Nonaktifkan' : 'Aktifkan Kembali'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {modalType === 'status' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Ubah Status</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Armada: <strong>{vehicle.name || vehicle.plateNumber}</strong> ({vehicle.plateNumber})
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Pilih Status Baru</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as VehicleStatus)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="available">Tersedia (Available)</option>
                  <option value="maintenance">Perbaikan (Maintenance)</option>
                </select>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Status &quot;Disewa&quot; dikelola otomatis oleh sistem saat Mulai Sewa di Manajemen Pesanan. Pemindahan cabang dapat dilakukan melalui menu &quot;Mutasi Cabang&quot;.
                </p>
              </div>

              {/* Conditional Inputs: Maintenance */}
              {status === 'maintenance' && (
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Estimasi Selesai Servis</label>
                    <input
                      type="datetime-local"
                      value={statusEstimatedEndAt}
                      onChange={e => setStatusEstimatedEndAt(e.target.value)}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Kosongkan jika durasi belum pasti (unit akan diblokir dari semua pemesanan). Jika diisi, customer dapat memesan untuk jadwal setelah servis + 3 jam buffer.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Catatan Servis / Bengkel</label>
                    <textarea
                      rows={2}
                      placeholder="Misal: Perbaikan transmisi di bengkel rekanan"
                      value={statusNote}
                      onChange={e => setStatusNote(e.target.value)}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}
            
            <div className="mt-6 flex justify-end gap-2">
              <button 
                onClick={() => setModalType(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Batal
              </button>
              <button 
                onClick={handleUpdateStatus}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Relocate Vehicle (Mutasi Antar Cabang) */}
      {modalType === 'relocate' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🚚</span>
              <h3 className="text-lg font-bold text-zinc-900">Mutasi Armada Antar Cabang</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Armada: <strong>{vehicle.name || vehicle.plateNumber}</strong> ({vehicle.plateNumber}) • Cabang Asal: <strong>{branches.find(b => b.id === vehicle.branchId)?.name || 'Cabang Asal'}</strong>
            </p>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 mb-4">
              <p className="font-semibold mb-1">Pola Mutasi Terhubung (Linked Record):</p>
              <p>Unit di cabang saat ini akan dinonaktifkan sebagai arsip riwayat, dan unit baru dengan spesifikasi serta nomor plat yang sama akan dibuka di cabang tujuan secara terhubung.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Pilih Cabang Tujuan *</label>
                <select 
                  value={relocateTargetBranchId}
                  onChange={e => setRelocateTargetBranchId(e.target.value)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {branches.filter(b => b.id !== vehicle.branchId).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.filter(b => b.id !== vehicle.branchId).length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Tidak ada cabang tujuan lain yang aktif.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Estimasi Tiba (Transit Window, Opsional)</label>
                <input
                  type="datetime-local"
                  value={relocateTransitUntil}
                  onChange={e => setRelocateTransitUntil(e.target.value)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Kosongkan jika armada langsung siap sewa di tujuan. Jika diisi tanggal masa depan, unit baru di cabang tujuan otomatis berstatus &quot;Maintenance&quot; selama masa pengiriman/transit sampai waktu tiba.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Catatan Mutasi</label>
                <textarea
                  rows={2}
                  placeholder="Misal: Rotasi armada untuk kebutuhan event / permintaan tinggi di cabang tujuan"
                  value={relocateNote}
                  onChange={e => setRelocateNote(e.target.value)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button 
                onClick={() => setModalType(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Batal
              </button>
              <button 
                onClick={handleRelocate}
                disabled={isPending || !relocateTargetBranchId}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-md disabled:opacity-50"
              >
                {isPending ? 'Memproses Mutasi...' : 'Eksekusi Mutasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Maintenance Estimate */}
      {modalType === 'estimate' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Perbarui Estimasi Maintenance</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Armada: <strong>{vehicle.name || vehicle.plateNumber}</strong> ({vehicle.plateNumber})
            </p>

            {estimateConflictWarning && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <span className="material-symbols-outlined text-base">warning</span>
                  <span>Peringatan: Jadwal Bentrok Terdeteksi!</span>
                </div>
                <p>
                  Perpanjangan estimasi servis ini bertabrakan dengan {estimateConflictingBookings.length} pesanan sewa aktif:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                  {estimateConflictingBookings.map((b: any) => (
                    <li key={b.id}>
                      #{b.id.slice(-6).toUpperCase()} ({new Date(b.startDate).toLocaleDateString('id-ID')} - {new Date(b.endDate).toLocaleDateString('id-ID')}) — {b.customerName || 'Customer'}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-700 font-medium">
                  Pesanan telah otomatis ditandai di tab <strong>&quot;Perlu Tindakan&quot;</strong> agar tim operasional segera mengalihkan unit pengganti atau berkoordinasi dengan penyewa.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Estimasi Selesai Servis (WIB)</label>
                <input
                  type="datetime-local"
                  value={estimateEndAt}
                  onChange={e => setEstimateEndAt(e.target.value)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Kosongkan jika ingin mengubah ke maintenance indefinite (tanpa estimasi selesai).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Catatan Tambahan / Kendala Bengkel</label>
                <textarea
                  rows={3}
                  placeholder="Misal: Menunggu spare part dari distributor utama, estimasi mundur 2 hari"
                  value={estimateNote}
                  onChange={e => setEstimateNote(e.target.value)}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button 
                onClick={() => {
                  setModalType(null)
                  if (estimateConflictWarning) router.refresh()
                }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                {estimateConflictWarning ? 'Tutup' : 'Batal'}
              </button>
              {!estimateConflictWarning && (
                <button 
                  onClick={handleUpdateEstimate}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Estimasi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalType === 'edit' && canEditOrDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Edit Kendaraan</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Mobil / Model *</label>
                <input 
                  type="text"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Plat Nomor *</label>
                  <input 
                    type="text"
                    value={form.plateNumber}
                    onChange={e => setForm({...form, plateNumber: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tarif Harian (Rp) *</label>
                  <input 
                    type="number"
                    min={MIN_VEHICLE_DAILY_RATE}
                    step="10000"
                    value={form.dailyRate}
                    onChange={e => setForm({...form, dailyRate: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Minimal Rp 250.000 / hari</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kategori *</label>
                  <select 
                    value={form.categoryId}
                    onChange={e => setForm({...form, categoryId: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang *</label>
                  {userRole === 'admin_pusat' ? (
                    <select 
                      value={form.branchId}
                      onChange={e => setForm({...form, branchId: e.target.value})}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  ) : (
                    <select 
                      disabled
                      value={vehicle.branchId}
                      className="w-full text-zinc-700 bg-zinc-100 border border-zinc-300 rounded-md p-2 text-sm cursor-not-allowed"
                    >
                      {branches.filter(b => b.id === vehicle.branchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jenis Bahan Bakar *</label>
                  <select 
                    value={form.fuelType}
                    onChange={e => setForm({...form, fuelType: e.target.value as FuelType})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(FUEL_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Efisiensi BBM (km/L)</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="Misal: 12.5 (opsional)"
                    value={form.fuelEfficiencyKmL}
                    onChange={e => setForm({...form, fuelEfficiencyKmL: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Estimasi jarak tempuh per liter</p>
                </div>
              </div>

              {/* Photo Manager */}
              <div className="pt-2 border-t border-zinc-100">
                <PhotoManager 
                  photos={form.photos} 
                  onChange={newPhotos => setForm({...form, photos: newPhotos})} 
                />
              </div>
            </div>

            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button 
                onClick={() => setModalType(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Batal
              </button>
              <button 
                onClick={handleEdit}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'delete' && canEditOrDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-lg">
            <h3 className={`text-lg font-bold mb-2 ${vehicle.isActive ? 'text-red-700' : 'text-emerald-700'}`}>
              {vehicle.isActive ? 'Nonaktifkan Kendaraan?' : 'Aktifkan Kembali Kendaraan?'}
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              {vehicle.isActive 
                ? 'Kendaraan ini tidak akan muncul di katalog sewa lagi, namun riwayat transaksinya akan tetap ada.'
                : 'Kendaraan ini akan kembali muncul di katalog dan dapat disewa oleh pelanggan.'}
            </p>
            {error && <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md mb-4">{error}</div>}
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setModalType(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Batal
              </button>
              <button 
                onClick={handleToggleActive}
                disabled={isPending}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${vehicle.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isPending ? 'Memproses...' : (vehicle.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
