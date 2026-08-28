'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createVehicle, updateVehicleStatus, softDeleteVehicle, updateVehicle } from '@/actions/adminVehicle'
import { uploadVehiclePhoto } from '@/actions/vehiclePhoto'
import { VehicleStatus } from '@prisma/client'

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
export function CreateVehicleButton({ branches, categories, userRole }: {
  branches: Array<{id: string, name: string}>,
  categories: Array<{id: string, name: string}>,
  userRole: string 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    plateNumber: '',
    categoryId: '',
    branchId: '',
    dailyRate: '',
    photos: [] as string[]
  })

  // Disable completely for staff
  if (userRole === 'staff_cabang') return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const res = await createVehicle({
        name: form.name,
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: form.branchId,
        dailyRate: Number(form.dailyRate),
        photos: form.photos
      })
      if (res.error) setError(res.error)
      else {
        setIsOpen(false)
        setForm({
          name: '',
          plateNumber: '',
          categoryId: '',
          branchId: '',
          dailyRate: '',
          photos: []
        })
        router.refresh()
      }
    })
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
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
                    min="0"
                    step="1000"
                    placeholder="500000"
                    value={form.dailyRate}
                    onChange={e => setForm({...form, dailyRate: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  <select 
                    required
                    value={form.branchId}
                    onChange={e => setForm({...form, branchId: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
export function VehicleRowActions({ vehicle, categories, branches, userRole }: { 
  vehicle: any,
  categories: any[],
  branches: any[],
  userRole: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [modalType, setModalType] = useState<'edit' | 'status' | 'delete' | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<VehicleStatus>(vehicle.status)
  
  const [form, setForm] = useState({
    name: vehicle.name || '',
    plateNumber: vehicle.plateNumber,
    categoryId: vehicle.categoryId,
    branchId: vehicle.branchId,
    dailyRate: vehicle.dailyRate.toString(),
    photos: (vehicle.photos || []) as string[]
  })

  useEffect(() => {
    setStatus(vehicle.status)
    setForm({
      name: vehicle.name || '',
      plateNumber: vehicle.plateNumber,
      categoryId: vehicle.categoryId,
      branchId: vehicle.branchId,
      dailyRate: vehicle.dailyRate.toString(),
      photos: (vehicle.photos || []) as string[]
    })
  }, [vehicle.status, vehicle.name, vehicle.plateNumber, vehicle.categoryId, vehicle.branchId, vehicle.dailyRate, vehicle.photos])

  const canEditOrDelete = userRole !== 'staff_cabang'

  const handleToggleMenu = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 200)
    }
    setMenuOpen(!menuOpen)
  }

  const handleUpdateStatus = () => {
    startTransition(async () => {
      setError(null)
      const res = await updateVehicleStatus(vehicle.id, status)
      if (res.error) setError(res.error)
      else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  const handleEdit = () => {
    startTransition(async () => {
      setError(null)
      const res = await updateVehicle(vehicle.id, {
        name: form.name,
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: form.branchId,
        dailyRate: Number(form.dailyRate),
        photos: form.photos
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
          <div className={`absolute right-0 w-48 bg-white border border-zinc-200 rounded-md shadow-lg z-30 py-1 ${
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
                onClick={() => { setMenuOpen(false); setStatus(vehicle.status); setModalType('status') }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Ubah Status
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
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Ubah Status</h3>
            <p className="text-xs text-zinc-500 mb-4">Pilih status operasional kendaraan di cabang.</p>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value as VehicleStatus)}
              className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="available">Tersedia (Available)</option>
              <option value="maintenance">Perbaikan (Maintenance)</option>
              <option value="moved">Dipindahkan (Moved)</option>
            </select>
            <p className="text-[11px] text-zinc-400 mt-2">
              Status &quot;Disewa&quot; dikelola otomatis oleh sistem saat Mulai Sewa di Manajemen Pesanan.
            </p>
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
                    value={form.dailyRate}
                    onChange={e => setForm({...form, dailyRate: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  <select 
                    value={form.branchId}
                    onChange={e => setForm({...form, branchId: e.target.value})}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
