// Advanced caching service for API responses
// Implements multi-layer caching: memory → request → long-term

const CACHE_DURATIONS = {
  ASSETS: 5 * 60 * 1000,           // 5 min
  QUOTE: 30 * 1000,                 // 30 sec
  ACCOUNT: 10 * 1000,               // 10 sec (user-specific, short TTL)
  POSITIONS: 15 * 1000,             // 15 sec
  PERFORMANCE: 2 * 60 * 1000,       // 2 min
  WATCHLIST: 60 * 1000,             // 1 min
  LEADERBOARD: 5 * 60 * 1000,       // 5 min
  JOURNAL: 2 * 60 * 1000,           // 2 min
}

// Global in-memory cache (cleared on process restart)
const memoryCache = new Map()

// Generate cache key from route + userId + params
function getCacheKey(route, userId = '', params = {}) {
  const paramStr = Object.keys(params).length 
    ? '?' + new URLSearchParams(params).toString() 
    : ''
  return `${route}:${userId}${paramStr}`
}

// Get value from cache
function getCached(key) {
  const cached = memoryCache.get(key)
  if (!cached) return null
  
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key)
    return null
  }
  
  return cached.value
}

// Set value in cache
function setCached(key, value, ttlMs) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

// Clear specific cache entry
function clearCache(key) {
  memoryCache.delete(key)
}

// Clear all caches for a user (e.g., after trade execution)
function clearUserCache(userId) {
  for (const key of memoryCache.keys()) {
    if (key.includes(`:${userId}`)) {
      memoryCache.delete(key)
    }
  }
}

// Clear all caches
function clearAllCache() {
  memoryCache.clear()
}

export { 
  getCached, 
  setCached, 
  clearCache, 
  clearUserCache,
  clearAllCache,
  getCacheKey,
  CACHE_DURATIONS,
}
