'use client'

import { useState, useTransition, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createStaff, updateStaff, softDeleteStaff } from '@/actions/adminStaff'
import { UserRole } from '@prisma/client'

// -- Filter Bar --
export function StaffFilterBar({
  branches,
  userRole
}: {
  branches: { id: string; name: string }[]
  userRole: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [role, setRole] = useState(searchParams.get('role') || 'all')
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || 'all')
  const [showInactive, setShowInactive] = useState(searchParams.get('showInactive') === 'true')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handler = setTimeout(() => {
      applyFilters(q, role, branchId, showInactive)
    }, 300)
    return () => clearTimeout(handler)
  }, [q, role, branchId, showInactive])

  const applyFilters = (searchQ: string, filterRole: string, filterBranch: string, inactive: boolean) => {
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    if (filterRole !== 'all') params.set('role', filterRole)
    if (filterBranch !== 'all') params.set('branchId', filterBranch)
    if (inactive) params.set('showInactive', 'true')

    const query = params.toString() ? `?${params.toString()}` : ''
    startTransition(() => {
      router.push(`${pathname}${query}`)
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cari Nama / Email Staf</label>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Misal: Budi / staff@prestige.com"
          className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {userRole === 'admin_pusat' && (
        <div className="w-full md:w-48">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Peran (Role)</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">Semua Peran</option>
            <option value="staff_cabang">Staf Cabang</option>
            <option value="admin_cabang">Admin Cabang</option>
            <option value="admin_pusat">Admin Pusat</option>
          </select>
        </div>
      )}

      {userRole === 'admin_pusat' && (
        <div className="w-full md:w-56">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Cabang</label>
          <select
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
            className="w-full text-zinc-900 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">Semua Cabang</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          id="showInactiveStaff"
          checked={showInactive}
          onChange={e => setShowInactive(e.target.checked)}
          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="showInactiveStaff" className="text-sm text-zinc-700 cursor-pointer whitespace-nowrap">
          Tampilkan Nonaktif
        </label>
      </div>
    </div>
  )
}

// -- Create Staff Modal --
export function CreateStaffButton({
  branches,
  userRole,
  currentBranchId
}: {
  branches: { id: string; name: string }[]
  userRole: string
  currentBranchId?: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: userRole === 'admin_cabang' ? ('staff_cabang' as UserRole) : ('staff_cabang' as UserRole),
    branchId: userRole === 'admin_cabang' ? currentBranchId || '' : branches[0]?.id || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 10) {
      setError('Password wajib minimal 10 karakter demi keamanan akun internal.')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await createStaff({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        branchId: form.role === 'admin_pusat' ? null : form.branchId
      })

      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
        setForm({
          name: '',
          email: '',
          password: '',
          role: 'staff_cabang',
          branchId: userRole === 'admin_cabang' ? currentBranchId || '' : branches[0]?.id || ''
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
        + Tambah Staf
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Tambah Akun Staf Baru</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Lengkap *</label>
                <input
                  required
                  type="text"
                  placeholder="Misal: Ahmad Fauzi"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Alamat Email *</label>
                <input
                  required
                  type="email"
                  placeholder="staf@prestige.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password Awal (Min. 10 Karakter) *</label>
                <input
                  required
                  type="password"
                  minLength={10}
                  placeholder="Minimal 10 karakter"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Peran (Role) *</label>
                  {userRole === 'admin_pusat' ? (
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="staff_cabang">Staf Cabang</option>
                      <option value="admin_cabang">Admin Cabang</option>
                      <option value="admin_pusat">Admin Pusat</option>
                    </select>
                  ) : (
                    <input
                      disabled
                      type="text"
                      value="Staf Cabang"
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang Penempatan *</label>
                  {form.role === 'admin_pusat' ? (
                    <input
                      disabled
                      type="text"
                      value="Semua Cabang (Pusat)"
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  ) : userRole === 'admin_pusat' ? (
                    <select
                      value={form.branchId}
                      onChange={e => setForm({ ...form, branchId: e.target.value })}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled
                      type="text"
                      value={branches.find(b => b.id === currentBranchId)?.name || 'Cabang Saya'}
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            {error && <div className="mt-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-md border border-red-200">{error}</div>}

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
                {isPending ? 'Menyimpan...' : 'Simpan Akun Staf'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// -- Staff Row Actions --
export function StaffRowActions({
  staff,
  branches,
  userRole,
  currentUserId
}: {
  staff: any
  branches: { id: string; name: string }[]
  userRole: string
  currentUserId: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalType, setModalType] = useState<'edit' | 'delete' | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: staff.name,
    role: staff.role as UserRole,
    branchId: staff.branchId || branches[0]?.id || '',
    password: ''
  })

  // Role checks for row
  const isSelf = staff.id === currentUserId
  const canEditOrDelete = userRole === 'admin_pusat' || (userRole === 'admin_cabang' && staff.role === 'staff_cabang')

  if (!canEditOrDelete) {
    return <span className="text-zinc-300 text-xs">—</span>
  }

  const handleEdit = () => {
    if (editForm.password && editForm.password.trim().length < 10) {
      setError('Password baru wajib minimal 10 karakter.')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await updateStaff(staff.id, {
        name: editForm.name,
        role: editForm.role,
        branchId: editForm.role === 'admin_pusat' ? null : editForm.branchId,
        password: editForm.password || undefined
      })

      if (res.error) {
        setError(res.error)
      } else {
        setModalType(null)
        router.refresh()
      }
    })
  }

  const handleToggleActive = () => {
    startTransition(async () => {
      setError(null)
      const res = await softDeleteStaff(staff.id, !staff.isActive)
      if (res.error) {
        setError(res.error)
      } else {
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
              onClick={() => {
                setMenuOpen(false)
                setModalType('edit')
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Edit Akun & Password
            </button>
            {!isSelf && (
              <button
                onClick={() => {
                  setMenuOpen(false)
                  setModalType('delete')
                }}
                className={`w-full text-left px-4 py-2 text-sm ${staff.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
              >
                {staff.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Kembali'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {modalType === 'edit' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Edit Akun Staf</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Staf</label>
                <input
                  disabled
                  type="text"
                  value={staff.email}
                  className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Peran (Role)</label>
                  {userRole === 'admin_pusat' ? (
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="staff_cabang">Staf Cabang</option>
                      <option value="admin_cabang">Admin Cabang</option>
                      <option value="admin_pusat">Admin Pusat</option>
                    </select>
                  ) : (
                    <input
                      disabled
                      type="text"
                      value="Staf Cabang"
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Cabang Penempatan</label>
                  {editForm.role === 'admin_pusat' ? (
                    <input
                      disabled
                      type="text"
                      value="Semua Cabang (Pusat)"
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  ) : userRole === 'admin_pusat' ? (
                    <select
                      value={editForm.branchId}
                      onChange={e => setEditForm({ ...editForm, branchId: e.target.value })}
                      className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled
                      type="text"
                      value={branches.find(b => b.id === staff.branchId)?.name || 'Cabang Saya'}
                      className="w-full bg-zinc-100 text-zinc-500 border border-zinc-300 rounded-md p-2 text-sm"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Reset Password (Opsional)
                </label>
                <input
                  type="password"
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-zinc-400 mt-0.5 block">Minimal 10 karakter jika diisi.</span>
              </div>
            </div>

            {error && <div className="mt-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-md border border-red-200">{error}</div>}

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

      {/* Delete / Toggle Active Modal */}
      {modalType === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-lg">
            <h3 className={`text-lg font-bold mb-2 ${staff.isActive ? 'text-red-700' : 'text-emerald-700'}`}>
              {staff.isActive ? 'Nonaktifkan Akun Staf?' : 'Aktifkan Kembali Akun Staf?'}
            </h3>
            <p className="text-sm text-zinc-600 mb-3">
              {staff.isActive
                ? `Akun ${staff.name} (${staff.email}) akan dinonaktifkan dan sesinya akan langsung dicabut seketika.`
                : `Akun ${staff.name} akan diaktifkan kembali dan dapat login ke panel admin.`}
            </p>
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
                  staff.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isPending ? 'Memproses...' : staff.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
