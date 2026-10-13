export interface Point {
  x: number
  y: number
}

/**
 * Memformat angka ke format ringkas (misal: 15.5 jt, 500 rb, 1.2 M).
 */
export function formatCompactCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return (val / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' M'
  }
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' jt'
  }
  if (Math.abs(val) >= 1_000) {
    return (val / 1_000).toFixed(0) + ' rb'
  }
  return val.toLocaleString('id-ID')
}

export function formatCompactNumber(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (Math.abs(val) >= 1_000) {
    return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return String(val)
}

/**
 * Menghitung jalur kurva SVG halus (Smooth Cubic Bézier Curve)
 * dan polygon area untuk visualisasi tren finansial / pesanan.
 */
export function generateSmoothAreaPaths(
  values: number[],
  width: number = 600,
  height: number = 240,
  padding = { top: 20, right: 20, bottom: 30, left: 20 }
): {
  linePath: string
  areaPath: string
  points: Point[]
  maxY: number
  minY: number
} {
  const chartWidth = Math.max(10, width - padding.left - padding.right)
  const chartHeight = Math.max(10, height - padding.top - padding.bottom)

  if (values.length === 0) {
    return { linePath: '', areaPath: '', points: [], maxY: 0, minY: 0 }
  }

  const rawMax = Math.max(...values, 0)
  // Beri headroom 15% agar grafik tidak menempel di atap
  const maxY = rawMax === 0 ? 100 : Math.ceil(rawMax * 1.15)
  const minY = 0

  const count = values.length
  const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth / 2

  const points: Point[] = values.map((val, idx) => {
    const x = padding.left + (count > 1 ? idx * stepX : chartWidth / 2)
    const normalizedY = maxY === minY ? 0.5 : (val - minY) / (maxY - minY)
    const y = padding.top + chartHeight - normalizedY * chartHeight
    return { x, y }
  })

  if (points.length === 1) {
    const p = points[0]
    const baselineY = padding.top + chartHeight
    return {
      linePath: `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y}`,
      areaPath: `M ${p.x - 10} ${baselineY} L ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} ${baselineY} Z`,
      points,
      maxY,
      minY,
    }
  }

  // Bangun kurva halus Bézier antar titik
  let linePath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const controlPointX = (current.x + next.x) / 2
    linePath += ` C ${controlPointX} ${current.y}, ${controlPointX} ${next.y}, ${next.x} ${next.y}`
  }

  const baselineY = padding.top + chartHeight
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const areaPath = `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`

  return { linePath, areaPath, points, maxY, minY }
}
