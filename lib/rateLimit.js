// Simple in-memory fixed-window rate limiter
const requests = new Map()

const DEFAULT_WINDOW_MS = 60000 // 1 minute
const DEFAULT_MAX_REQUESTS = 100 // 100 requests per minute

export function rateLimit(ip, opts = {}) {
  const windowMs = Number(opts.windowMs ?? DEFAULT_WINDOW_MS)
  const maxRequests = Number(opts.maxRequests ?? DEFAULT_MAX_REQUESTS)
  const now = Date.now()

  const entry = requests.get(ip)
  if (!entry || now > entry.resetAt) {
    const next = { count: 1, resetAt: now + windowMs }
    requests.set(ip, next)
    return {
      success: true,
      remaining: Math.max(0, maxRequests - next.count),
      resetAt: next.resetAt,
    }
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count += 1
  return {
    success: true,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  }
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || '127.0.0.1'
}
