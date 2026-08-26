'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createDriver,
  updateDriver,
  updateDriverStatus,
  softDeleteDriver,
  createDriverLeave,
  deleteDriverLeave,
  getDriverLeaves
} from '@/actions/adminDriver'
import { DriverStatus } from '@prisma/client'

// -- License Number Formatted Input Component --
export function LicenseNumberInput({
  value,
  onChange,
  required = true
}: {
  value: string
  onChange: (val: string) => void
  required?: boolean
}) {
  const parseValue = (raw: string) => {
    const trimmed = (raw || '').trim().toUpperCase()
    const match = trimmed.match(/^(SIM-[AB0-9]+)-(.*)$/)
    if (match) {
      return { prefix: match[1], code: match[2] }
    }
    if (trimmed.startsWith('SIM-B1')) return { prefix: 'SIM-B1', code: trimmed.replace(/^SIM-B1-?/, '') }
    if (trimmed.startsWith('SIM-B2')) return { prefix: 'SIM-B2', code: trimmed.replace(/^SIM-B2-?/, '') }
    if (trimmed.startsWith('SIM-B')) return { prefix: 'SIM-B', code: trimmed.replace(/^SIM-B-?/, '') }
    if (trimmed.startsWith('SIM-A')) return { prefix: 'SIM-A', code: trimmed.replace(/^SIM-A-?/, '') }
    return { prefix: 'SIM-A', code: trimmed.replace(/^SIM-?/, '') }
  }

  const initial = parseValue(value)
  const [prefix, setPrefix] = useState(initial.prefix)
  const [code, setCode] = useState(initial.code)

  useEffect(() => {
    const parsed = parseValue(value)
    setPrefix(parsed.prefix)
    setCode(parsed.code)
  }, [value])

  const handlePrefixChange = (newPrefix: string) => {
    setPrefix(newPrefix)
    const cleanCode = code.trim().toUpperCase()
    onChange(cleanCode ? `${newPrefix}-${cleanCode}` : `${newPrefix}-`)
  }

  const handleCodeChange = (newCode: string) => {
    let cleaned = newCode.trim().toUpperCase()
    let currentPrefix = prefix

    if (cleaned.startsWith('SIM-A-')) {
      currentPrefix = 'SIM-A'
      setPrefix('SIM-A')
      cleaned = cleaned.replace(/^SIM-A-/, '')
    } else if (cleaned.startsWith('SIM-B1-')) {
      currentPrefix = 'SIM-B1'
      setPrefix('SIM-B1')
      cleaned = cleaned.replace(/^SIM-B1-/, '')
    } else if (cleaned.startsWith('SIM-B2-')) {
      currentPrefix = 'SIM-B2'
      setPrefix('SIM-B2')
      cleaned = cleaned.replace(/^SIM-B2-/, '')
    } else if (cleaned.startsWith('SIM-B-')) {
      currentPrefix = 'SIM-B'
      setPrefix('SIM-B')
      cleaned = cleaned.replace(/^SIM-B-/, '')
    }

    setCode(cleaned)
    onChange(cleaned ? `${currentPrefix}-${cleaned}` : `${currentPrefix}-`)
  }

  const formattedResult = code.trim() ? `${prefix}-${code.trim().toUpperCase()}` : `${prefix}-...`

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <select
          value={prefix}
          onChange={e => handlePrefixChange(e.target.value)}
          className="bg-zinc-100 border border-zinc-300 rounded-md px-2.5 py-2 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none w-28 flex-shrink-0"
        >
          <option value="SIM-A">SIM A</option>
          <option value="SIM-B">SIM B</option>
          <option value="SIM-B1">SIM B1</option>
          <option value="SIM-B2">SIM B2</option>
        </select>
        <div className="relative flex-1">
          <input
            required={required}
            type="text"
            placeholder="Misal: 001 / ID-01"
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            className="w-full text-zinc-900 font-mono uppercase border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>Format Tersimpan:</span>
        <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {formattedResult}
        </span>
      </div>
    </div>
  )
}

// -- Filter Bar --
export function DriverFilterBar({ branches, userRole }: {
  branches: Array<{ id: string; name: string }>
  userRole: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [branch, setBranch] = useState(searchParams.get('branch') || 'all')
  const [showInactive, setShowInactive] = useState(searchParams.get('showInactive') === 'true')
  const [isPending, startTransition] = useTransition()

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      applyFilters(q, status, branch, showInactive)
    }, 300)
    return () => clearTimeout(handler)
  }, [q, status, branch, showInactive])

  const applyFilters = (searchQ: string, st: string, br: string, inactive: boolean) => {
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    if (st !== 'all') params.set('status', st)
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
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cari Nama Sopir / Format SIM (SIM-A-...)</label>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Misal: Budi / SIM-A-001 / SIM-B"
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Status Operasional</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Semua Status</option>
          <option value="available">Tersedia (Available)</option>
          <option value="on_trip">Sedang Bertugas (On Trip)</option>
          <option value="off_duty">Off Duty</option>
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
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
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

// -- Create Driver Modal --
export function CreateDriverButton({ branches, userRole }: {
  branches: Array<{ id: string; name: string }>
  userRole: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    licenseNumber: 'SIM-A-',
    branchId: '',
    dailyFee: '150000'
  })

  if (userRole === 'staff_cabang') return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const res = await createDriver({
        name: form.name,
        phone: form.phone,
        licenseNumber: form.licenseNumber,
        branchId: form.branchId,
        dailyFee: Number(form.dailyFee)
      })
      if (res.error) setError(res.error)
      else {
        setIsOpen(false)
        setForm({
          name: '',
          phone: '',
          licenseNumber: 'SIM-A-',
          branchId: '',
          dailyFee: '150000'
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
        + Tambah Sopir
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Tambah Sopir Baru</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Lengkap Sopir *</label>
                <input
                  required
                  type="text"
                  placeholder="Misal: Budi Santoso"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nomor Telepon / WA *</label>
                <input
                  required
                  type="text"
                  placeholder="081234567890"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nomor SIM Terformat *</label>
                <LicenseNumberInput
                  value={form.licenseNumber}
                  onChange={val => setForm({ ...form, licenseNumber: val })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang Penempatan *</label>
                  <select
                    required
                    value={form.branchId}
                    onChange={e => setForm({ ...form, branchId: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tarif Harian (Rp) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="150000"
                    value={form.dailyFee}
                    onChange={e => setForm({ ...form, dailyFee: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                {isPending ? 'Menyimpan...' : 'Simpan Sopir'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// -- Driver Row Actions & Leave Modal --
export function DriverRowActions({ driver, branches, userRole }: {
  driver: any
  branches: any[]
  userRole: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [modalType, setModalType] = useState<'edit' | 'status' | 'leave' | 'delete' | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<DriverStatus>(driver.status)

  const [editForm, setEditForm] = useState({
    name: driver.name,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    branchId: driver.branchId,
    dailyFee: driver.dailyFee.toString()
  })

  // Leave Management State
  const [leaves, setLeaves] = useState<any[]>([])
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  })
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const canEditOrDelete = userRole !== 'staff_cabang'

  const handleToggleMenu = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 220)
    }
    setMenuOpen(!menuOpen)
  }

  const loadLeaves = async () => {
    setIsLoadingLeaves(true)
    setLeaveError(null)
    const res = await getDriverLeaves(driver.id)
    setIsLoadingLeaves(false)
    if (res.error) setLeaveError(res.error)
    else if (res.leaves) setLeaves(res.leaves)
  }

  const handleOpenLeaveModal = () => {
    setMenuOpen(false)
    setModalType('leave')
    loadLeaves()
  }

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setLeaveError(null)
      const res = await createDriverLeave({
        driverId: driver.id,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      })
      if (res.error) {
        setLeaveError(res.error)
      } else {
        setLeaveForm({ startDate: '', endDate: '', reason: '' })
        loadLeaves()
        router.refresh()
      }
    })
  }

  const handleDeleteLeave = (leaveId: string) => {
    startTransition(async () => {
      setLeaveError(null)
      const res = await deleteDriverLeave(leaveId)
      if (res.error) {
        setLeaveError(res.error)
      } else {
        loadLeaves()
        router.refresh()
      }
    })
  }

  const handleUpdateStatus = () => {
    startTransition(async () => {
      setError(null)
      const res = await updateDriverStatus(driver.id, status)
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
      const res = await updateDriver(driver.id, {
        name: editForm.name,
        phone: editForm.phone,
        licenseNumber: editForm.licenseNumber,
        branchId: editForm.branchId,
        dailyFee: Number(editForm.dailyFee)
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
      const res = await softDeleteDriver(driver.id, !driver.isActive)
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
            <button
              onClick={() => {
                setMenuOpen(false)
                setModalType('status')
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Ubah Status Harian
            </button>
            <button
              onClick={handleOpenLeaveModal}
              className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 font-medium"
            >
              📅 Jadwal Cuti / Libur
            </button>
            {canEditOrDelete && (
              <>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setModalType('edit')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Edit Detail
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setModalType('delete')
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${driver.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {driver.isActive ? 'Nonaktifkan Sopir' : 'Aktifkan Kembali'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Status Modal */}
      {modalType === 'status' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Ubah Status Operasional Hari Ini</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Status ini berlaku real-time hari ini. Untuk cuti/libur terjadwal, gunakan menu Jadwal Cuti.
            </p>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as DriverStatus)}
              className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="available">Tersedia (Available)</option>
              <option value="off_duty">Off Duty (Sakit/Izin Hari Ini)</option>
              {driver.status === 'on_trip' && <option value="on_trip">Sedang Bertugas (On Trip)</option>}
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

      {/* Edit Modal */}
      {modalType === 'edit' && canEditOrDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Edit Data Sopir</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nomor Telepon *</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nomor SIM Terformat *</label>
                <LicenseNumberInput
                  value={editForm.licenseNumber}
                  onChange={val => setEditForm({ ...editForm, licenseNumber: val })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang *</label>
                  <select
                    value={editForm.branchId}
                    onChange={e => setEditForm({ ...editForm, branchId: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tarif Harian (Rp) *</label>
                  <input
                    type="number"
                    value={editForm.dailyFee}
                    onChange={e => setEditForm({ ...editForm, dailyFee: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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

      {/* Leave Management Modal */}
      {modalType === 'leave' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Jadwal Cuti & Libur</h3>
                <p className="text-xs text-zinc-500">Sopir: {driver.name} ({driver.licenseNumber})</p>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Add New Leave Form */}
            <form onSubmit={handleAddLeave} className="bg-blue-50/60 border border-blue-100 rounded-lg p-4 mb-6">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3">
                + Daftarkan Jadwal Cuti Baru
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Mulai Cuti *</label>
                  <input
                    required
                    type="date"
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full text-xs text-zinc-900 border border-zinc-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Selesai Cuti *</label>
                  <input
                    required
                    type="date"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full text-xs text-zinc-900 border border-zinc-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Alasan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Misal: Cuti tahunan / Izin keluarga"
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full text-xs text-zinc-900 border border-zinc-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {leaveError && (
                <div className="mb-3 p-2 bg-red-100 text-red-700 text-xs rounded border border-red-200">
                  {leaveError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                {isPending ? 'Mendaftarkan Cuti...' : 'Daftarkan Cuti'}
              </button>
            </form>

            {/* Leave History Table */}
            <div>
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                Daftar Cuti Terdaftar
              </h4>

              {isLoadingLeaves ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Memuat daftar cuti...</p>
              ) : leaves.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center bg-zinc-50 rounded border border-zinc-100">
                  Belum ada riwayat atau jadwal cuti untuk sopir ini.
                </p>
              ) : (
                <div className="space-y-2">
                  {leaves.map((l: any) => {
                    const isPast = new Date(l.endDate) < new Date()
                    const startDateStr = new Date(l.startDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                    const endDateStr = new Date(l.endDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })

                    return (
                      <div
                        key={l.id}
                        className={`p-3 rounded-lg border flex justify-between items-center text-xs ${
                          isPast
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-500'
                            : 'bg-white border-blue-200 text-zinc-800 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">
                            {startDateStr} - {endDateStr}
                            {isPast && <span className="ml-2 text-[10px] text-zinc-400">(Selesai)</span>}
                          </div>
                          {l.reason && <div className="text-[11px] text-zinc-500 mt-0.5">{l.reason}</div>}
                        </div>
                        {!isPast && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLeave(l.id)}
                            disabled={isPending}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors text-[11px]"
                            title="Batalkan Cuti"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Soft-Delete Modal */}
      {modalType === 'delete' && canEditOrDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-lg">
            <h3 className={`text-lg font-bold mb-2 ${driver.isActive ? 'text-red-700' : 'text-emerald-700'}`}>
              {driver.isActive ? 'Nonaktifkan Sopir?' : 'Aktifkan Kembali Sopir?'}
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              {driver.isActive
                ? 'Sopir tidak akan dapat ditugaskan untuk pesanan baru, namun riwayat penugasan historis tetap terjaga.'
                : 'Sopir akan kembali aktif dan dapat ditugaskan pada pesanan di cabangnya.'}
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                  driver.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isPending ? 'Memproses...' : driver.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
