'use client'

import React, { useState, useMemo } from 'react'
import { FleetPerformanceItem } from '@/lib/analytics/metrics'
import { Search, Gauge, ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-react'

interface FleetPerformanceTableProps {
  fleetPerformance: FleetPerformanceItem[]
}

type SortField = 'revenue' | 'utilization' | 'days' | 'expense' | 'margin'

export function FleetPerformanceTable({ fleetPerformance }: FleetPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('margin')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 8

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(field)
      setSortAsc(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = fleetPerformance.filter(item => {
      const q = searchTerm.toLowerCase()
      return (
        item.plateNumber.toLowerCase().includes(q) ||
        item.vehicleName.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q) ||
        item.branchName.toLowerCase().includes(q)
      )
    })

    result.sort((a, b) => {
      let diff = 0
      if (sortBy === 'revenue') {
        diff = a.accruedRealizedRevenue - b.accruedRealizedRevenue
      } else if (sortBy === 'utilization') {
        diff = a.utilizationRate - b.utilizationRate
      } else if (sortBy === 'days') {
        diff = a.totalRentalDays - b.totalRentalDays
      } else if (sortBy === 'expense') {
        diff = a.physicalMaintenanceExpenses - b.physicalMaintenanceExpenses
      } else if (sortBy === 'margin') {
        diff = a.operatingProfitMargin - b.operatingProfitMargin
      }
      return sortAsc ? diff : -diff
    })

    return result
  }, [fleetPerformance, searchTerm, sortBy, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const paginatedItems = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize)

  const getUtilizationBadge = (rate: number) => {
    if (rate >= 70) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500'
      }
    }
    if (rate >= 40) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'bg-amber-500'
      }
    }
    return {
      bg: 'bg-zinc-100 text-zinc-600 border-zinc-200',
      bar: 'bg-zinc-400'
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden" data-testid="fleet-performance-table">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">Kinerja Finansial Armada</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Pendapatan akrual sewa terealisasi dikurangi beban pemeliharaan fisik unit armada
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari armada, plat, cabang..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-zinc-800 placeholder-zinc-400"
            data-testid="fleet-search-input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-zinc-50/75 border-b border-zinc-100 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Armada & Plat</th>
              <th className="py-3 px-4">Cabang</th>
              <th className="py-3 px-4 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('days')}>
                <div className="flex items-center gap-1">
                  <span>Durasi Sewa</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('revenue')}>
                <div className="flex items-center gap-1">
                  <span>Pendapatan Akrual</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('expense')}>
                <div className="flex items-center gap-1">
                  <span>Biaya Fisik</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('margin')}>
                <div className="flex items-center gap-1">
                  <span>Margin Operasional</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-zinc-800 select-none" onClick={() => handleSort('utilization')}>
                <div className="flex items-center gap-1">
                  <span>Utilisasi</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Odometer Terkini</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400">
                  Tidak ada armada yang sesuai dengan pencarian atau rentang tanggal.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const badge = getUtilizationBadge(item.utilizationRate)
                const isDeficit = item.operatingProfitMargin < 0

                return (
                  <tr key={item.plateNumber} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900">{item.vehicleName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] font-medium bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200">
                          {item.plateNumber}
                        </span>
                        <span className="text-[11px] text-zinc-500">{item.categoryName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700">
                      {item.branchName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-800">
                      <div>{item.totalRentalDays} hari</div>
                      <div className="text-[10px] text-zinc-400">({item.totalRentalHours} jam)</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-zinc-900">
                        Rp {item.accruedRealizedRevenue.toLocaleString('id-ID')}
                      </div>
                      {item.accruedScheduledRevenue > 0 && (
                        <div className="text-[10px] text-zinc-400">
                          Pipeline: Rp {item.accruedScheduledRevenue.toLocaleString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-700">
                      {item.physicalMaintenanceExpenses > 0 ? (
                        <span className="text-rose-600 font-medium">
                          Rp {item.physicalMaintenanceExpenses.toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">Rp 0</span>
                      )}
                      {item.ownershipExpenses > 0 && (
                        <div className="text-[10px] text-zinc-400">
                          Legal: Rp {item.ownershipExpenses.toLocaleString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {isDeficit ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>-Rp {Math.abs(item.operatingProfitMargin).toLocaleString('id-ID')}</span>
                          </div>
                          {item.isDeficitQualified ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-semibold bg-rose-100 text-rose-800 rounded border border-rose-200">
                              Unit Defisit (≥90 hari)
                            </span>
                          ) : (
                            <div className="mt-0.5 text-[10px] text-zinc-500 flex items-center gap-1">
                              <Info className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>Margin negatif periode ini</span>
                            </div>
                          )}
                          {item.largestExpenseCategory && (
                            <div className="text-[10px] text-zinc-400">
                              Biaya utama: {item.largestExpenseCategory} (Rp {item.largestExpenseAmount?.toLocaleString('id-ID')})
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          +Rp {item.operatingProfitMargin.toLocaleString('id-ID')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-28">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.bg}`}>
                            {item.utilizationRate}%
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${badge.bar}`}
                            style={{ width: `${Math.min(100, item.utilizationRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-zinc-700">
                      {item.currentOdometerKm != null ? (
                        <span className="flex items-center justify-end gap-1 text-zinc-800">
                          <Gauge className="w-3 h-3 text-zinc-400" />
                          <span>{item.currentOdometerKm.toLocaleString('id-ID')} km</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">-</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filteredAndSorted.length > pageSize && (
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <div>
            Menampilkan <strong>{((page - 1) * pageSize) + 1}</strong> - <strong>{Math.min(page * pageSize, filteredAndSorted.length)}</strong> dari <strong>{filteredAndSorted.length}</strong> armada
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-2">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
