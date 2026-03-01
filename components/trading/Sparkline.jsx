'use client'

import { useMemo } from 'react'

export default function Sparkline({ values, width = 96, height = 28, className = '' }) {
  const path = useMemo(() => {
    if (!Array.isArray(values) || values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1

    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / span) * height
      return [x, y]
    })

    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  }, [values, width, height])

  const trendUp = Array.isArray(values) && values.length >= 2
    ? values[values.length - 1] >= values[0]
    : true

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {path ? (
        <path
          d={path}
          fill="none"
          stroke={trendUp ? 'currentColor' : 'currentColor'}
          strokeWidth="2"
          className={trendUp ? 'text-emerald-400' : 'text-red-400'}
          strokeLinecap="round"
        />
      ) : (
        <path d={`M0,${height / 2} L${width},${height / 2}`} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600" />
      )}
    </svg>
  )
}
