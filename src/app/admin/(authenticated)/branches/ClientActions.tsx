'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createBranch, updateBranch, softDeleteBranch } from '@/actions/adminBranch'

// -- Filter Bar --
export function BranchFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [showInactive, setShowInactive] = useState(searchParams.get('showInactive') === 'true')
  const [isPending, startTransition] = useTransition()

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      applyFilters(q, showInactive)
    }, 300)
    return () => clearTimeout(handler)
  }, [q, showInactive])

  const applyFilters = (searchQ: string, inactive: boolean) => {
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    if (inactive) params.set('showInactive', 'true')

    const query = params.toString() ? `?${params.toString()}` : ''
    startTransition(() => {
      router.push(`${pathname}${query}`)
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cari Nama Cabang / Kota / Alamat</label>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Misal: Jakarta / Sudirman / Bandung"
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

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

// -- Create Branch Modal --
export function CreateBranchButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    openTime: '08:00',
    closeTime: '21:00'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const res = await createBranch(form)
      if (res.error) setError(res.error)
      else {
        setIsOpen(false)
        setForm({
          name: '',
          city: '',
          address: '',
          phone: '',
          openTime: '08:00',
          closeTime: '21:00'
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
        + Tambah Cabang
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Tambah Cabang Baru</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Cabang *</label>
                <input
                  required
                  type="text"
                  placeholder="Misal: Cabang Bandung Dago"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kota *</label>
                  <input
                    required
                    type="text"
                    placeholder="Bandung"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">No. Telepon / WA *</label>
                  <input
                    required
                    type="text"
                    placeholder="022-1234567"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Alamat Lengkap *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Jl. Ir. H. Juanda No. 123, Dago"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jam Buka *</label>
                  <input
                    required
                    type="time"
                    value={form.openTime}
                    onChange={e => setForm({ ...form, openTime: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jam Tutup *</label>
                  <input
                    required
                    type="time"
                    value={form.closeTime}
                    onChange={e => setForm({ ...form, closeTime: e.target.value })}
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
                {isPending ? 'Menyimpan...' : 'Simpan Cabang'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// -- Branch Row Actions --
export function BranchRowActions({ branch }: { branch: any }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [modalType, setModalType] = useState<'edit' | 'delete' | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: branch.name,
    city: branch.city,
    address: branch.address,
    phone: branch.phone,
    openTime: branch.openTime || '08:00',
    closeTime: branch.closeTime || '21:00'
  })

  const handleToggleMenu = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 220)
    }
    setMenuOpen(!menuOpen)
  }

  const handleEdit = () => {
    startTransition(async () => {
      setError(null)
      const res = await updateBranch(branch.id, editForm)
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
      const res = await softDeleteBranch(branch.id, !branch.isActive)
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
                setModalType('edit')
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Edit Detail Cabang
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                setModalType('delete')
              }}
              className={`w-full text-left px-4 py-2 text-sm ${branch.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              {branch.isActive ? 'Nonaktifkan Cabang' : 'Aktifkan Kembali'}
            </button>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {modalType === 'edit' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Edit Data Cabang</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Cabang *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kota *</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">No. Telepon *</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Alamat Lengkap *</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jam Buka *</label>
                  <input
                    type="time"
                    value={editForm.openTime}
                    onChange={e => setEditForm({ ...editForm, openTime: e.target.value })}
                    className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Jam Tutup *</label>
                  <input
                    type="time"
                    value={editForm.closeTime}
                    onChange={e => setEditForm({ ...editForm, closeTime: e.target.value })}
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

      {/* Delete / Soft-Delete Modal */}
      {modalType === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className={`text-lg font-bold mb-2 ${branch.isActive ? 'text-red-700' : 'text-emerald-700'}`}>
              {branch.isActive ? 'Nonaktifkan Cabang?' : 'Aktifkan Kembali Cabang?'}
            </h3>
            <p className="text-sm text-zinc-600 mb-3">
              {branch.isActive
                ? 'Cabang ini tidak akan muncul pada pilihan reservasi pelanggan ataupun form pendaftaran armada/sopir baru.'
                : 'Cabang akan kembali aktif dan dapat dipilih untuk operasional reservasi.'}
            </p>
            {branch.isActive && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                <strong>Ketentuan Guard:</strong> Cabang hanya dapat dinonaktifkan jika tidak memiliki armada mobil aktif, sopir aktif, staf terdaftar, atau pesanan aktif yang belum selesai.
              </div>
            )}
            {error && <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">{error}</div>}
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
                  branch.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isPending ? 'Memproses...' : branch.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
