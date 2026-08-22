'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createVehicle, updateVehicleStatus, softDeleteVehicle, updateVehicle } from '@/actions/adminVehicle'
import { VehicleStatus } from '@prisma/client'

// -- Filter Bar --
export function VehicleFilterBar({ branches, categories, userRole }: { 
  branches: Array<{id: string, name: string}>,
  categories: Array<{id: string, name: string}>,
  userRole: string 
}) {
  const router = useRouter()
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
    if (searchQ) params.set('q', searchQ)
    if (cat !== 'all') params.set('category', cat)
    if (br !== 'all') params.set('branch', br)
    if (inactive) params.set('showInactive', 'true')
    
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cari Plat Nomor</label>
        <input 
          type="text" 
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Misal: B 1234 ABC"
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Kategori</label>
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
        <label htmlFor="showInactive" className="text-sm text-zinc-700 cursor-pointer">
          Tampilkan Nonaktif
        </label>
      </div>
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
    plateNumber: '',
    categoryId: '',
    branchId: '',
    dailyRate: ''
  })

  // Disable completely for staff
  if (userRole === 'staff_cabang') return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const res = await createVehicle({
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: form.branchId,
        dailyRate: Number(form.dailyRate)
      })
      if (res.error) setError(res.error)
      else {
        setIsOpen(false)
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Tambah Kendaraan</h3>
            
            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-zinc-700 mb-1">Kategori *</label>
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

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tarif Harian (Rp) *</label>
                <input 
                  required
                  type="number"
                  min="0"
                  step="1000"
                  value={form.dailyRate}
                  onChange={e => setForm({...form, dailyRate: e.target.value})}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {isPending ? 'Menyimpan...' : 'Simpan'}
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
  const [modalType, setModalType] = useState<'edit' | 'status' | 'delete' | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<VehicleStatus>(vehicle.status)
  
  const [form, setForm] = useState({
    plateNumber: vehicle.plateNumber,
    categoryId: vehicle.categoryId,
    branchId: vehicle.branchId,
    dailyRate: vehicle.dailyRate.toString()
  })

  // Staff Cabang cannot edit or delete vehicles, but can they update status? 
  // Wait, updating status to maintenance usually staff can do? 
  // The plan didn't explicitly forbid updateVehicleStatus for staff_cabang, just create and softDelete. 
  // Let's assume staff can change status but not edit/delete.
  const canEditOrDelete = userRole !== 'staff_cabang'

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
        plateNumber: form.plateNumber,
        categoryId: form.categoryId,
        branchId: form.branchId,
        dailyRate: Number(form.dailyRate)
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
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-1 hover:bg-zinc-200 rounded-md text-zinc-500 transition-colors"
      >
        •••
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-md shadow-lg z-20 py-1">
            <button 
              onClick={() => { setMenuOpen(false); setModalType('status') }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Ubah Status
            </button>
            {canEditOrDelete && (
              <>
                <button 
                  onClick={() => { setMenuOpen(false); setModalType('edit') }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Edit Detail
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
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Ubah Status</h3>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value as VehicleStatus)}
              className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="available">Tersedia (Available)</option>
              <option value="rented">Disewa (Rented)</option>
              <option value="maintenance">Perbaikan (Maintenance)</option>
              <option value="moved">Dipindahkan (Moved)</option>
            </select>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Edit Kendaraan</h3>
            <div className="space-y-4">
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
                {isPending ? 'Menyimpan...' : 'Simpan'}
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
