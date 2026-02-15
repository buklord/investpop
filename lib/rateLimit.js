// Simple in-memory rate limiter
const requests = new Map()

const WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS = 100 // 100 requests per minute

export function rateLimit(ip) {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  // Clean old entries
  const userRequests = requests.get(ip) || []
  const recentRequests = userRequests.filter(time => time > windowStart)

  if (recentRequests.length >= MAX_REQUESTS) {
    return {
      success: false,
      remaining: 0,
      resetAt: Math.min(...recentRequests) + WINDOW_MS
    }
  }

  recentRequests.push(now)
  requests.set(ip, recentRequests)

  return {
    success: true,
    remaining: MAX_REQUESTS - recentRequests.length,
    resetAt: now + WINDOW_MS
  }
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || '127.0.0.1'
}
