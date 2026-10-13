'use client'

import React, { useState } from 'react'
import { Calendar, Filter, Download, ChevronDown, Check, Loader2 } from 'lucide-react'
import { getDefaultAnalyticsDateRange } from '@/lib/analytics/metrics'

interface BranchOption {
  id: string
  name: string
}

interface DateRangeSelectorProps {
  initialDateFrom: string
  initialDateTo: string
  branches?: BranchOption[]
  selectedBranchId?: string
  isLoading: boolean
  onFilterChange: (filters: { dateFrom: string; dateTo: string; branchId?: string }) => void
  onExportCsv: (type: 'daily_summary' | 'fleet_performance') => Promise<void>
}

export function DateRangeSelector({
  initialDateFrom,
  initialDateTo,
  branches,
  selectedBranchId = 'all',
  isLoading,
  onFilterChange,
  onExportCsv
}: DateRangeSelectorProps) {
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [branchId, setBranchId] = useState(selectedBranchId)
  const [preset, setPreset] = useState<'20d' | '7d' | '30d' | 'this_month' | 'custom'>('20d')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handlePresetChange = (selectedPreset: '20d' | '7d' | '30d' | 'this_month' | 'custom') => {
    setPreset(selectedPreset)
    if (selectedPreset === 'custom') return

    const now = new Date()
    const todayWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)
    const [year, month, day] = todayWibStr.split('-').map(Number)

    let fromStr = ''
    if (selectedPreset === '20d') {
      const start = new Date(Date.UTC(year, month - 1, day - 19))
      fromStr = start.toISOString().split('T')[0]
    } else if (selectedPreset === '7d') {
      const start = new Date(Date.UTC(year, month - 1, day - 6))
      fromStr = start.toISOString().split('T')[0]
    } else if (selectedPreset === '30d') {
      const start = new Date(Date.UTC(year, month - 1, day - 29))
      fromStr = start.toISOString().split('T')[0]
    } else if (selectedPreset === 'this_month') {
      const start = new Date(Date.UTC(year, month - 1, 1))
      fromStr = start.toISOString().split('T')[0]
    }

    setDateFrom(fromStr)
    setDateTo(todayWibStr)
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    onFilterChange({
      dateFrom,
      dateTo,
      branchId: branches ? branchId : undefined
    })
  }

  const triggerExport = async (type: 'daily_summary' | 'fleet_performance') => {
    setExportMenuOpen(false)
    setIsExporting(true)
    try {
      await onExportCsv(type)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      data-testid="date-range-selector"
    >
      <form onSubmit={handleApply} className="flex flex-wrap items-center gap-3">
        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value as any)}
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
            data-testid="preset-select"
          >
            <option value="20d">20 Hari Terakhir (Default)</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
            <option value="this_month">Bulan Ini</option>
            <option value="custom">Rentang Kustom...</option>
          </select>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPreset('custom')
            }}
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            data-testid="date-from-input"
          />
          <span className="text-xs text-zinc-400">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPreset('custom')
            }}
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            data-testid="date-to-input"
          />
        </div>

        {/* Branch Filter for Admin Pusat */}
        {branches && branches.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
              data-testid="branch-select"
            >
              <option value="all">Semua Cabang (Konsolidasi)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs"
          data-testid="apply-filter-btn"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Filter className="w-3.5 h-3.5" />
          )}
          <span>Terapkan</span>
        </button>
      </form>

      {/* CSV Export Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExportMenuOpen(!exportMenuOpen)}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          data-testid="export-csv-btn"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
          ) : (
            <Download className="w-3.5 h-3.5 text-amber-700" />
          )}
          <span>Unduh Laporan (CSV)</span>
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        </button>

        {exportMenuOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-20 animate-in fade-in zoom-in-95">
            <div className="px-3 py-1.5 border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Pilihan Format Ekspor (UU PDP)
            </div>
            <button
              type="button"
              onClick={() => triggerExport('daily_summary')}
              className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50 flex flex-col transition-colors"
              data-testid="export-daily-btn"
            >
              <span className="font-semibold text-zinc-900">Ringkasan Tren Harian</span>
              <span className="text-[11px] text-zinc-400">Arus kas masuk, nilai sewa, volume booking</span>
            </button>
            <button
              type="button"
              onClick={() => triggerExport('fleet_performance')}
              className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50 flex flex-col transition-colors"
              data-testid="export-fleet-btn"
            >
              <span className="font-semibold text-zinc-900">Performa & Utilisasi Armada</span>
              <span className="text-[11px] text-zinc-400">Jam sewa, pendapatan unit, km odometer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
