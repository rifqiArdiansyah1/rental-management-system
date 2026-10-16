'use client'

import React, { useState } from 'react'
import { DailyTrendItem } from '@/lib/analytics/metrics'
import { generateSmoothAreaPaths, formatCompactCurrency, formatCompactNumber } from '@/lib/analytics/svgChartHelper'
import { DollarSign, FileSpreadsheet, ShoppingBag, Wrench, Wallet } from 'lucide-react'

interface TrendAreaChartProps {
  dailyTrends: DailyTrendItem[]
}

type MetricType = 'cashInflow' | 'maintenanceExpense' | 'netCashFlow' | 'rentalValue' | 'bookingsCount'

export function TrendAreaChart({ dailyTrends }: TrendAreaChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('cashInflow')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Pastikan nilai tidak negatif untuk perenderan area chart SVG sederhana
  const values = dailyTrends.map(item => Math.max(0, item[activeMetric]))

  const chartWidth = 720
  const chartHeight = 240
  const padding = { top: 25, right: 25, bottom: 35, left: 55 }

  const { linePath, areaPath, points, maxY } = generateSmoothAreaPaths(
    values,
    chartWidth,
    chartHeight,
    padding
  )

  const config = {
    cashInflow: {
      label: 'Arus Kas Masuk',
      color: '#10b981', // emerald-500
      strokeColor: '#059669', // emerald-600
      gradientId: 'cashGrad',
      formatTooltip: (val: number) => `Rp ${val.toLocaleString('id-ID')}`,
      formatAxis: (val: number) => `Rp ${formatCompactCurrency(val)}`,
      icon: DollarSign,
      activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
    },
    maintenanceExpense: {
      label: 'Biaya Perawatan',
      color: '#f43f5e', // rose-500
      strokeColor: '#e11d48', // rose-600
      gradientId: 'expenseGrad',
      formatTooltip: (val: number) => `Rp ${val.toLocaleString('id-ID')}`,
      formatAxis: (val: number) => `Rp ${formatCompactCurrency(val)}`,
      icon: Wrench,
      activeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold'
    },
    netCashFlow: {
      label: 'Arus Kas Bersih',
      color: '#6366f1', // indigo-500
      strokeColor: '#4f46e5', // indigo-600
      gradientId: 'netFlowGrad',
      formatTooltip: (val: number) => `Rp ${val.toLocaleString('id-ID')}`,
      formatAxis: (val: number) => `Rp ${formatCompactCurrency(val)}`,
      icon: Wallet,
      activeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold'
    },
    rentalValue: {
      label: 'Pendapatan Akrual',
      color: '#f59e0b', // amber-500
      strokeColor: '#d97706', // amber-600
      gradientId: 'rentalGrad',
      formatTooltip: (val: number) => `Rp ${val.toLocaleString('id-ID')}`,
      formatAxis: (val: number) => `Rp ${formatCompactCurrency(val)}`,
      icon: FileSpreadsheet,
      activeClass: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold'
    },
    bookingsCount: {
      label: 'Volume Pesanan',
      color: '#3b82f6', // blue-500
      strokeColor: '#2563eb', // blue-600
      gradientId: 'bookingsGrad',
      formatTooltip: (val: number) => `${val} Pesanan`,
      formatAxis: (val: number) => formatCompactNumber(val),
      icon: ShoppingBag,
      activeClass: 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
    }
  }[activeMetric]

  // Y-axis grid ticks (0%, 33%, 66%, 100%)
  const yTicks = [
    { value: maxY, y: padding.top },
    { value: Math.round(maxY * 0.66), y: padding.top + (chartHeight - padding.top - padding.bottom) * 0.34 },
    { value: Math.round(maxY * 0.33), y: padding.top + (chartHeight - padding.top - padding.bottom) * 0.67 },
    { value: 0, y: chartHeight - padding.bottom }
  ]

  // Tampilkan label tanggal X secukupnya (maks 7 titik agar tidak menumpuk)
  const xLabelStep = Math.max(1, Math.floor(dailyTrends.length / 6))

  const hoveredItem = hoveredIdx !== null ? dailyTrends[hoveredIdx] : null
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm" data-testid="trend-area-chart">
      {/* Header & Metric Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">Tren Performa Harian</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Dinamika kas masuk, biaya pemeliharaan, dan volume rental harian (WIB)
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="inline-flex flex-wrap rounded-xl bg-zinc-100 p-1 border border-zinc-200/60 self-start xl:self-auto gap-0.5">
          {(['cashInflow', 'maintenanceExpense', 'netCashFlow', 'rentalValue', 'bookingsCount'] as MetricType[]).map((metric) => {
            const isSelected = activeMetric === metric
            return (
              <button
                key={metric}
                type="button"
                onClick={() => {
                  setActiveMetric(metric)
                  setHoveredIdx(null)
                }}
                className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
                  isSelected
                    ? config.activeClass + ' shadow-xs'
                    : 'text-zinc-600 border-transparent hover:text-zinc-900'
                }`}
                data-testid={`metric-tab-${metric}`}
              >
                {metric === 'cashInflow' && 'Kas Masuk'}
                {metric === 'maintenanceExpense' && 'Biaya Perawatan'}
                {metric === 'netCashFlow' && 'Kas Bersih'}
                {metric === 'rentalValue' && 'Pendapatan Akrual'}
                {metric === 'bookingsCount' && 'Volume Pesanan'}
              </button>
            )
          })}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative mt-4 w-full">
        {/* Floating Tooltip jika ada hover */}
        {hoveredItem && hoveredPoint && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 bg-zinc-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl transition-all duration-75 border border-zinc-700"
            style={{
              left: `${(hoveredPoint.x / chartWidth) * 100}%`,
              top: `${(hoveredPoint.y / chartHeight) * 100}%`
            }}
          >
            <div className="font-semibold text-zinc-300 text-[11px] mb-0.5">
              {hoveredItem.formattedDate} ({hoveredItem.date})
            </div>
            <div className="font-bold text-sm text-white font-mono">
              {config.formatTooltip(hoveredItem[activeMetric])}
            </div>
            {activeMetric === 'netCashFlow' && (
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Masuk: Rp {hoveredItem.cashInflow.toLocaleString('id-ID')} | Keluar: Rp {hoveredItem.maintenanceExpense.toLocaleString('id-ID')}
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-56 sm:h-64 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.28" />
              <stop offset="95%" stopColor={config.color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines horizontal & Y Axis labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={chartWidth - padding.right}
                y2={tick.y}
                stroke="#f4f4f5"
                strokeWidth="1"
                strokeDasharray={i === yTicks.length - 1 ? 'none' : '3 3'}
              />
              <text
                x={padding.left - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-zinc-400 text-[10px] font-mono select-none"
              >
                {config.formatAxis(tick.value)}
              </text>
            </g>
          ))}

          {/* X Axis Labels */}
          {dailyTrends.map((item, idx) => {
            const isVisible = idx % xLabelStep === 0 || idx === dailyTrends.length - 1
            if (!isVisible || !points[idx]) return null
            return (
              <text
                key={idx}
                x={points[idx].x}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] select-none"
              >
                {item.formattedDate}
              </text>
            )
          })}

          {/* Area Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#${config.gradientId})`}
              className="transition-all duration-300"
            />
          )}

          {/* Line Stroke */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Data Points & Interactive hover zones */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx
            return (
              <g key={idx}>
                {/* Invisible wide hit area for hover */}
                <rect
                  x={pt.x - (chartWidth / points.length) / 2}
                  y={padding.top}
                  width={chartWidth / points.length}
                  height={chartHeight - padding.top - padding.bottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* Point circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3}
                  fill={isHovered ? config.strokeColor : '#ffffff'}
                  stroke={config.strokeColor}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all pointer-events-none"
                />

                {/* Vertical cursor guide line when hovered */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={padding.top}
                    x2={pt.x}
                    y2={chartHeight - padding.bottom}
                    stroke={config.strokeColor}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    className="pointer-events-none opacity-60"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
