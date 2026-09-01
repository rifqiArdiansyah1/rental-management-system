'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, RotateCcw, Eye, X, ShieldAlert, CheckCircle2 } from 'lucide-react'

export function AuditLogFilterBar({
  branches,
  userRole,
  userBranchId
}: {
  branches: Array<{ id: string; name: string }>
  userRole: string
  userBranchId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [entityType, setEntityType] = useState(searchParams.get('entityType') || 'all')
  const [branch, setBranch] = useState(searchParams.get('branchId') || (userRole === 'admin_pusat' ? 'all' : (userBranchId || 'all')))
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')

  const applyFilters = (newOverrides?: Record<string, string>) => {
    const params = new URLSearchParams()

    const currentQ = newOverrides?.q !== undefined ? newOverrides.q : q
    const currentCat = newOverrides?.category !== undefined ? newOverrides.category : category
    const currentEntity = newOverrides?.entityType !== undefined ? newOverrides.entityType : entityType
    const currentBranch = newOverrides?.branchId !== undefined ? newOverrides.branchId : branch
    const currentFrom = newOverrides?.dateFrom !== undefined ? newOverrides.dateFrom : dateFrom
    const currentTo = newOverrides?.dateTo !== undefined ? newOverrides.dateTo : dateTo

    if (currentQ.trim()) params.set('q', currentQ.trim())
    if (currentCat && currentCat !== 'all') params.set('category', currentCat)
    if (currentEntity && currentEntity !== 'all') params.set('entityType', currentEntity)
    if (userRole === 'admin_pusat' && currentBranch && currentBranch !== 'all') params.set('branchId', currentBranch)
    if (currentFrom) params.set('dateFrom', currentFrom)
    if (currentTo) params.set('dateTo', currentTo)
    params.set('page', '1')

    startTransition(() => {
      router.push(`/admin/audit-logs?${params.toString()}`)
    })
  }

  const handleReset = () => {
    setQ('')
    setCategory('all')
    setEntityType('all')
    setBranch(userRole === 'admin_pusat' ? 'all' : (userBranchId || 'all'))
    setDateFrom('')
    setDateTo('')
    startTransition(() => {
      router.push('/admin/audit-logs')
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm mb-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Pencarian</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Nama aktor, email, ID entitas..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="w-full pl-9 pr-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Kategori Aksi */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Kategori Aksi</label>
          <select
            value={category}
            onChange={e => {
              setCategory(e.target.value)
              applyFilters({ category: e.target.value })
            }}
            className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Semua Kategori Aksi</option>
            <option value="staff">Manajemen Staf (staff.*)</option>
            <option value="booking">Pesanan (booking.*)</option>
            <option value="rental">Sewa Operasional (rental.*)</option>
            <option value="driver">Sopir (driver.*)</option>
            <option value="vehicle">Armada Kendaraan (vehicle.*)</option>
            <option value="document">Dokumen / Privasi (document.*)</option>
            <option value="branch">Cabang (branch.*)</option>
          </select>
        </div>

        {/* Tipe Entitas */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipe Entitas</label>
          <select
            value={entityType}
            onChange={e => {
              setEntityType(e.target.value)
              applyFilters({ entityType: e.target.value })
            }}
            className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Semua Entitas</option>
            <option value="User">User / Staff</option>
            <option value="Booking">Booking</option>
            <option value="Vehicle">Vehicle</option>
            <option value="Driver">Driver</option>
            <option value="Document">Document</option>
            <option value="Customer">Customer</option>
            <option value="Branch">Branch</option>
            <option value="DriverLeave">Driver Leave</option>
          </select>
        </div>

        {/* Cabang (Khusus Admin Pusat) */}
        {userRole === 'admin_pusat' ? (
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Cabang Target</label>
            <select
              value={branch}
              onChange={e => {
                setBranch(e.target.value)
                applyFilters({ branchId: e.target.value })
              }}
              className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Cabang Target</label>
            <select
              disabled
              value={userBranchId || ''}
              className="w-full px-3 py-2 text-sm text-zinc-700 bg-zinc-100 border border-zinc-300 rounded-lg cursor-not-allowed"
            >
              {branches.filter(b => b.id === userBranchId).map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date Range & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pt-2 border-t border-zinc-100">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Dari Tanggal (WIB)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-xs text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Sampai Tanggal (WIB)</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-xs text-zinc-900 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => applyFilters()}
            disabled={isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Filter className="w-4 h-4" />
            <span>Terapkan Filter</span>
          </button>
          <button
            onClick={handleReset}
            disabled={isPending}
            className="flex items-center justify-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Reset Filter"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function MetadataViewerButton({
  action,
  entityType,
  entityId,
  metadata
}: {
  action: string
  entityType: string
  entityId: string
  metadata: any
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!metadata || (typeof metadata === 'object' && Object.keys(metadata).length === 0)) {
    return <span className="text-zinc-400 text-xs italic">-</span>
  }

  const isDenied = action.includes('denied')

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 transition-colors"
      >
        <Eye className="w-3.5 h-3.5 text-zinc-500" />
        <span>Detail</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-zinc-200 overflow-hidden">
            {/* Header */}
            <div className={`p-4 border-b flex justify-between items-center ${isDenied ? 'bg-red-50/70 border-red-100' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                {isDenied ? (
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                )}
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Detail Metadata Log</h3>
                  <p className="text-xs font-mono text-zinc-500">{action} • {entityType}: {entityId.substring(0, 12)}...</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* JSON Content */}
            <div className="p-4 overflow-y-auto flex-1 bg-zinc-950 text-emerald-400 font-mono text-xs rounded-b-xl m-3 select-all">
              <pre className="whitespace-pre-wrap word-break-break-all">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>

            {/* Footer */}
            <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-md transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
