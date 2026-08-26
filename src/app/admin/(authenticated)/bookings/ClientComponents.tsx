'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Search,
  Filter,
  Download,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Rocket,
  Car,
  ListOrdered,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { exportBookingsCsv } from '@/actions/adminBookingExport'

// ----------------------------------------------------
// 1. Action Tabs Component
// ----------------------------------------------------
export function BookingActionTabs({
  currentTab = 'action_required',
  counts
}: {
  currentTab?: string
  counts: {
    actionRequired: number
    handoverToday: number
    ongoing: number
    all: number
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    params.set('page', '1') // reset to page 1 on tab switch
    router.push(`${pathname}?${params.toString()}`)
  }

  const tabs = [
    {
      id: 'action_required',
      label: 'Perlu Tindakan',
      icon: Flame,
      count: counts.actionRequired,
      badgeColor: counts.actionRequired > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-200 text-zinc-700'
    },
    {
      id: 'handover_today',
      label: 'Siap Serah-Terima',
      icon: Rocket,
      count: counts.handoverToday,
      badgeColor: counts.handoverToday > 0 ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-700'
    },
    {
      id: 'ongoing',
      label: 'Sedang Berjalan',
      icon: Car,
      count: counts.ongoing,
      badgeColor: counts.ongoing > 0 ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-700'
    },
    {
      id: 'all',
      label: 'Semua Pesanan',
      icon: ListOrdered,
      count: counts.all,
      badgeColor: 'bg-zinc-200 text-zinc-700'
    }
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-200 mb-6 scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = currentTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
            <span>{tab.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                isActive ? 'bg-white/20 text-white' : tab.badgeColor
              }`}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------
// 2. Filter Bar & CSV Export Component
// ----------------------------------------------------
export function BookingFilterBar({
  branches,
  drivers,
  userRole
}: {
  branches: { id: string; name: string }[]
  drivers: { id: string; name: string }[]
  userRole: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [rentalType, setRentalType] = useState(searchParams.get('rentalType') || 'all')
  const [driverId, setDriverId] = useState(searchParams.get('driverId') || 'all')
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || 'all')
  const [dateType, setDateType] = useState<'pickup' | 'created'>((searchParams.get('dateType') as any) || 'pickup')
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Apply filters to URL
  const applyFilters = (newOverrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())

    const merged = {
      q,
      status,
      rentalType,
      driverId,
      branchId,
      dateType,
      dateFrom,
      dateTo,
      ...newOverrides
    }

    Object.entries(merged).forEach(([key, val]) => {
      if (val && val !== 'all' && val.trim() !== '') {
        params.set(key, val)
      } else {
        params.delete(key)
      }
    })

    params.set('page', '1') // reset page on filter change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== (searchParams.get('q') || '')) {
        applyFilters({ q })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [q])

  const handleResetFilters = () => {
    setQ('')
    setStatus('all')
    setRentalType('all')
    setDriverId('all')
    setBranchId('all')
    setDateFrom('')
    setDateTo('')
    const params = new URLSearchParams()
    const tab = searchParams.get('tab')
    if (tab) params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setExportError(null)

    const filterParams = {
      tab: searchParams.get('tab') || 'action_required',
      q: q || undefined,
      status: status !== 'all' ? status : undefined,
      rentalType: rentalType !== 'all' ? rentalType : undefined,
      driverId: driverId !== 'all' ? driverId : undefined,
      branchId: branchId !== 'all' ? branchId : undefined,
      dateType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    }

    const res = await exportBookingsCsv(filterParams)
    setIsExporting(false)

    if (res.error) {
      setExportError(res.error)
    } else if (res.csvContent && res.filename) {
      // Trigger client-side file download
      const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', res.filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  const hasActiveFilters =
    q ||
    (status && status !== 'all') ||
    (rentalType && rentalType !== 'all') ||
    (driverId && driverId !== 'all') ||
    (branchId && branchId !== 'all') ||
    dateFrom ||
    dateTo

  return (
    <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm mb-6 space-y-4">
      {/* Top row: Search input & Export CSV button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID booking, nama pelanggan, email, telepon, plat nomor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-zinc-400"
          />
          {q && (
            <button
              onClick={() => {
                setQ('')
                applyFilters({ q: '' })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-zinc-500 hover:text-red-600 px-3 py-2 rounded-lg border border-zinc-200 hover:border-red-200 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengekspor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Ekspor CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
          {exportError}
        </div>
      )}

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-zinc-100 text-xs">
        {/* Status Filter */}
        <div className="lg:col-span-1">
          <label className="text-zinc-600 font-semibold block mb-1">Status Pesanan</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              applyFilters({ status: e.target.value })
            }}
            className="w-full text-zinc-900 border border-zinc-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="active">Semua Aktif</option>
            <option value="confirmed">Confirmed</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending_payment">Pending Payment</option>
          </select>
        </div>

        {/* Rental Type Filter */}
        <div className="lg:col-span-1">
          <label className="text-zinc-600 font-semibold block mb-1">Tipe Rental</label>
          <select
            value={rentalType}
            onChange={(e) => {
              setRentalType(e.target.value)
              applyFilters({ rentalType: e.target.value })
            }}
            className="w-full text-zinc-900 border border-zinc-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Semua Tipe</option>
            <option value="self_drive">Lepas Kunci</option>
            <option value="with_driver">Dengan Sopir</option>
          </select>
        </div>

        {/* Driver Filter */}
        <div className="lg:col-span-1">
          <label className="text-zinc-600 font-semibold block mb-1">Penugasan Sopir</label>
          <select
            value={driverId}
            onChange={(e) => {
              setDriverId(e.target.value)
              applyFilters({ driverId: e.target.value })
            }}
            className="w-full text-zinc-900 border border-zinc-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Semua Sopir</option>
            <option value="unassigned">⚠️ Belum Ditugaskan</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Branch Filter (Only for admin_pusat) */}
        {userRole === 'admin_pusat' && (
          <div className="lg:col-span-1">
            <label className="text-zinc-600 font-semibold block mb-1">Cabang Pickup</label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value)
                applyFilters({ branchId: e.target.value })
              }}
              className="w-full text-zinc-900 border border-zinc-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Filter Selection with Segmented Control Toggle */}
        <div className={userRole === 'admin_pusat' ? 'sm:col-span-2 md:col-span-2 lg:col-span-2' : 'sm:col-span-2 md:col-span-3 lg:col-span-3'}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-zinc-600 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              Rentang Tanggal
            </label>

            {/* Segmented Control Button Group */}
            <div className="inline-flex p-0.5 bg-zinc-100 rounded-md border border-zinc-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setDateType('pickup')
                  applyFilters({ dateType: 'pickup' })
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  dateType === 'pickup'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Sewa
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateType('created')
                  applyFilters({ dateType: 'created' })
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  dateType === 'created'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Transaksi
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-[120px]">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  applyFilters({ dateFrom: e.target.value })
                }}
                className="w-full text-zinc-900 border border-zinc-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-zinc-400 text-xs font-medium px-0.5">s/d</span>
            <div className="relative flex-1 min-w-[120px]">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  applyFilters({ dateTo: e.target.value })
                }}
                className="w-full text-zinc-900 border border-zinc-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  applyFilters({ dateFrom: '', dateTo: '' })
                }}
                className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-100 transition-colors"
                title="Hapus filter tanggal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 3. Pagination Component
// ----------------------------------------------------
export function BookingPagination({
  page,
  pageSize,
  totalCount
}: {
  page: number
  pageSize: number
  totalCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, totalCount)

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-sm text-zinc-600 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
      <div>
        Menampilkan <span className="font-semibold text-zinc-900">{startRow}</span> -{' '}
        <span className="font-semibold text-zinc-900">{endRow}</span> dari{' '}
        <span className="font-semibold text-zinc-900">{totalCount}</span> pesanan
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 mr-2">
          Halaman <span className="font-semibold text-zinc-900">{page}</span> dari{' '}
          <span className="font-semibold text-zinc-900">{totalPages}</span>
        </span>

        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="flex items-center justify-center p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4 text-zinc-700" />
        </button>

        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center justify-center p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Halaman Selanjutnya"
        >
          <ChevronRight className="w-4 h-4 text-zinc-700" />
        </button>
      </div>
    </div>
  )
}
