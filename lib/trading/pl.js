// P/L estimation helpers

export function estimateGrossPnl({ distancePips, pipValuePerUnit, size }) {
  const d = Number(distancePips)
  const v = Number(pipValuePerUnit)
  const s = Number(size)
  if (!Number.isFinite(d) || !Number.isFinite(v) || !Number.isFinite(s)) return null
  return d * v * s
}

export function estimateBalancePct({ grossPnl, equity }) {
  const g = Number(grossPnl)
  const e = Number(equity)
  if (!Number.isFinite(g) || !Number.isFinite(e) || e <= 0) return null
  return g / e
}

export function formatMoneyApprox(amount, currency) {
  const a = Number(amount)
  if (!Number.isFinite(a)) return '—'
  const cur = currency || ''
  const abs = Math.abs(a)
  const decimals = abs >= 1000 ? 2 : 2
  const formatted = abs.toFixed(decimals)
  // Keep it simple: prefix currency symbol when obvious, else show code.
  const symbol = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : ''
  return symbol ? `${a < 0 ? '-' : ''}${symbol}${formatted}` : `${a < 0 ? '-' : ''}${formatted} ${cur}`.trim()
}

export function formatPctApprox(ratio) {
  const r = Number(ratio)
  if (!Number.isFinite(r)) return '—'
  return (r * 100).toFixed(2) + '%'
}
